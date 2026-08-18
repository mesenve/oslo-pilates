"use client";

import { firstLetter, TURKISH_LETTERS, type TurkishLetter } from "@/lib/alphabet";
import type { Student } from "@/types/studio";

export function LetterIndex({
  students,
  selected,
  onSelect,
}: {
  students: Student[];
  selected: TurkishLetter;
  onSelect: (letter: TurkishLetter) => void;
}) {
  const counts = new Map<string, number>();
  for (const student of students) {
    const letter = firstLetter(student.name);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  return (
    <div className="hide-scrollbar -mx-1 overflow-x-auto">
      <div className="flex w-max gap-2 px-1 py-1">
        {TURKISH_LETTERS.map((letter) => {
          const active = letter === selected;
          const hasStudents = (counts.get(letter) ?? 0) > 0;
          return (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect(letter)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-[0_6px_14px_rgba(43,26,34,0.1)] ${
                active
                  ? "bg-accent text-white"
                  : hasStudents
                    ? "bg-white text-foreground"
                    : "bg-white/70 text-muted"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
