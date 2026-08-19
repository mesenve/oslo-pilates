"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { Card, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function RestoreStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { archivedStudents } = useStudio();
  const student = archivedStudents.find((item) => item.id === params.id);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/arsiv"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Arşiv
      </Link>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Arşiv
        </p>
        <h1 className="mt-1 font-serif text-3xl">Kaydı aktif hale getir</h1>
        <p className="mt-1 text-sm text-muted">
          Bilgileri düzenleyip kaydı tekrar öğrenci listesine al.
        </p>
      </header>
      {student ? (
        <Card className="p-5">
          <StudentForm
            student={student}
            submitLabel="Kaydı aktif hale getir"
            onSaved={(id) => router.replace(`/admin/ogrenciler/${id}`)}
          />
        </Card>
      ) : (
        <EmptyState>Arşiv kaydı bulunamadı.</EmptyState>
      )}
    </div>
  );
}
