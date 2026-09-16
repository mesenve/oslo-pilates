import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { groupIdForSchedule, groupLabelForSchedule } from "@/data/groups";
import { todayISO } from "@/lib/dates";
import type { ClassGroup, DayOfWeek } from "@/types/studio";
import { deleteSupabaseStudent, isSupabaseConfigured, readSupabaseSnapshot, writeSupabaseSnapshot } from "@/lib/server/supabase-rest";
import { createHash } from "node:crypto";

type StudioSnapshotResponse = {
  configured?: boolean;
  snapshot?: unknown;
};

const snapshotPath = path.join(process.cwd(), ".data", "studio.json");
const BLOB_STORE_NAME = "oslo-pilates-studio";
const SNAPSHOT_KEY = "snapshot:current";

export function snapshotRevision(snapshot: unknown) {
  const value = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
  const sortById = (rows: unknown) => [...(Array.isArray(rows) ? rows : [])]
    .sort((a, b) => String((a as { id?: string }).id).localeCompare(String((b as { id?: string }).id)));
  const stable = {
    students: sortById(value.students),
    archivedStudents: sortById(value.archivedStudents),
    sessions: sortById(value.sessions),
    postponeRequests: sortById(value.postponeRequests),
    customGroups: sortById(value.customGroups),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 24);
}

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

function mergeById<T extends { id: string }>(current: T[] = [], incoming: T[] = []) {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const currentIds = new Set(current.map((item) => item.id));
  return [
    ...current.map((item) => incomingById.get(item.id) ?? item),
    ...incoming.filter((item) => !currentIds.has(item.id)),
  ];
}

function mergeStudentRows<T extends { studentId: string }>(
  current: T[] = [],
  incoming: T[] = [],
  incomingStudentIds: Set<string>,
) {
  return [
    ...current.filter((item) => !incomingStudentIds.has(item.studentId)),
    ...incoming,
  ];
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
  if (isSupabaseConfigured()) {
    try {
      const snapshot = await readSupabaseSnapshot();
      return { configured: true, snapshot };
    } catch {
      // Supabase geçici olarak erişilemiyorsa mevcut Blob fallback'i kullanılır.
    }
  }
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
  if (isSupabaseConfigured() && snapshot.snapshot && typeof snapshot.snapshot === "object") {
    const value = snapshot.snapshot as {
      students?: Parameters<typeof writeSupabaseSnapshot>[0]["students"];
      archivedStudents?: Parameters<typeof writeSupabaseSnapshot>[0]["archivedStudents"];
      sessions?: Parameters<typeof writeSupabaseSnapshot>[0]["sessions"];
      postponeRequests?: Parameters<typeof writeSupabaseSnapshot>[0]["postponeRequests"];
      customGroups?: Parameters<typeof writeSupabaseSnapshot>[0]["customGroups"];
    };
    await writeSupabaseSnapshot({
      students: value.students ?? [],
      archivedStudents: value.archivedStudents ?? [],
      sessions: value.sessions ?? [],
      postponeRequests: value.postponeRequests ?? [],
      customGroups: value.customGroups ?? [],
    });
    return;
  }
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
        studentPasswords?: Record<string, string>;
      };
    const { staffPasswords: _staffPasswords, studentPasswords: _studentPasswords, ...publicSnapshot } = snapshot;
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
      revision: snapshotRevision(snapshot),
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
    const body = (await request.json()) as { snapshot?: unknown; revision?: string | null };
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
      const existingGroupIds = new Set((current.customGroups ?? []).map((group) => group.id));
      const groupsCreatedForOwnedStudents = (incoming.customGroups ?? []).filter(
        (group) =>
          !existingGroupIds.has(group.id) &&
          incomingStudents.some((student) => student.groupId === group.id),
      );
      const incomingOwnedIds = new Set(incomingStudents.map((student) => student.id));
      const mergedStudents = mergeById(current.students ?? [], incomingStudents);
      if (hasDuplicateStudentEmail(mergedStudents)) {
        return NextResponse.json(
          { error: "Bu e-posta ile kayıtlı başka bir öğrenci var." },
          { status: 409 },
        );
      }
      const savedSnapshot = {
        ...current,
        students: mergedStudents,
        archivedStudents: current.archivedStudents,
        sessions: mergeStudentRows(current.sessions, incoming.sessions, incomingOwnedIds),
        postponeRequests: mergeStudentRows(current.postponeRequests, incoming.postponeRequests, incomingOwnedIds),
        customGroups: [...(current.customGroups ?? []), ...groupsCreatedForOwnedStudents],
      };
      await writeStudioSnapshot({
        configured: true,
        snapshot: savedSnapshot,
      });
      return NextResponse.json({ ok: true, revision: snapshotRevision(savedSnapshot) });
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
    if (hasDuplicateStudentEmail([...incomingStudents, ...incomingArchived])) {
      return NextResponse.json(
        { error: "Bu e-posta ile kayıtlı başka bir öğrenci var." },
        { status: 409 },
      );
    }

    const mergedStudents = mergeById(currentStudents, incomingStudents);
    const incomingActiveIds = new Set(incomingStudents.map((student) => student.id));
    const mergedArchivedStudents = mergeById(currentArchived, incomingArchived)
      .filter((student) => !incomingActiveIds.has(student.id));
    const incomingStudentIds = new Set([
      ...incomingStudents.map((student) => student.id),
      ...incomingArchived.map((student) => student.id),
    ]);
    const currentValue = currentSnapshot as {
      sessions?: Array<{ id: string; studentId: string }>;
      postponeRequests?: Array<{ id: string; studentId: string }>;
      customGroups?: Array<{ id: string }>;
    };
    const incomingValue = body.snapshot as {
      sessions?: Array<{ id: string; studentId: string }>;
      postponeRequests?: Array<{ id: string; studentId: string }>;
      customGroups?: Array<{ id: string }>;
    };
    const next = {
      configured: true,
      snapshot: {
        ...currentSnapshot,
        ...body.snapshot,
        students: mergedStudents,
        archivedStudents: mergedArchivedStudents,
        sessions: mergeStudentRows(currentValue.sessions, incomingValue.sessions, incomingStudentIds),
        postponeRequests: mergeStudentRows(
          currentValue.postponeRequests,
          incomingValue.postponeRequests,
          incomingStudentIds,
        ),
        customGroups: mergeById(currentValue.customGroups, incomingValue.customGroups),
      },
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

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin" && user?.role !== "instructor") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as { studentId?: string };
    const studentId = body.studentId?.trim();
    if (!studentId) return NextResponse.json({ error: "Öğrenci kimliği gerekli." }, { status: 400 });

    const current = await readStudioSnapshot();
    const snapshot = (current.snapshot ?? {}) as {
      students?: Array<{ id: string; instructorId: string }>;
      archivedStudents?: Array<{ id: string; instructorId: string }>;
    };
    const student = [...(snapshot.students ?? []), ...(snapshot.archivedStudents ?? [])]
      .find((item) => item.id === studentId);
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    if (user.role === "instructor") {
      const shared = ["staff-delfin", "staff-elif"];
      const allowed = student.instructorId === user.id ||
        (shared.includes(student.instructorId) && shared.includes(user.id));
      if (!allowed) return NextResponse.json({ error: "Bu öğrenci sana atanmamış." }, { status: 403 });
    }

    if (isSupabaseConfigured()) await deleteSupabaseStudent(studentId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Öğrenci silinemedi." }, { status: 500 });
  }
}
