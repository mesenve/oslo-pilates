"use client";

import { ChevronRightIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { LetterIndex } from "@/components/letter-index";
import { Button, Card, ConfirmDialog, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroupById } from "@/data/groups";
import { firstLetter, sortByName, type TurkishLetter } from "@/lib/alphabet";
import type { Student } from "@/types/studio";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Tab = "aktif" | "arsiv";

export default function StudentsPage() {
  const {
    students,
    archivedStudents,
    archiveStudent,
    permanentlyDeleteStudent,
  } = useStudio();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("aktif");
  const [pendingArchive, setPendingArchive] = useState<Student | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);

  const list = tab === "aktif" ? students : archivedStudents;
  const sorted = useMemo(() => sortByName(list), [list]);
  const initial =
    sorted.length > 0 ? firstLetter(sorted[0].name) : ("A" as TurkishLetter);
  const [letter, setLetter] = useState<TurkishLetter>(initial);
  const visible = sorted.filter((student) => firstLetter(student.name) === letter);

  function selectTab(next: Tab) {
    setTab(next);
    const nextList = sortByName(next === "aktif" ? students : archivedStudents);
    setLetter(
      nextList.length > 0 ? firstLetter(nextList[0].name) : ("A" as TurkishLetter),
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Öğrenciler</h1>
        </div>
        {tab === "aktif" ? (
          <Button onClick={() => router.push("/admin/ogrenciler/yeni")}>
            <PlusIcon className="h-4 w-4" />
            Kaydet
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-full bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => selectTab("aktif")}
          className={`rounded-full px-3 py-2 text-sm ${
            tab === "aktif" ? "bg-white text-accent shadow-sm" : "text-muted"
          }`}
        >
          Aktif
        </button>
        <button
          type="button"
          onClick={() => selectTab("arsiv")}
          className={`rounded-full px-3 py-2 text-sm ${
            tab === "arsiv" ? "bg-white text-accent shadow-sm" : "text-muted"
          }`}
        >
          Arşiv
        </button>
      </div>

      <LetterIndex students={sorted} selected={letter} onSelect={setLetter} />

      {visible.length === 0 ? (
        <EmptyState>
          {tab === "aktif"
            ? "Bu harfte kayıtlı öğrenci yok."
            : "Bu harfte arşiv kaydı yok."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((student) =>
            tab === "aktif" ? (
              <Card
                key={student.id}
                className="flex items-center justify-between gap-3 px-4 py-4"
              >
                <Link
                  href={`/admin/ogrenciler/${student.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="font-serif text-xl">{student.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {getClassGroupById(student.groupId)?.label}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    className="px-3 text-accent"
                    onClick={() => setPendingArchive(student)}
                  >
                    <TrashIcon className="h-4 w-4" />
                    Sil
                  </Button>
                  <Link href={`/admin/ogrenciler/${student.id}`}>
                    <ChevronRightIcon className="h-5 w-5 text-muted" />
                  </Link>
                </div>
              </Card>
            ) : (
              <Card key={student.id} className="space-y-3 px-4 py-4">
                <div>
                  <p className="font-serif text-xl">{student.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {getClassGroupById(student.groupId)?.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      router.push(`/admin/ogrenciler/arsiv/${student.id}`)
                    }
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
            ),
          )}
        </div>
      )}

      {pendingArchive ? (
        <ConfirmDialog
          title="Öğrenciyi sil"
          body="Bu öğrenciyi silmek istediğine emin misin?"
          confirmLabel="Sil"
          onCancel={() => setPendingArchive(null)}
          onConfirm={() => {
            archiveStudent(pendingArchive.id);
            setPendingArchive(null);
          }}
        />
      ) : null}

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
