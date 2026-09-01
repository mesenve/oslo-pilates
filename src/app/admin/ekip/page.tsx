"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { TeamPanel } from "@/components/team-board";
import { useStudio } from "@/components/studio-provider";
import { getInstructors } from "@/data/staff";
import Link from "next/link";

export default function TeamPage() {
  const { students } = useStudio();
  const teamCount = getInstructors().length;

  return (
    <div className="space-y-5">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Ana sayfa
      </Link>
      <header>
        <h1 className="font-serif text-3xl">Ekip</h1>
        <p className="mt-1 text-sm text-muted">
          {teamCount} eğitmen · öğrenci listesi için isme tıkla
        </p>
      </header>
      <TeamPanel students={students} />
    </div>
  );
}
