import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { groupIdForSchedule, groupLabelForSchedule } from "@/data/groups";
import { todayISO } from "@/lib/dates";
import type { ClassGroup, DayOfWeek } from "@/types/studio";

type StudioSnapshotResponse = {
  configured?: boolean;
  snapshot?: unknown;
};

const snapshotPath = path.join(process.cwd(), ".data", "studio.json");
const BLOB_STORE_NAME = "oslo-pilates-studio";
const SNAPSHOT_KEY = "snapshot:current";

type SnapshotStudent = {
  id: string;
  groupId: string;
  package?: {
    customSchedule?: { days?: DayOfWeek[]; time?: string };
  };
};

type SnapshotSession = {
  studentId: string;
  groupId: string;
  date?: string;
  status?: string;
};

type SnapshotStudentIdentity = {
  id: string;
  email?: string;
};

function hasDuplicateStudentEmail(students: SnapshotStudentIdentity[] = []) {
  const seen = new Set<string>();
  for (const student of students) {
    const email = student.email?.trim().toLowerCase();
    if (!email || email === "—") continue;
    if (seen.has(email)) return true;
    seen.add(email);
  }
  return false;
}

function normalizeFutureAttendanceStatuses(snapshot: Record<string, unknown>) {
  const sessions = (snapshot.sessions ?? []) as SnapshotSession[];
  let changed = false;
  const normalizedSessions = sessions.map((session) => {
    if (
      session.date &&
      session.date > todayISO() &&
      (session.status === "attended" || session.status === "missed")
    ) {
      changed = true;
      return { ...session, status: "upcoming" };
    }
    return session;
  });
  return {
    changed,
    snapshot: changed ? { ...snapshot, sessions: normalizedSessions } : snapshot,
  };
}

function normalizeCustomScheduleGroups(snapshot: Record<string, unknown>) {
  const students = (snapshot.students ?? []) as SnapshotStudent[];
  const customGroups = ((snapshot.customGroups ?? []) as ClassGroup[]).filter((group) => {
    const time = group.time?.trim();
    return group.days.length > 0 && Boolean(time) && time !== "Belirtilmedi" && time !== "—";
  });
  const originalCustomGroupCount = ((snapshot.customGroups ?? []) as ClassGroup[]).length;
  const groups = new Map(customGroups.map((group) => [group.id, group]));
  const replacementGroupIds = new Map<string, string>();

  const normalizedStudents = students.map((student) => {
    const schedule = student.package?.customSchedule;
    const days = schedule?.days ?? [];
    const time = schedule?.time?.trim() ?? "";
    if (!days.length || !time) return student;

    const groupId = groupIdForSchedule(days, time);
    replacementGroupIds.set(student.id, groupId);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        days,
        time,
        capacity: 2,
        label: groupLabelForSchedule(days, time),
      });
    }
    return student.groupId === groupId ? student : { ...student, groupId };
  });

  const normalizedSessions = ((snapshot.sessions ?? []) as SnapshotSession[]).map(
    (session) => {
      const groupId = replacementGroupIds.get(session.studentId);
      return groupId && session.groupId !== groupId ? { ...session, groupId } : session;
    },
  );
  const changed =
    normalizedStudents.some((student, index) => student !== students[index]) ||
    normalizedSessions.some(
      (session, index) => session !== ((snapshot.sessions ?? []) as SnapshotSession[])[index],
    ) ||
    groups.size !== originalCustomGroupCount;

  return {
    changed,
    snapshot: changed
      ? { ...snapshot, students: normalizedStudents, sessions: normalizedSessions, customGroups: [...groups.values()] }
      : snapshot,
  };
}

export async function readStudioSnapshot(): Promise<StudioSnapshotResponse> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE_NAME);
    const snapshot = (await store.get(SNAPSHOT_KEY, {
      type: "json",
    })) as StudioSnapshotResponse | null;
    if (snapshot?.configured && snapshot.snapshot) return snapshot;
  } catch {
    // Yerelde veya Netlify Blobs erişilemezse yerel dosya kullanılır.
  }

  try {
    return JSON.parse(await readFile(snapshotPath, "utf8")) as StudioSnapshotResponse;
  } catch {
    return {};
  }
}

