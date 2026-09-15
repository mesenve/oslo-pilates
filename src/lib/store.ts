import { createSeedState } from "@/data/seed";
import { getStudents } from "@/data/students";
import { DEFAULT_INSTRUCTOR_ID } from "@/data/staff";
import { hydrateStaffPasswords } from "@/lib/staff-auth";
import { hydrateStudentPasswords } from "@/lib/student-auth";
import type { AuthUser, Student, StudioState } from "@/types/studio";

// v13: Eski tarayıcı önbelleğinin güncel yerel stüdyo verisini geri yazmasını önler.
export const STORAGE_KEY = "oslo-pilates-demo-v13";

let memory: StudioState = createSeedState();
const serverSnapshot = memory;
let hydrated = false;
let studioSnapshotPersistenceEnabled = false;
let persistenceQueue: Promise<void> = Promise.resolve();
let persistenceHealthy = true;
let studioSnapshotRevision: string | null = null;
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
      customGroups: parsed.customGroups ?? [],
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
    if (studioSnapshotPersistenceEnabled && (memory.user?.role === "super_admin" || memory.user?.role === "instructor")) {
      const snapshot = {
        students: memory.students,
        archivedStudents: memory.archivedStudents,
        sessions: memory.sessions,
        postponeRequests: memory.postponeRequests,
        customGroups: memory.customGroups,
      };
      persistenceQueue = persistenceQueue.then(async () => {
        const response = await fetch("/api/studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, revision: studioSnapshotRevision }),
        });
        const data = (await response.json().catch(() => null)) as { revision?: string } | null;
        if (response.ok) {
          persistenceHealthy = true;
          if (data?.revision) studioSnapshotRevision = data.revision;
        }
        if (response.status === 409) {
          studioSnapshotPersistenceEnabled = false;
          persistenceHealthy = false;
        }
        if (!response.ok && typeof window !== "undefined") {
          persistenceHealthy = false;
          window.dispatchEvent(new CustomEvent("studio:persistence-error"));
        }
      }).catch(() => {
        persistenceHealthy = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("studio:persistence-error"));
        }
      });
    }
  }
  listeners.forEach((listener) => listener());
}

export function enableStudioSnapshotPersistence() {
  studioSnapshotPersistenceEnabled = true;
  persistenceHealthy = true;
}

/** Wait until all queued snapshot writes have settled before a destructive action. */
export async function flushStudioSnapshotPersistence() {
  await persistenceQueue;
  return persistenceHealthy;
}

export function setStudioSnapshotRevision(revision: string | null | undefined) {
  studioSnapshotRevision = revision ?? null;
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
