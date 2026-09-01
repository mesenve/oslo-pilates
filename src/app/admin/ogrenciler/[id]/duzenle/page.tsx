"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { visibleStudents, isSuperAdmin } = useStudio();
  const student = visibleStudents.find((item) => item.id === params.id);

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/ogrenciler/${params.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Öğrenci detayı
      </Link>
      <header>
        <h1 className="font-serif text-3xl">Bilgileri düzenle</h1>
        <p className="mt-1 text-sm text-muted">
          {student
            ? `${student.name} kaydını güncelle.`
            : "Öğrenci bilgilerini düzenle."}
        </p>
      </header>
      {student ? (
        <StudentForm
          student={student}
          mode="edit"
          submitLabel="Değişiklikleri kaydet"
          onSaved={(id) => router.replace(`/admin/ogrenciler/${id}`)}
        />
      ) : (
        <EmptyState>
          {isSuperAdmin ? "Öğrenci bulunamadı." : "Bu öğrenci sana atanmamış."}
        </EmptyState>
      )}
    </div>
  );
}
