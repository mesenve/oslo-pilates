"use client";

import { useCurrentStudent, useStudio } from "@/components/studio-provider";
import { Card, PaymentBadge } from "@/components/ui";
import {
  postponePendingDateInPackage,
  postponeUsedDateInPackage,
} from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";
import { postponeRightLabel, remainingLabel } from "@/lib/labels";

export default function ProfilePage() {
  const student = useCurrentStudent();
  const { remainingFor, remainingPostponeFor, postponeRequests, sessions } = useStudio();
  if (!student) return null;

  const group = getClassGroupById(student.groupId);
  const remaining = remainingFor(student.id);
  const m = student.measurements;
  const postponeUsedDate = postponeUsedDateInPackage(
    student,
    postponeRequests,
    sessions,
  );
  const postponePendingDate = postponePendingDateInPackage(
    student,
    postponeRequests,
    sessions,
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">{student.name}</h1>
      </header>

      <Card className="grid gap-6 p-6 sm:grid-cols-2">
        <Field label="E-posta" value={student.email} />
        <Field label="Telefon" value={student.phone} />
        <Field label="Grup" value={group?.label ?? "—"} />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Ödeme</p>
          <div className="mt-2">
            <PaymentBadge status={student.package.paymentStatus} />
          </div>
        </div>
        <Field
          label="Paket"
          value={`${remainingLabel(remaining)} / ${student.package.totalSessions} ders`}
        />
        <Field
          label="Erteleme hakkı"
          value={postponeRightLabel(
            remainingPostponeFor(student.id),
            student.monthlyPostponeLimit > 0 ? student.monthlyPostponeLimit : 0,
            postponeUsedDate,
            postponePendingDate,
          )}
        />
        <Field
          label="Bitiş"
          value={formatLongDate(student.package.endDate)}
        />
        {student.postponeLessonNote?.trim() ? (
          <div className="sm:col-span-2">
            <Field label="Erteleme notu" value={student.postponeLessonNote} />
          </div>
        ) : null}
        {student.note?.trim() ? (
          <div className="sm:col-span-2">
            <Field label="Not" value={student.note} />
          </div>
        ) : null}
      </Card>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Ölçüler</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Kilo" value={`${m.weightKg} kg`} />
          <Stat label="Boy" value={`${m.heightCm} cm`} />
          <Stat label="Bel" value={`${m.waistCm} cm`} />
          <Stat label="Kalça" value={`${m.hipCm} cm`} />
          <Stat label="Göğüs" value={`${m.chestCm} cm`} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl">{value}</p>
    </Card>
  );
}
