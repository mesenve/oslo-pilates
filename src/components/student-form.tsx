"use client";

import { Button } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroups } from "@/data/groups";
import { PAYMENT_LABELS } from "@/lib/labels";
import type { PaymentStatus } from "@/types/studio";
import { useState } from "react";

export function StudentForm({
  onSaved,
}: {
  onSaved?: (studentId: string) => void;
}) {
  const { addStudent } = useStudio();
  const groups = getClassGroups();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    groupId: groups[0]?.id ?? "",
    weightKg: "58",
    heightCm: "165",
    waistCm: "70",
    hipCm: "95",
    chestCm: "86",
    totalSessions: "12",
    paymentStatus: "paid" as PaymentStatus,
    note: "",
    monthlyPostponeLimit: "1",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = addStudent({
      name: form.name,
      email: form.email,
      phone: form.phone,
      groupId: form.groupId,
      weightKg: Number(form.weightKg) || 0,
      heightCm: Number(form.heightCm) || 0,
      waistCm: Number(form.waistCm) || 0,
      hipCm: Number(form.hipCm) || 0,
      chestCm: Number(form.chestCm) || 0,
      totalSessions: Number(form.totalSessions) || 12,
      paymentStatus: form.paymentStatus as PaymentStatus,
      note: form.note,
      monthlyPostponeLimit: Number.isFinite(Number(form.monthlyPostponeLimit))
        ? Math.max(0, Math.round(Number(form.monthlyPostponeLimit)))
        : 1,
    });
    if (result.error || !result.id) {
      setError(result.error ?? "Kayıt yapılamadı.");
      return;
    }
    onSaved?.(result.id);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Field
        label="Ad soyad"
        value={form.name}
        onChange={(value) => update("name", value)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="E-posta"
          value={form.email}
          onChange={(value) => update("email", value)}
          placeholder="boş bırakılırsa otomatik oluşur"
        />
        <Field
          label="Telefon"
          value={form.phone}
          onChange={(value) => update("phone", value)}
        />
      </div>
      <label className="block text-sm">
        <span className="text-muted">Grup</span>
        <select
          value={form.groupId}
          onChange={(event) => update("groupId", event.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field
          label="Kilo (kg)"
          value={form.weightKg}
          onChange={(value) => update("weightKg", value)}
          type="number"
        />
        <Field
          label="Boy (cm)"
          value={form.heightCm}
          onChange={(value) => update("heightCm", value)}
          type="number"
        />
        <Field
          label="Bel (cm)"
          value={form.waistCm}
          onChange={(value) => update("waistCm", value)}
          type="number"
        />
        <Field
          label="Kalça (cm)"
          value={form.hipCm}
          onChange={(value) => update("hipCm", value)}
          type="number"
        />
        <Field
          label="Göğüs (cm)"
          value={form.chestCm}
          onChange={(value) => update("chestCm", value)}
          type="number"
        />
        <Field
          label="Paket ders"
          value={form.totalSessions}
          onChange={(value) => update("totalSessions", value)}
          type="number"
        />
        <Field
          label="Aylık erteleme hakkı"
          value={form.monthlyPostponeLimit}
          onChange={(value) => update("monthlyPostponeLimit", value)}
          type="number"
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        Bir takvim ayında kaç ders erteleyebilir. Varsayılan 1.
      </p>

      <label className="block text-sm">
        <span className="text-muted">Ödeme durumu</span>
        <select
          value={form.paymentStatus}
          onChange={(event) => update("paymentStatus", event.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          {(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((status) => (
            <option key={status} value={status}>
              {PAYMENT_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-muted">Not</span>
        <textarea
          value={form.note}
          onChange={(event) => update("note", event.target.value)}
          rows={4}
          placeholder="Hoca notu: sakatlık, ödeme, özel durum…"
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full">
        Öğrenciyi kaydet
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
