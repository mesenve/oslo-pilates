"use client";

import { ChevronRightIcon, CloseIcon } from "@/components/icons";
import { CustomScrollArea } from "@/components/custom-scroll-area";
import { Card } from "@/components/ui";
import { getInstructors } from "@/data/staff";
import { sortByName } from "@/lib/alphabet";
import { isStudentAssignedToInstructor } from "@/lib/access";
import type { Student } from "@/types/studio";
import Link from "next/link";
import { useEffect, useState } from "react";

export function TeamPanel({ students }: { students: Student[] }) {
  const instructors = getInstructors();
  const [selected, setSelected] = useState<{
    name: string;
    students: Student[];
  } | null>(null);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {instructors.map((instructor) => {
          const members = students.filter(
            (student) => isStudentAssignedToInstructor(student, instructor.id),
          );
          return (
            <InstructorTeamCard
              key={instructor.id}
              name={instructor.name}
              count={members.length}
              onOpen={() =>
                setSelected({ name: instructor.name, students: members })
              }
            />
          );
        })}
      </div>
      {selected ? (
        <InstructorStudentsModal
          name={selected.name}
          students={selected.students}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

function InstructorTeamCard({
  name,
  count,
  onOpen,
}: {
  name: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-white/40"
      >
        <div>
          <p className="font-serif text-xl">{name}</p>
          <p className="mt-1 text-sm text-muted">{count} öğrenci</p>
        </div>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-muted" />
      </button>
    </Card>
  );
}

function InstructorStudentsModal({
  name,
  students,
  onClose,
}: {
  name: string;
  students: Student[];
  onClose: () => void;
}) {
  const members = sortByName(students);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-[#2b1a22]/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-modal-title"
        className="relative z-10 flex max-h-[min(80vh,640px)] w-full max-w-md flex-col rounded-3xl border border-white/80 bg-white shadow-[0_18px_40px_rgba(194,24,91,0.18)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <p id="team-modal-title" className="font-serif text-2xl">
              {name}
            </p>
            <p className="mt-1 text-sm text-muted">{members.length} öğrenci</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <CustomScrollArea className="min-h-0 flex-1" viewportClassName="px-3 py-3">
          {members.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">Kayıtlı öğrenci yok.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/admin/ogrenciler/${student.id}`}
                    onClick={onClose}
                    className="block rounded-xl px-3 py-2.5 text-sm hover:bg-surface-muted/80"
                  >
                    {student.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CustomScrollArea>
      </div>
    </div>
  );
}
