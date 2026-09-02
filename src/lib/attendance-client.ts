import type { StoredAttendanceMark } from "@/lib/server/attendance-store";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Sunucudan geçerli yanıt alınamadı.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Sunucudan geçerli yanıt alınamadı.");
  }
}

export async function fetchAttendanceMarks(input?: {
  status?: StoredAttendanceMark["status"];
  studentId?: string;
}) {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.studentId) params.set("studentId", input.studentId);
  const query = params.toString();

  const response = await fetch(`/api/attendance${query ? `?${query}` : ""}`);
  const data = await readJsonResponse<{ marks?: StoredAttendanceMark[]; error?: string }>(
    response,
  );

  if (!response.ok) {
    throw new Error(data.error ?? "Yoklama bilgisi alınamadı.");
  }

  return data.marks ?? [];
}

export async function pushAttendanceMark(
  mark: Omit<StoredAttendanceMark, "updatedAt">,
) {
  const response = await fetch("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mark),
  });

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? "Yoklama kaydedilemedi.");
  }
}
