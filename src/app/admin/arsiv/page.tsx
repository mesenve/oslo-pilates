"use client";

import { LetterIndex } from "@/components/letter-index";
import { Button, Card, ConfirmDialog, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroupById } from "@/data/groups";
import { firstLetter, sortByName, type TurkishLetter } from "@/lib/alphabet";
import type { Student } from "@/types/studio";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function ArchivePage() {
  const { archivedStudents, permanentlyDeleteStudent } = useStudio();
  const router = useRouter();
  const sorted = useMemo(
    () => sortByName(archivedStudents),
    [archivedStudents],
  );
  const initial =
    sorted.length > 0 ? firstLetter(sorted[0].name) : ("A" as TurkishLetter);
  const [letter, setLetter] = useState<TurkishLetter>(initial);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);
  const visible = sorted.filter((student) => firstLetter(student.name) === letter);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Arşiv
        </p>
        <h1 className="mt-1 font-serif text-3xl">Silinen öğrenciler</h1>
      </header>

      {sorted.length === 0 ? (
        <EmptyState>Arşivde öğrenci yok.</EmptyState>
      ) : (
        <>
          <LetterIndex students={sorted} selected={letter} onSelect={setLetter} />
          {visible.length === 0 ? (
            <EmptyState>Bu harfte arşiv kaydı yok.</EmptyState>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((student) => (
                <Card key={student.id} className="space-y-3 px-4 py-4">
                  <div>
                    <p className="font-serif text-xl">{student.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {getClassGroupById(student.groupId)?.label}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => router.push(`/admin/arsiv/${student.id}`)}
                    >
                      Kaydı tekrar aktif hale getir
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setPendingDelete(student)}
                    >
                      Kalıcı olarak sil
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Kalıcı sil"
          body={`${pendingDelete.name} kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          confirmLabel="Kalıcı olarak sil"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            permanentlyDeleteStudent(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
