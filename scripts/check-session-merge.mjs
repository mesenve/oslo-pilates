/**
 * Smoke: studio snapshot merge must not let a stale client overwrite
 * postpone_pending / postponed session status, and must keep server-only
 * postpone requests that the client never saw.
 * Run: node scripts/check-session-merge.mjs
 */

function mergeSessionsKeepServerStatus(current = [], incoming = [], incomingStudentIds) {
  const currentById = new Map(current.map((session) => [session.id, session]));
  const nextForStudents = incoming.map((session) => {
    const existing = currentById.get(session.id);
    if (!existing) return session;
    return { ...session, status: existing.status };
  });
  return [
    ...current.filter((session) => !incomingStudentIds.has(session.studentId)),
    ...nextForStudents,
  ];
}

function mergePostponePreferServer(current = [], incoming = [], incomingStudentIds) {
  const kept = current.filter((request) => !incomingStudentIds.has(request.studentId));
  const serverForStudents = current.filter((request) =>
    incomingStudentIds.has(request.studentId),
  );
  const serverById = new Map(serverForStudents.map((request) => [request.id, request]));
  const incomingById = new Map(incoming.map((request) => [request.id, request]));
  const ids = new Set([...serverById.keys(), ...incomingById.keys()]);
  const merged = [...ids].map((id) => {
    const server = serverById.get(id);
    const client = incomingById.get(id);
    if (server && client) {
      return { ...server, reason: client.reason ?? server.reason };
    }
    return server ?? client;
  });
  return [...kept, ...merged];
}

const studentId = "stu-1";
const ids = new Set([studentId]);

const serverSessions = [
  { id: "stu-1-2026-09-28", studentId, date: "2026-09-28", status: "postpone_pending" },
  { id: "stu-1-2026-09-30", studentId, date: "2026-09-30", status: "upcoming" },
];
const staleClientSessions = [
  { id: "stu-1-2026-09-28", studentId, date: "2026-09-28", status: "upcoming" },
  { id: "stu-1-2026-09-30", studentId, date: "2026-09-30", status: "upcoming" },
];

const mergedSessions = mergeSessionsKeepServerStatus(
  serverSessions,
  staleClientSessions,
  ids,
);
const sept28 = mergedSessions.find((item) => item.id === "stu-1-2026-09-28");
if (sept28?.status !== "postpone_pending") {
  throw new Error(`Expected postpone_pending preserved, got ${sept28?.status}`);
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
const staleClientRequests = [];
const mergedRequests = mergePostponePreferServer(
  serverRequests,
  staleClientRequests,
  ids,
);
if (!mergedRequests.some((item) => item.id === "req-new" && item.status === "pending")) {
  throw new Error("Expected server-only pending request to be kept");
}

const reasonUpdate = mergePostponePreferServer(
  serverRequests,
  [{ ...serverRequests[0], reason: "Hoca notu" }],
  ids,
);
if (reasonUpdate[0]?.reason !== "Hoca notu" || reasonUpdate[0]?.status !== "pending") {
  throw new Error("Expected client reason update with server status kept");
}

console.log("check-session-merge: ok");
