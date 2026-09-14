"use client";

import { Button, Card } from "@/components/ui";
import { InputField } from "@/components/form-fields";
import { useStudio } from "@/components/studio-provider";
import { getStaffById } from "@/data/staff";
import { isStaffRole, staffTitle, studentsForUser } from "@/lib/access";
import { useState } from "react";

export default function AdminProfilePage() {
  const { user, students, isSuperAdmin, changeStaffPassword } = useStudio();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user || !isStaffRole(user.role)) return null;

  const staffId = user.id;
  const staff = getStaffById(staffId);
  const mine = studentsForUser(user, students);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const result = await changeStaffPassword(
      staffId,
      currentPassword,
      newPassword,
      confirmPassword,
    );

    if (result.error || !result.success) {
      setError(result.error ?? "Şifre güncellenemedi.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Şifren güncellendi.");
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">{staff?.name ?? user.name}</h1>
        <p className="mt-1 text-sm text-muted">{staffTitle(user)}</p>
      </header>

      <Card className="grid gap-5 p-5 sm:grid-cols-2">
        <Field label="E-posta" value={user.email} />
        <Field label="Rol" value={staffTitle(user)} />
        {!isSuperAdmin ? (
          <Field label="Öğrenci sayısı" value={String(mine.length)} />
        ) : (
          <Field label="Öğrenci sayısı" value={String(students.length)} />
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-serif text-xl">Şifre değiştir</h2>
        <p className="mt-1 text-sm text-muted">
          Yeni şifren en az 6 karakter olmalı.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <InputField
            label="Mevcut şifre"
            type="password"
            value={currentPassword}
            onChange={setCurrentPassword}
            required
          />
          <InputField
            label="Yeni şifre"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            required
          />
          <InputField
            label="Yeni şifre tekrar"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
          <Button type="submit">Şifreyi güncelle</Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
