import type { StaffUser } from "@/types/studio";

/** Tek süper admin hesabı — e-posta ile girişte rol buradan gelir. */
export const SUPER_ADMIN_EMAIL = "ecenazkara@hotmail.com";

export const STAFF: StaffUser[] = [
  {
    id: "staff-ece",
    name: "Ece",
    email: SUPER_ADMIN_EMAIL,
    role: "super_admin",
  },
  {
    id: "staff-elif",
    name: "Elif",
    email: "elifbeytas86@gmail.com",
    role: "instructor",
  },
  {
    id: "staff-delfin",
    name: "Delfin",
    email: "21141025@lhu.edu.tr",
    role: "instructor",
  },
];

export function getStaffById(id: string): StaffUser | undefined {
  return STAFF.find((member) => member.id === id);
}

export function instructorLabelForId(id: string) {
  if (id === "staff-delfin" || id === "staff-elif") {
    return "Delfin & Elif";
  }
  return getStaffById(id)?.name ?? "—";
}

export function getStaffByEmail(email: string): StaffUser | undefined {
  const normalized = email.trim().toLowerCase();
  return STAFF.find((member) => member.email.toLowerCase() === normalized);
}

export function isSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function getInstructors(): StaffUser[] {
  return STAFF.filter((member) => member.role === "instructor");
}

/** Öğrenci kaydında atanabilir eğitmenler (Ece dahil). */
export function getAssignableInstructors(): StaffUser[] {
  return [...STAFF].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export const DEFAULT_INSTRUCTOR_ID = "staff-delfin";
