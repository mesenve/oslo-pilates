import { createSeedState } from "@/data/seed";
import { getStudents } from "@/data/students";
import { DEFAULT_INSTRUCTOR_ID } from "@/data/staff";
import { hydrateStaffPasswords } from "@/lib/staff-auth";
import { hydrateStudentPasswords } from "@/lib/student-auth";
import type { AuthUser, Student, StudioState } from "@/types/studio";

export const STORAGE_KEY = "oslo-pilates-demo-v11";

let memory: StudioState = createSeedState();
const serverSnapshot = memory;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): StudioState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as StudioState;
    if (!parsed.sessions || !parsed.postponeRequests) {
      return createSeedState();
    }
    const students = (parsed.students?.length ? parsed.students : getStudents()).map(
      hydrateStudent,
    );
    const user = hydrateUser(parsed.user);
    return {
      ...parsed,
      user,
      students,
      archivedStudents: (parsed.archivedStudents ?? []).map(hydrateStudent),
      staffPasswords: hydrateStaffPasswords(parsed.staffPasswords),
      studentPasswords: hydrateStudentPasswords(parsed.studentPasswords),
    };
  } catch {
    return createSeedState();
  }
}

export function getStudioSnapshot(): StudioState {
  return memory;
}

export function getServerStudioSnapshot(): StudioState {
  return serverSnapshot;
}

export function subscribeStudio(listener: () => void) {
  if (typeof window !== "undefined" && !hydrated) {
    memory = readStorage();
    hydrated = true;
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStudioState(
  updater: StudioState | ((current: StudioState) => StudioState),
) {
  memory = typeof updater === "function" ? updater(memory) : updater;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    hydrated = true;
  }
  listeners.forEach((listener) => listener());
}

function hydrateStudent(student: Student): Student {
  return {
    ...student,
    instructorId: student.instructorId ?? DEFAULT_INSTRUCTOR_ID,
    note: student.note ?? "",
    monthlyPostponeLimit: student.monthlyPostponeLimit ?? 1,
    accountStatus: student.accountStatus ?? "active",
  };
}

function hydrateUser(user: AuthUser | null | undefined): AuthUser | null {
  if (!user) return null;
  if ((user.role as string) === "admin") {
    return { ...user, role: "super_admin" };
  }
  return user;
}
