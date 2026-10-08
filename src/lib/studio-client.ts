import type { StudioState, Student } from "@/types/studio";
import { getStudioState, getServerStudioState, setStudioState } from "@/lib/store";

// Successful writes return DB rows, including the new edit-lock timestamp.
export async function studioMutation(path: string, init: RequestInit) {
  const userId = getStudioState().user?.id;
  const response = await fetch(path, { ...init, signal: init.signal ?? AbortSignal.timeout(45000) });
  if (getStudioState().user?.id !== userId) return response;
  if (response.status === 401) {
    setStudioState({ ...getServerStudioState(), user: null });
    return response;
  }
  if (response.ok) {
    const data = await response.clone().json().catch(() => null) as { student?: Student; students?: Student[] } | null;
    const rows = [data?.student, ...(data?.students ?? [])].filter((row): row is Student => Boolean(row));
    if (rows.length) {
      const byId = new Map(rows.map((row) => [row.id, row]));
      setStudioState((current) => ({
        ...current, students: current.students.map((row) => byId.get(row.id) ?? row),
      }));
    }
  }
  return response;
}

export type RemoteStudioData = Pick<
  StudioState,
  "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups"
> & {
  blockedEmails?: string[];
};

export async function fetchStudioData(input?: {
  studentId?: string;
  includeBlockedEmails?: boolean;
}) {
  const params = new URLSearchParams();
  if (input?.studentId) params.set("studentId", input.studentId);
  if (input?.includeBlockedEmails === false) {
    params.set("includeBlockedEmails", "false");
  }
  const query = params.toString();
  const response = await fetch(`/api/studio${query ? `?${query}` : ""}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error("Öğrenci verilerine ulaşılamadı.");
  const data = (await response.json()) as {
    configured?: boolean;
    data?: RemoteStudioData | null;
  };

  if (!response.ok || !data.configured || !data.data) return null;
  return data.data;
}
