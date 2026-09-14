import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

type StudioSnapshotResponse = {
  configured?: boolean;
  snapshot?: unknown;
};

const snapshotPath = path.join(process.cwd(), ".data", "studio.json");
const BLOB_STORE_NAME = "oslo-pilates-studio";
const SNAPSHOT_KEY = "snapshot:current";

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
    const snapshot = response.snapshot as {
        students?: Array<{ id: string; instructorId: string }>;
        archivedStudents?: Array<{ id: string; instructorId: string }>;
        sessions?: Array<{ studentId: string }>;
        postponeRequests?: Array<{ studentId: string }>;
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
        students?: Array<{ id: string; instructorId: string }>;
        archivedStudents?: Array<{ id: string; instructorId: string }>;
        sessions?: Array<{ studentId: string }>;
        postponeRequests?: Array<{ studentId: string }>;
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
      await writeStudioSnapshot({
        configured: true,
        snapshot: {
          ...current,
          students: [...(current.students ?? []).filter((student) => !existingOwnedIds.has(student.id)), ...incomingStudents],
          archivedStudents: current.archivedStudents,
          sessions: mergeByStudent(current.sessions, incoming.sessions),
          postponeRequests: mergeByStudent(current.postponeRequests, incoming.postponeRequests),
        },
      });
      return NextResponse.json({ ok: true });
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
