"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { StudentForm } from "@/components/student-form";
import { StudentSavedModal } from "@/components/student-saved-modal";
import { useStudio } from "@/components/studio-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function NewStudentPage() {
  const router = useRouter();
  const { students, sessions } = useStudio();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedInviteUrl, setSavedInviteUrl] = useState<string | null>(null);
  const saved = students.find((student) => student.id === savedId);
  const savedSessions = useMemo(
    () => (savedId ? sessions.filter((session) => session.studentId === savedId) : []),
    [savedId, sessions],
  );

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
        <h1 className="font-serif text-3xl">Öğrenci kaydet</h1>
      </header>
      <StudentForm
        onSaved={(studentId, inviteUrl) => {
          setSavedId(studentId);
          setSavedInviteUrl(inviteUrl ?? null);
        }}
      />
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