export async function writeStudioSnapshot(snapshot: StudioSnapshotResponse) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE_NAME);
    await store.setJSON(SNAPSHOT_KEY, snapshot);
    return;
  } catch {
    // Yerelde Netlify Blobs yoksa yerel dosya kullanılır.
  }

  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const response = await readStudioSnapshot();
  if (response.configured && response.snapshot) {
    const normalizedGroups = normalizeCustomScheduleGroups(
      response.snapshot as Record<string, unknown>,
    );
    const normalized = normalizeFutureAttendanceStatuses(normalizedGroups.snapshot);
    if (normalizedGroups.changed || normalized.changed) {
      await writeStudioSnapshot({ ...response, snapshot: normalized.snapshot });
    }
    const snapshot = normalized.snapshot as {
        students?: Array<{ id: string; instructorId: string; groupId?: string }>;
        archivedStudents?: Array<{ id: string; instructorId: string }>;
        sessions?: Array<{ studentId: string }>;
        postponeRequests?: Array<{ studentId: string }>;
        customGroups?: Array<{ id: string }>;
        blockedEmails?: string[];
        staffPasswords?: Record<string, string>;
      };
    const { staffPasswords: _staffPasswords, ...publicSnapshot } = snapshot;
    const visibleStudentIds = new Set(
      user.role === "super_admin"
        ? (snapshot.students ?? []).map((student) => student.id)
        : user.role === "student"
          ? [user.id]
          : (snapshot.students ?? [])
              .filter((student) => student.instructorId === user.id ||
                (["staff-delfin", "staff-elif"].includes(student.instructorId) && ["staff-delfin", "staff-elif"].includes(user.id)))
              .map((student) => student.id),
    );

    return NextResponse.json({
      ...response,
      snapshot: {
          ...publicSnapshot,
        students: (snapshot.students ?? []).filter((student) => visibleStudentIds.has(student.id)),
        archivedStudents: user.role === "super_admin"
          ? snapshot.archivedStudents ?? []
          : (snapshot.archivedStudents ?? []).filter((student) => visibleStudentIds.has(student.id)),
        sessions: (snapshot.sessions ?? []).filter((session) => visibleStudentIds.has(session.studentId)),
        postponeRequests: (snapshot.postponeRequests ?? []).filter((request) => visibleStudentIds.has(request.studentId)),
        blockedEmails: user.role === "super_admin" ? snapshot.blockedEmails ?? [] : [],
      },
    });
  }

  return NextResponse.json({ configured: false, snapshot: null });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin" && user?.role !== "instructor") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { snapshot?: unknown };
    if (!body.snapshot || typeof body.snapshot !== "object") {
      return NextResponse.json({ error: "Geçersiz stüdyo verisi." }, { status: 400 });
    }

    const existing = await readStudioSnapshot();

    const currentSnapshot =
      existing.snapshot && typeof existing.snapshot === "object"
        ? existing.snapshot
        : {};
    if (user.role === "instructor") {
      const current = currentSnapshot as {
        students?: Array<{ id: string; instructorId: string; groupId?: string }>;
        archivedStudents?: Array<{ id: string; instructorId: string }>;
        sessions?: Array<{ studentId: string }>;
        postponeRequests?: Array<{ studentId: string }>;
        customGroups?: Array<{ id: string }>;
      };
      const incoming = body.snapshot as typeof current;
      const shared = ["staff-delfin", "staff-elif"];
      const owns = (student: { instructorId: string }) =>
        student.instructorId === user.id ||
        (shared.includes(student.instructorId) && shared.includes(user.id));
      const existingOwnedIds = new Set((current.students ?? []).filter(owns).map((student) => student.id));
      const incomingStudents = (incoming.students ?? []).filter((student) =>
        existingOwnedIds.has(student.id) || owns(student),
      ).map((student) => existingOwnedIds.has(student.id)
        ? { ...student, instructorId: (current.students ?? []).find((item) => item.id === student.id)?.instructorId ?? student.instructorId }
        : student,
      );
      const allowedIds = new Set(incomingStudents.map((student) => student.id));
      const mergeByStudent = <T extends { studentId: string }>(existing: T[] = [], updated: T[] = []) => [
        ...existing.filter((item) => !allowedIds.has(item.studentId)),
        ...updated.filter((item) => allowedIds.has(item.studentId)),
      ];
      const existingGroupIds = new Set((current.customGroups ?? []).map((group) => group.id));
      const groupsCreatedForOwnedStudents = (incoming.customGroups ?? []).filter(
        (group) =>
          !existingGroupIds.has(group.id) &&
          incomingStudents.some((student) => student.groupId === group.id),
      );
      const mergedStudents = [
        ...(current.students ?? []).filter((student) => !existingOwnedIds.has(student.id)),
        ...incomingStudents,
      ];
      if (hasDuplicateStudentEmail(mergedStudents)) {
        return NextResponse.json(
          { error: "Bu e-posta ile kayıtlı başka bir öğrenci var." },
          { status: 409 },
        );
      }
      await writeStudioSnapshot({
        configured: true,
        snapshot: {
          ...current,
          students: mergedStudents,
          archivedStudents: current.archivedStudents,
          sessions: mergeByStudent(current.sessions, incoming.sessions),
          postponeRequests: mergeByStudent(current.postponeRequests, incoming.postponeRequests),
          customGroups: [...(current.customGroups ?? []), ...groupsCreatedForOwnedStudents],
        },
      });
      return NextResponse.json({ ok: true });
    }

    const currentForValidation = currentSnapshot as {
      students?: SnapshotStudentIdentity[];
      archivedStudents?: SnapshotStudentIdentity[];
    };
    const currentStudents = currentForValidation.students ?? [];
    const currentArchived = currentForValidation.archivedStudents ?? [];
    const incomingSnapshot = body.snapshot as {
      students?: SnapshotStudentIdentity[];
      archivedStudents?: SnapshotStudentIdentity[];
    };
    const incomingStudents = incomingSnapshot.students ?? [];
    const incomingArchived = incomingSnapshot.archivedStudents ?? [];
    const currentTotal = currentStudents.length + currentArchived.length;
    const incomingTotal = incomingStudents.length + incomingArchived.length;

    // A stale browser must never be able to replace the studio with a much
    // smaller cached list. A single intentional permanent deletion remains
    // possible, while a partial sync is rejected and refreshed instead.
    if (incomingTotal < currentTotal - 1) {
      return NextResponse.json(
        { error: "Eksik öğrenci listesi kaydedilmedi. Sayfayı yenileyip tekrar dene." },
        { status: 409 },
      );
    }
    if (hasDuplicateStudentEmail([...incomingStudents, ...incomingArchived])) {
      return NextResponse.json(
        { error: "Bu e-posta ile kayıtlı başka bir öğrenci var." },
        { status: 409 },
      );
    }

    const next = {
      configured: true,
      snapshot: { ...currentSnapshot, ...body.snapshot },
    };

    await writeStudioSnapshot(next);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Stüdyo verisi kaydedilemedi." },
      { status: 500 },
    );
  }
}
