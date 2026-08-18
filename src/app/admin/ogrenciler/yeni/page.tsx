"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { Card } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewStudentPage() {
  const router = useRouter();

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
        <StudentForm
          onSaved={(id) => router.replace(`/admin/ogrenciler/${id}`)}
        />
      </Card>
    </div>
  );
}
