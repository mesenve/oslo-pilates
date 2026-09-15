import type { DayOfWeek } from "@/types/studio";

const DAY_OFFSET: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function startOfWeekMonday(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function dateForWeekDay(monday: Date, day: DayOfWeek): Date {
  return addDays(monday, DAY_OFFSET[day]);
}

export function todayISO(): string {
  // Ders günleri Türkiye saatine göre belirlenir. Tarayıcı veya Netlify
  // sunucusunun bulunduğu saat dilimi sonucu değiştirmemelidir.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function weekdayFromISO(iso: string): DayOfWeek | null {
  const day = parseISODate(iso).getDay();
  const map: Record<number, DayOfWeek> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
    0: "sunday",
  };
  return map[day] ?? null;
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
}

export function formatInputDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const start = monday.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
  const end = friday.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
  });
  return `${start} – ${end}`;
}

export function isBefore(iso: string, compareISO: string): boolean {
  return iso < compareISO;
}

export function isAtLeast24HoursAway(date: string, time: string, now = new Date()): boolean {
  const match = time.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return false;
  const [year, month, day] = date.split("-").map(Number);
  // Istanbul is UTC+03:00 year-round. Build the lesson instant explicitly in
  // UTC so the rule is identical on a UTC Netlify worker and in a local browser.
  const startsAt = new Date(
    Date.UTC(year, month - 1, day, Number(match[1]) - 3, Number(match[2])),
  );
  return startsAt.getTime() - now.getTime() >= 24 * 60 * 60 * 1000;
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const startOffset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(toISODate(new Date(year, month, day, 12)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
