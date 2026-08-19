"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { StudentSavedModal } from "@/components/student-saved-modal";
import { Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewStudentPage() {
  const router = useRouter();
  const { students } = useStudio();
  const [savedId, setSavedId] = useState<string | null>(null);
  const saved = students.find((student) => student.id === savedId);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/ogrenciler"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Öğrenciler
      </Link>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Yeni kayıt
        </p>
        <h1 className="mt-1 font-serif text-3xl">Öğrenci kaydet</h1>
      </header>
      <Card className="p-5">
        <StudentForm onSaved={setSavedId} />
      </Card>
      {saved ? (
        <StudentSavedModal
          phone={saved.phone}
          onContinue={() => router.replace(`/admin/ogrenciler/${saved.id}`)}
        />
      ) : null}
    </div>
  );
}
