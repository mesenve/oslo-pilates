import type { StaffUser } from "@/types/studio";

/** Tek süper admin hesabı — e-posta ile girişte rol buradan gelir. */
export const SUPER_ADMIN_EMAIL = "ecenazkara@hotmail.com";

/** Ortak çalışan eğitmen çifti — ikisi de birbirinin öğrencilerini yönetir. */
export const SHARED_INSTRUCTOR_IDS = ["staff-elif", "staff-ayse"] as const;

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
    id: "staff-ayse",
    name: "Ayşe",
    email: "ayse_1114@icloud.com",
    role: "instructor",
  },
];

export function isSharedInstructorId(id: string) {
  return (SHARED_INSTRUCTOR_IDS as readonly string[]).includes(id);
}

export function getStaffById(id: string): StaffUser | undefined {
  return STAFF.find((member) => member.id === id);
}

export function instructorLabelForId(id: string) {
  if (isSharedInstructorId(id)) {
    return "Elif & Ayşe";
  }
  return getStaffById(id)?.name ?? "—";
}

export function getStaffByEmail(email: string): StaffUser | undefined {
  const normalized = email.trim().toLowerCase();
  return STAFF.find((member) => member.email.toLowerCase() === normalized);
}

export function isSuperAdminEmail(email: string) {
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function getInstructors(): StaffUser[] {
  return STAFF.filter((member) => member.role === "instructor");
}

/** Öğrenci kaydında atanabilir eğitmenler (Ece dahil). */
export function getAssignableInstructors(): StaffUser[] {
  return [...STAFF].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export const DEFAULT_INSTRUCTOR_ID = "staff-elif";
