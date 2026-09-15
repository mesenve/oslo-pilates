import type { StudioState } from "@/types/studio";

export type RemoteStudioSnapshot = Pick<
  StudioState,
  "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups"
> & {
  blockedEmails?: string[];
};

export type RemoteStudioResult = {
  snapshot: RemoteStudioSnapshot;
  revision?: string;
};

export async function fetchStudioSnapshot(input?: {
  studentId?: string;
  includeBlockedEmails?: boolean;
}) {
  const params = new URLSearchParams();
  if (input?.studentId) params.set("studentId", input.studentId);
  if (input?.includeBlockedEmails === false) {
    params.set("includeBlockedEmails", "false");
  }
  const query = params.toString();
  const response = await fetch(`/api/studio${query ? `?${query}` : ""}`);
  const data = (await response.json()) as {
    configured?: boolean;
    snapshot?: RemoteStudioSnapshot | null;
    revision?: string;
  };

  if (!response.ok || !data.configured || !data.snapshot) return null;
  return { snapshot: data.snapshot, revision: data.revision };
}
