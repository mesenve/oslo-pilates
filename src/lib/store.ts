import { createSeedState } from "@/data/seed";
import { getStudents } from "@/data/students";
import type { StudioState } from "@/types/studio";

export const STORAGE_KEY = "oslo-pilates-demo-v5";

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
    return {
      ...parsed,
      students: (parsed.students ?? getStudents()).map((student) => ({
        ...student,
        note: student.note ?? "",
      })),
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
