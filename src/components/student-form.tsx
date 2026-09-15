"use client";

import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { DateField } from "@/components/date-field";
import {
  InputField,
  SelectField,
  TextAreaField,
} from "@/components/form-fields";
import {
  getClassGroupById,
  getGroupSelectOptions,
  isIrregularGroup,
  groupIdForSchedule,
  groupLabelForSchedule,
} from "@/data/groups";
import {
  inferPackageType,
  PACKAGE_TYPE_LABELS,
  PACKAGE_TYPES,
  sessionOptionsForPackage,
} from "@/data/packages";
import {
  DEFAULT_INSTRUCTOR_ID,
  getAssignableInstructors,
  instructorLabelForId,
} from "@/data/staff";
import { DAY_SHORT, PAYMENT_LABELS, WEEKDAYS } from "@/lib/labels";
import { todayISO } from "@/lib/dates";
import type {
  DayOfWeek,
  ClassGroup,
  NewStudentInput,
  PackageType,
  PaymentStatus,
  Student,
} from "@/types/studio";
import { useState } from "react";

export function StudentForm({
  student,
  mode,
  submitLabel = "Öğrenciyi kaydet",
  onSaved,
}: {
  student?: Student;
  mode?: "create" | "edit" | "restore";
  submitLabel?: string;
  onSaved?: (studentId: string, inviteUrl?: string) => void;
}) {
  const { addStudent, restoreStudent, updateStudent, user, isSuperAdmin } = useStudio();
  const groups = getGroupSelectOptions();
  const [error, setError] = useState<string | null>(null);
  const defaultInstructorId = user?.role === "instructor" ? user.id : undefined;
  const [form, setForm] = useState(() =>
    formFromStudent(student, groups[0]?.value ?? "", defaultInstructorId),
  );
  const resolvedMode = mode ?? (student ? "edit" : "create");
  const lockInstructor = !isSuperAdmin && user?.role === "instructor";

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function updatePackageType(value: PackageType) {
    setForm((current) => ({ ...current, packageType: value }));
    setError(null);
  }

  function selectGroup(groupId: string) {
    setForm((current) => {
      const wasIrregular = isIrregularGroup(current.groupId);
      const isNowIrregular = isIrregularGroup(groupId);
      const groupDays = getClassGroupById(groupId)?.days ?? [];
      if (!isNowIrregular) {
        // Hazır bir grup seçildiğinde öğrencinin programı doğrudan grubun
        // gün ve saatini kullanır; aynı özel program grubu düzenleniyorsa
        // mevcut alanları temizleyip paketin geçmişini bozmayız.
        const editingSameCustomGroup =
          current.groupId === groupId && current.customDays.length > 0;
        return {
          ...current,
          groupId,
          customDays: editingSameCustomGroup ? current.customDays : [],
          customTime: editingSameCustomGroup ? current.customTime : "",
        };
      }
      return {
        ...current,
        groupId,
        customDays:
          isNowIrregular && current.customDays.length === 0 && !wasIrregular
            ? [...groupDays]
            : current.customDays,
        customTime: current.customTime,
      };
    });
    setError(null);
  }

  function toggleCustomDay(day: DayOfWeek) {
    setForm((current) => ({
      ...current,
      customDays: current.customDays.includes(day)
        ? current.customDays.filter((item) => item !== day)
        : [...current.customDays, day],
    }));
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.groupId) {
      setError("Gün ve saat seç.");
      return;
    }
    if (!Number.isInteger(Number(form.totalSessions)) || Number(form.totalSessions) <= 0) {
      setError("Geçerli bir seans sayısı seç.");
      return;
    }
    const isIrregular = isIrregularGroup(form.groupId);
    if (isIrregular && (!form.customDays.length || !form.customTime)) {
      setError("Özel program için gün ve saat gerekli.");
      return;
    }
    if (form.customDays.length && !form.customTime) {
      setError("Özel programda gün ve saat birlikte girilmeli.");
      return;
    }
    if (resolvedMode === "create" && !form.email.trim()) {
      setError("E-posta gerekli. Davet maili gönderilecek.");
      return;
    }
    // Gün ve saat elle girildiyse öğrenci hazır grubun üzerinde kalmaz:
    // bu program kayıtla birlikte kendi kalıcı grubuna dönüşür.
    const newGroup: ClassGroup | undefined =
      form.customDays.length && form.customTime.trim()
        ? {
      id: groupIdForSchedule(form.customDays, form.customTime),
      days: form.customDays,
      time: form.customTime,
      capacity: 2,
      label: groupLabelForSchedule(form.customDays, form.customTime),
    }
        : undefined;
    const input = toInput(form, lockInstructor ? user?.id : undefined, newGroup);
    const result = await (
      resolvedMode === "restore" && student
        ? restoreStudent(student.id, input)
        : resolvedMode === "edit" && student
          ? updateStudent(student.id, input)
          : addStudent(input));
    if (result.error || !result.id) {
      setError(result.error ?? "Kayıt yapılamadı.");
      return;
    }
    onSaved?.(result.id, result.inviteUrl);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <FormSection title="Öğrenci ölçüsü">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <InputField
            label="Kilo (kg)"
            value={form.weightKg}
            onChange={(value) => update("weightKg", value)}
            type="number"
          />
          <InputField
            label="Boy (cm)"
            value={form.heightCm}
            onChange={(value) => update("heightCm", value)}
            type="number"
          />
          <InputField
            label="Bel (cm)"
            value={form.waistCm}
            onChange={(value) => update("waistCm", value)}
            type="number"
          />
          <InputField
            label="Kalça (cm)"
            value={form.hipCm}
            onChange={(value) => update("hipCm", value)}
            type="number"
          />
          <InputField
            label="Göğüs (cm)"
            value={form.chestCm}
            onChange={(value) => update("chestCm", value)}
            type="number"
          />
        </div>
      </FormSection>

      <FormSection title="Kişisel bilgiler">
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Ad soyad"
            value={form.name}
            onChange={(value) => update("name", value)}
            required
          />
          {!lockInstructor ? (
            <SelectField
              label="Eğitmen"
              value={form.instructorId}
              onChange={(value) => update("instructorId", value)}
              options={getAssignableInstructors().map((instructor) => ({
                value: instructor.id,
                label: instructor.name,
              }))}
            />
          ) : (
            <div>
              <p className="text-sm text-muted">Eğitmen</p>
              <p className="mt-1 rounded-xl border border-border bg-white px-3 py-2.5 text-sm">
                {instructorLabelForId(form.instructorId)}
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="E-posta"
            value={form.email}
            onChange={(value) => update("email", value)}
            placeholder="ornek@mail.com"
            required={resolvedMode === "create"}
          />
          <InputField
            label="Telefon"
            value={form.phone}
            onChange={(value) => update("phone", value)}
          />
        </div>
      </FormSection>

      <FormSection title="Paket ve program">
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Paket türü"
            value={form.packageType}
            onChange={(value) => updatePackageType(value as PackageType)}
            options={PACKAGE_TYPES.map((type) => ({
              value: type,
              label: PACKAGE_TYPE_LABELS[type],
            }))}
          />
          <SelectField
            label="Seans"
            value={form.totalSessions}
            onChange={(value) => update("totalSessions", value)}
            options={sessionOptionsForPackage(form.packageType)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Gün ve saat"
            value={form.groupId}
            onChange={selectGroup}
            options={groups}
          />
          <DateField
            label="Ders başlangıç tarihi"
            value={form.startDate}
            onChange={(value) => update("startDate", value)}
            required
          />
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface-muted/40 p-4">
          <p className="text-sm font-medium">
            {isIrregularGroup(form.groupId)
              ? "Özel program (zorunlu)"
              : "Özel program (isteğe bağlı)"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {isIrregularGroup(form.groupId)
              ? "Günleri ve saati girip öğrenciyi kaydet. Bu program otomatik olarak grup listesine eklenir."
              : "Hazır listede olmayan bir ders saati için günleri ve saati girip öğrenciyi kaydet. Program otomatik olarak grup listesine eklenir."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleCustomDay(day)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  form.customDays.includes(day)
                    ? "bg-accent text-white"
                    : "border border-border bg-white text-muted"
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-xs">
            <TimePickerField
              value={form.customTime}
              onChange={(value) => update("customTime", value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Kayıt detayları">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <InputField
              label="Aylık erteleme hakkı"
              value={form.monthlyPostponeLimit}
              onChange={(value) => update("monthlyPostponeLimit", value)}
              type="number"
            />
            <p className="mt-1 text-xs text-muted">
              Bir takvim ayında kaç ders erteleyebilir. Varsayılan 1.
            </p>
          </div>
          <SelectField
            label="Ödeme durumu"
            value={form.paymentStatus}
            onChange={(value) => update("paymentStatus", value)}
            options={(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((status) => ({
              value: status,
              label: PAYMENT_LABELS[status],
            }))}
          />
        </div>
        <TextAreaField
          label="Not"
          value={form.note}
          onChange={(value) => update("note", value)}
          placeholder="Hoca notu: sakatlık, ödeme, özel durum…"
        />
      </FormSection>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-serif text-xl">{title}</h2>
      {children}
    </Card>
  );
}

function TimePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // Some older custom schedules store a per-day range such as
  // "19.00–20.00". The picker edits the first time while preserving the
  // remaining range instead of showing an empty minute field.
  const firstTime = value.match(/\d{1,2}[.:]\d{2}/)?.[0] ?? "";
  const [rawHour = "", rawMinute = ""] = firstTime.split(/[.:]/);
  const hour = rawHour.padStart(2, "0");
  const minute = rawMinute.padStart(2, "0");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
  const updateTime = (nextHour: string, nextMinute: string) => {
    if (!nextHour || !nextMinute) {
      onChange("");
      return;
    }
    const suffix = value.match(/^\s*\d{1,2}[.:]\d{2}(.*)$/)?.[1] ?? "";
    onChange(`${nextHour}.${nextMinute}${suffix}`);
  };

  return (
    <fieldset>
      <legend className="text-sm text-muted">Saat</legend>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <SelectField
          label="Saat"
          value={hours.includes(hour) ? hour : ""}
          onChange={(nextHour) => updateTime(nextHour, minute)}
          options={[
            { value: "", label: "Saat seç" },
            ...hours.map((item) => ({ value: item, label: item })),
          ]}
        />
        <SelectField
          label="Dakika"
          value={minutes.includes(minute) ? minute : ""}
          onChange={(nextMinute) => updateTime(hour, nextMinute)}
          options={[
            { value: "", label: "Dakika seç" },
            ...minutes.map((item) => ({ value: item, label: item })),
          ]}
        />
      </div>
    </fieldset>
  );
}

function formFromStudent(
  student: Student | undefined,
  fallbackGroupId: string,
  defaultInstructorId?: string,
) {
  const groupId = student?.groupId ?? fallbackGroupId;
  return {
    name: student?.name ?? "",
    email: student?.email ?? "",
    phone: student?.phone === "—" ? "" : (student?.phone ?? ""),
    groupId,
    instructorId: student?.instructorId ?? defaultInstructorId ?? DEFAULT_INSTRUCTOR_ID,
    packageType: student?.packageType ?? inferPackageType(groupId),
    weightKg: student ? String(student.measurements.weightKg) : "",
    heightCm: student ? String(student.measurements.heightCm) : "",
    waistCm: student ? String(student.measurements.waistCm) : "",
    hipCm: student ? String(student.measurements.hipCm) : "",
    chestCm: student ? String(student.measurements.chestCm) : "",
    totalSessions: student ? String(student.package.totalSessions) : "12",
    paymentStatus: (student?.package.paymentStatus ?? "paid") as PaymentStatus,
    note: student?.note ?? "",
    monthlyPostponeLimit: student ? String(student.monthlyPostponeLimit) : "",
    startDate: student?.package.startDate ?? todayISO(),
    customDays: student?.package.customSchedule?.days ?? [],
    customTime: student?.package.customSchedule?.time ?? "",
  };
}

function toInput(
  form: ReturnType<typeof formFromStudent>,
  lockedInstructorId?: string,
  newGroup?: ClassGroup,
): NewStudentInput {
  const monthlyPostponeRaw = form.monthlyPostponeLimit.trim();
  const monthlyPostponeLimit = monthlyPostponeRaw === ""
    ? 1
    : Number(monthlyPostponeRaw);
  return {
    name: form.name,
    email: form.email,
    phone: form.phone,
    groupId: newGroup?.id ?? form.groupId,
    instructorId: lockedInstructorId ?? form.instructorId,
    packageType: form.packageType,
    weightKg: Number(form.weightKg) || 0,
    heightCm: Number(form.heightCm) || 0,
    waistCm: Number(form.waistCm) || 0,
    hipCm: Number(form.hipCm) || 0,
    chestCm: Number(form.chestCm) || 0,
    totalSessions: Number(form.totalSessions),
    paymentStatus: form.paymentStatus,
    note: form.note,
    monthlyPostponeLimit: Number.isFinite(monthlyPostponeLimit)
      ? Math.max(0, Math.round(monthlyPostponeLimit))
      : 1,
    startDate: form.startDate || todayISO(),
    customDays: form.customDays,
    customTime: form.customTime,
    customGroup: newGroup,
  };
}
