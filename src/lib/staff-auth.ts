import { DEMO_ACCOUNTS } from "@/data/students";

export const DEFAULT_STAFF_PASSWORDS: Record<string, string> = {
  "staff-ece": DEMO_ACCOUNTS.super_admin.password,
  "staff-elif": DEMO_ACCOUNTS.instructor_elif.password,
  "staff-delfin": DEMO_ACCOUNTS.instructor_delfin.password,
};

export function getStaffPassword(
  staffId: string,
  passwords: Record<string, string> | undefined,
): string {
  return passwords?.[staffId] ?? DEFAULT_STAFF_PASSWORDS[staffId] ?? "";
}

export function hydrateStaffPasswords(
  passwords: Record<string, string> | undefined,
): Record<string, string> {
  return { ...DEFAULT_STAFF_PASSWORDS, ...passwords };
}

export function validateNewPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (newPassword.length < 6) {
    return "Yeni şifre en az 6 karakter olmalı.";
  }
  if (newPassword !== confirmPassword) {
    return "Yeni şifreler eşleşmiyor.";
  }
  if (newPassword === currentPassword) {
    return "Yeni şifre mevcut şifreden farklı olmalı.";
  }
  return null;
}
