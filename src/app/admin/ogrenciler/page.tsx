"use client";

import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { LetterIndex } from "@/components/letter-index";
import { Button, Card, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroupById } from "@/data/groups";
import { firstLetter, sortByName, type TurkishLetter } from "@/lib/alphabet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function StudentsPage() {
  const { students } = useStudio();
  const router = useRouter();
  const sorted = useMemo(() => sortByName(students), [students]);
  const initial =
    sorted.length > 0 ? firstLetter(sorted[0].name) : ("A" as TurkishLetter);
  const [letter, setLetter] = useState<TurkishLetter>(initial);
  const visible = sorted.filter((student) => firstLetter(student.name) === letter);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">Öğrenciler</h1>
        </div>
        <Button onClick={() => router.push("/admin/ogrenciler/yeni")}>
          <PlusIcon className="h-4 w-4" />
          Kaydet
        </Button>
      </header>

      <LetterIndex students={sorted} selected={letter} onSelect={setLetter} />

      {visible.length === 0 ? (
        <EmptyState>Bu harfte kayıtlı öğrenci yok.</EmptyState>
      ) : (
        <div className="space-y-2">
          {visible.map((student) => (
            <Link key={student.id} href={`/admin/ogrenciler/${student.id}`}>
              <Card className="flex items-center justify-between px-4 py-4">
                <div>
                  <p className="font-serif text-xl">{student.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {getClassGroupById(student.groupId)?.label}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
