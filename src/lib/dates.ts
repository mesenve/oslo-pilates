import type { DayOfWeek } from "@/types/studio";

const DAY_OFFSET: Record<DayOfWeek, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
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
  return toISODate(new Date());
}

export function weekdayFromISO(iso: string): DayOfWeek | null {
  const day = parseISODate(iso).getDay();
  const map: Record<number, DayOfWeek> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
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
