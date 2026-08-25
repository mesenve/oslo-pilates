import type { StaffUser } from "@/types/studio";

export const STAFF: StaffUser[] = [
  {
    id: "staff-ece",
    name: "Ece",
    email: "ece@oslo",
    role: "super_admin",
  },
  {
    id: "staff-elif",
    name: "Elif",
    email: "elif.hoca@oslo",
    role: "instructor",
  },
  {
    id: "staff-delfin",
    name: "Delfin",
    email: "delfin.hoca@oslo",
    role: "instructor",
  },
];

export function getStaffById(id: string): StaffUser | undefined {
  return STAFF.find((member) => member.id === id);
}

export function getStaffByEmail(email: string): StaffUser | undefined {
  return STAFF.find(
    (member) => member.email.toLowerCase() === email.toLowerCase(),
  );
}

export function getInstructors(): StaffUser[] {
  return STAFF.filter((member) => member.role === "instructor");
}

export const DEFAULT_INSTRUCTOR_ID = "staff-delfin";
