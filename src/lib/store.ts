import type { StudioState } from "@/types/studio";

// Supabase is the sole source of truth for studio data. The in-memory store is
// only a render cache and is intentionally never hydrated from browser storage.
const emptyStudioState: StudioState = {
  user: null,
  students: [],
  archivedStudents: [],
  sessions: [],
  postponeRequests: [],
  customGroups: [],
  staffPasswords: {},
  studentPasswords: {},
};

let memory: StudioState = emptyStudioState;
const serverState = memory;
const listeners = new Set<() => void>();

export function getStudioState(): StudioState {
  return memory;
}

export function getServerStudioState(): StudioState {
  return serverState;
}

export function subscribeStudio(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStudioState(
  updater: StudioState | ((current: StudioState) => StudioState),
) {
  memory = typeof updater === "function" ? updater(memory) : updater;
  listeners.forEach((listener) => listener());
}

