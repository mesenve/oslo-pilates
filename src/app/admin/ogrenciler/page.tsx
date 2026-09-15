"use client";

import { ChevronRightIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { LetterIndex } from "@/components/letter-index";
import { Button, Card, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { remainingSessions } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { instructorLabelForId } from "@/data/staff";
import { firstLetter, sortByName, type TurkishLetter } from "@/lib/alphabet";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function StudentsPage() {
  const { visibleStudents, visibleSessions, isSuperAdmin } = useStudio();
  const router = useRouter();
  const sorted = useMemo(() => sortByName(visibleStudents), [visibleStudents]);
  const initial =
    sorted.length > 0 ? firstLetter(sorted[0].name) : ("A" as TurkishLetter);
  const [letter, setLetter] = useState<TurkishLetter>(initial);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visible = sorted.filter((student) => {
    if (!normalizedQuery) return firstLetter(student.name) === letter;
    return [student.name, student.email].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(normalizedQuery),
    );
  });
  function exportExcel() {
    const header = ["Ad soyad", "E-posta", "Telefon", "Eğitmen", "Paket başlangıcı", "Kalan ders", "Ödeme"];
    const rows = sorted.map((student) => [
      student.name,
      student.email,
      student.phone,
      instructorLabelForId(student.instructorId),
      student.package.startDate,
      String(remainingSessions(student, visibleSessions)),
      student.package.paymentStatus === "paid" ? "Ödendi" : "Ödenmedi",
    ]);
    const escapeXml = (value: string) => value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
    const rowXml = (row: string[]) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Öğrenciler"><Table>${rowXml(header)}${rows.map(rowXml).join("")}</Table></Worksheet></Workbook>`;
    const url = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `oslo-pilates-ogrenciler-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl">
            {isSuperAdmin ? "Öğrenciler" : "Öğrencilerim"}
          </h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={exportExcel}>Excel dışa aktar</Button>
          <Button onClick={() => router.push("/admin/ogrenciler/yeni")}>
            <PlusIcon className="h-4 w-4" />
            Kaydet
          </Button>
        </div>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-accent" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Öğrenci ara"
          aria-label="Öğrenci ara"
          className="w-full rounded-2xl border border-white/80 bg-white/75 py-3 pl-12 pr-11 text-sm text-foreground shadow-[0_8px_24px_rgba(194,24,91,0.06)] outline-none transition placeholder:text-muted focus:border-accent/40 focus:ring-4 focus:ring-accent-soft/60"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <LetterIndex students={sorted} selected={letter} onSelect={setLetter} />

      {visible.length === 0 ? (
        <EmptyState>
          {normalizedQuery
            ? "Aramanla eşleşen öğrenci yok."
            : "Bu harfte kayıtlı öğrenci yok."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((student) => (
            <Link
              key={student.id}
              href={`/admin/ogrenciler/${student.id}`}
              className="block"
            >
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
