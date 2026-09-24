import type {
  DayOfWeek,
  PaymentStatus,
  PostponeStatus,
  SessionStatus,
} from "@/types/studio";

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Pazartesi",
  tuesday: "Salı",
  wednesday: "Çarşamba",
  thursday: "Perşembe",
  friday: "Cuma",
  saturday: "Cumartesi",
  sunday: "Pazar",
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Pzt",
  tuesday: "Sal",
  wednesday: "Çar",
  thursday: "Per",
  friday: "Cum",
  saturday: "Cmt",
  sunday: "Paz",
};

export const CALENDAR_HEADERS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const WEEKDAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Ödendi",
  pending: "Ödenmedi",
  overdue: "Ödenmedi",
};

export const SESSION_LABELS: Record<SessionStatus, string> = {
  upcoming: "Bekleniyor",
  attend_pending: "Onay bekliyor",
  attended: "Geldi",
  missed: "Yandı",
  postpone_pending: "Erteleme talebi",
  postponed: "Ertelendi",
};

export const REQUEST_LABELS: Record<PostponeStatus, string> = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export function capacityLabel(count: number) {
  return count === 1 ? "1 kişilik" : `${count} kişilik`;
}

export function remainingLabel(count: number) {
  return count === 1 ? "1 ders kaldı" : `${count} ders kaldı`;
}

export function postponeRightLabel(
  remaining: number,
  limit: number,
  usedDate?: string | null,
) {
  if (limit <= 0) return "Erteleme hakkı yok.";
  if (remaining <= 0) {
    return usedDate
      ? `Bu pakette erteleme hakkını ${formatShortDate(usedDate)} tarihinde kullandın.`
      : "Bu pakette erteleme hakkını kullandın.";
  }
  return remaining === 1
    ? "Bu pakette 1 erteleme hakkın var."
    : `Bu pakette ${remaining} erteleme hakkın var.`;
}

export function postponeRightAdminLabel(
  used: number,
  limit: number,
  usedDate?: string | null,
) {
  const base = `Bu pakette ${used}/${limit} erteleme hakkı`;
  return usedDate ? `${base} · ${formatShortDate(usedDate)}` : base;
}

function formatShortDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso.slice(0, 10);
  return new Date(year, month - 1, day, 12).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
