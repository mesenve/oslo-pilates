/**
 * Smoke check: postpone rights are per package period, not calendar month.
 * Run: node scripts/check-postpone-package.mjs
 */

function postponeRequestDate(request, sessions) {
  return sessions.find((item) => item.id === request.sessionId)?.date ?? null;
}

function isDateInPackage(student, date) {
  const startDate = student.package?.startDate;
  const endDate = student.package?.endDate;
  if (!startDate || !endDate || startDate > endDate) return true;
  return date >= startDate && date <= endDate;
}

function postponeUsedInPackage(student, requests, sessions = []) {
  const sessionIds = new Set();
  for (const request of requests) {
    if (request.studentId !== student.id) continue;
    if (request.status === "rejected") continue;
    const date = postponeRequestDate(request, sessions);
    if (!date || !isDateInPackage(student, date)) continue;
    sessionIds.add(request.sessionId);
  }
  return sessionIds.size;
}

function remainingPostponeRights(student, requests, sessions = []) {
  const limit = Math.max(0, student.monthlyPostponeLimit ?? 1);
  const usedFromRequests = postponeUsedInPackage(student, requests, sessions);
  const usedFromFlag = student.postponeLessonUsed ? 1 : 0;
  return Math.max(0, limit - Math.max(usedFromRequests, usedFromFlag));
}

const student = {
  id: "s1",
  monthlyPostponeLimit: 1,
  postponeLessonUsed: false,
  package: { startDate: "2026-09-15", endDate: "2026-10-14" },
};

const sessions = [
  { id: "old-session", date: "2026-09-05" },
  { id: "new-session", date: "2026-09-20" },
];

const priorPackageRequest = {
  id: "r1",
  studentId: "s1",
  sessionId: "old-session",
  status: "approved",
  createdAt: "2026-09-05T10:00:00",
};

const remainingWithOldOnly = remainingPostponeRights(
  student,
  [priorPackageRequest],
  sessions,
);
if (remainingWithOldOnly !== 1) {
  throw new Error(
    `Expected 1 right in new package after prior-package postpone, got ${remainingWithOldOnly}`,
  );
}

const withNewPackageUse = remainingPostponeRights(
  student,
  [
    priorPackageRequest,
    {
      id: "r2",
      studentId: "s1",
      sessionId: "new-session",
      status: "approved",
      createdAt: "2026-09-20T10:00:00",
    },
  ],
  sessions,
);
if (withNewPackageUse !== 0) {
  throw new Error(`Expected 0 rights after package postpone, got ${withNewPackageUse}`);
}

const duplicateSameSession = remainingPostponeRights(
  student,
  [
    priorPackageRequest,
    {
      id: "r2a",
      studentId: "s1",
      sessionId: "new-session",
      status: "approved",
      createdAt: "2026-09-20T10:00:00",
    },
    {
      id: "r2b",
      studentId: "s1",
      sessionId: "new-session",
      status: "approved",
      createdAt: "2026-09-20T11:00:00",
    },
  ],
  sessions,
);
if (duplicateSameSession !== 0) {
  throw new Error(
    `Expected duplicates of same session to count once (0 remaining), got ${duplicateSameSession}`,
  );
}

console.log("check-postpone-package: ok");
