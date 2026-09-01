"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { StudentSavedModal } from "@/components/student-saved-modal";
import { EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function RestoreStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { archivedStudents, students, sessions } = useStudio();
  const student = archivedStudents.find((item) => item.id === params.id);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedInviteUrl, setSavedInviteUrl] = useState<string | null>(null);
  const saved = students.find((item) => item.id === savedId);
  const savedSessions = useMemo(
    () => (savedId ? sessions.filter((session) => session.studentId === savedId) : []),
    [savedId, sessions],
  );

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
        <h1 className="font-serif text-3xl">Kaydı aktif hale getir</h1>
        <p className="mt-1 text-sm text-muted">
          Bilgileri düzenleyip kaydı tekrar öğrenci listesine al.
        </p>
      </header>
      {student ? (
        <StudentForm
          student={student}
          mode="restore"
          submitLabel="Kaydı aktif hale getir"
          onSaved={(studentId, inviteUrl) => {
            setSavedId(studentId);
            setSavedInviteUrl(inviteUrl ?? null);
          }}
        />
      ) : (
        <EmptyState>Arşiv kaydı bulunamadı.</EmptyState>
      )}
      {saved && savedInviteUrl ? (
        <StudentSavedModal
          student={saved}
          sessions={savedSessions}
          inviteUrl={savedInviteUrl}
          phone={saved.phone}
          onContinue={() => router.replace(`/admin/ogrenciler/${saved.id}`)}
        />
      ) : null}
    </div>
  );
}
