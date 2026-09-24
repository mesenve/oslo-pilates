/**
 * Smoke: studio snapshot merge must not let a stale client overwrite
 * postpone_pending / postponed session status, and must keep server-only
 * postpone requests that the client never saw.
 * Run: node scripts/check-session-merge.mjs
 */

function mergeSessionsServerLocked(current = [], incoming = []) {
  const currentById = new Map(current.map((session) => [session.id, session]));
  const newOnes = incoming.filter((session) => !currentById.has(session.id));
  return [...current, ...newOnes];
}

function mergePostponeServerLocked(current = [], incoming = []) {
  const incomingById = new Map(incoming.map((request) => [request.id, request]));
  return current.map((request) => {
    const client = incomingById.get(request.id);
    if (!client) return request;
    return { ...request, reason: client.reason ?? request.reason };
  });
}

const studentId = "stu-1";

const serverSessions = [
  { id: "stu-1-2026-09-28", studentId, date: "2026-09-28", status: "postpone_pending" },
  { id: "stu-1-2026-09-30", studentId, date: "2026-09-30", status: "upcoming" },
];
const staleClientSessions = [
  { id: "stu-1-2026-09-28", studentId, date: "2026-09-28", status: "upcoming" },
  { id: "stu-1-2026-09-30", studentId, date: "2026-09-30", status: "upcoming" },
  { id: "stu-1-2026-10-02", studentId, date: "2026-10-02", status: "upcoming" },
];

const mergedSessions = mergeSessionsServerLocked(serverSessions, staleClientSessions);
const sept28 = mergedSessions.find((item) => item.id === "stu-1-2026-09-28");
if (sept28?.status !== "postpone_pending") {
  throw new Error(`Expected postpone_pending preserved, got ${sept28?.status}`);
}
if (!mergedSessions.some((item) => item.id === "stu-1-2026-10-02")) {
  throw new Error("Expected brand-new session row to be inserted");
}

const serverRequests = [
  {
    id: "req-new",
    studentId,
    sessionId: "stu-1-2026-09-28",
    status: "pending",
    reason: "",
  },
];
const staleClientRequests = [
  {
    id: "req-client-only",
    studentId,
    sessionId: "stu-1-2026-09-30",
    status: "pending",
    reason: "should not appear",
  },
];
const mergedRequests = mergePostponeServerLocked(serverRequests, staleClientRequests);
if (!mergedRequests.some((item) => item.id === "req-new" && item.status === "pending")) {
  throw new Error("Expected server-only pending request to be kept");
}
if (mergedRequests.some((item) => item.id === "req-client-only")) {
  throw new Error("Client-only postpone request must not be inserted via studio POST");
}

const reasonUpdate = mergePostponeServerLocked(
  serverRequests,
  [{ ...serverRequests[0], reason: "Hoca notu", status: "approved" }],
);
if (reasonUpdate[0]?.reason !== "Hoca notu" || reasonUpdate[0]?.status !== "pending") {
  throw new Error("Expected client reason update with server status kept");
}

console.log("check-session-merge: ok");
