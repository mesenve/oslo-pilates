"use client";

import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getStaffById } from "@/data/staff";
import { studentsForUser } from "@/lib/access";

export default function AdminProfilePage() {
  const { user, students } = useStudio();
  if (!user || user.role !== "instructor") return null;

  const staff = getStaffById(user.id);
  const mine = studentsForUser(user, students);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Profil
        </p>
        <h1 className="mt-1 font-serif text-3xl">{staff?.name ?? user.name}</h1>
        <p className="mt-1 text-sm text-muted">Eğitmen paneli</p>
      </header>

      <Card className="space-y-3 p-5">
        <p className="text-sm text-muted">E-posta</p>
        <p className="font-medium">{user.email}</p>
        <p className="text-sm text-muted">Öğrenci sayısı</p>
        <p className="font-medium">{mine.length}</p>
      </Card>

      <Card className="p-5">
        <p className="text-sm text-muted">
          Sadece sana atanmış öğrencileri ve derslerini görürsün. Yoklama onayı
          ve erteleme talepleri de kendi öğrencilerinle sınırlıdır.
        </p>
        <Button variant="secondary" className="mt-4" disabled>
          Demo profil
        </Button>
      </Card>
    </div>
  );
}
