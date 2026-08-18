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
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Pzt",
  tuesday: "Sal",
  wednesday: "Çar",
  thursday: "Per",
  friday: "Cum",
};

export const CALENDAR_HEADERS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export const WEEKDAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Ödendi",
  pending: "Beklemede",
  overdue: "Gecikmiş",
};

export const SESSION_LABELS: Record<SessionStatus, string> = {
  upcoming: "Bekliyor",
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

export function postponeRightLabel(remaining: number, limit: number) {
  if (limit <= 0) return "Erteleme hakkı yok.";
  if (remaining <= 0) return "Bu ay erteleme hakkını kullandın.";
  return remaining === 1
    ? "Bu ay 1 erteleme hakkın var."
    : `Bu ay ${remaining} erteleme hakkın var.`;
}

export function postponeRightAdminLabel(used: number, limit: number) {
  return `Bu ay ${used}/${limit} erteleme hakkı`;
}
