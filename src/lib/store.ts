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
const serverSnapshot = memory;
let studioSnapshotPersistenceEnabled = false;
let persistenceQueue: Promise<void> = Promise.resolve();
let persistenceHealthy = true;
let studioSnapshotRevision: string | null = null;
const listeners = new Set<() => void>();

export function getStudioSnapshot(): StudioState {
  return memory;
}

export function getServerStudioSnapshot(): StudioState {
  return serverSnapshot;
}

export function subscribeStudio(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStudioState(
  updater: StudioState | ((current: StudioState) => StudioState),
  options: { persist?: boolean } = {},
) {
  memory = typeof updater === "function" ? updater(memory) : updater;
  if (typeof window !== "undefined") {
    if (options.persist !== false && studioSnapshotPersistenceEnabled && (memory.user?.role === "super_admin" || memory.user?.role === "instructor")) {
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

