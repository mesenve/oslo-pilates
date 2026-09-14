import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type StudioSnapshotResponse = {
  configured?: boolean;
  snapshot?: unknown;
};

const snapshotPath = path.join(process.cwd(), ".data", "studio.json");
const BLOB_STORE_NAME = "oslo-pilates-studio";
const SNAPSHOT_KEY = "snapshot:current";

async function readStudioSnapshot(): Promise<StudioSnapshotResponse> {
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

async function writeStudioSnapshot(snapshot: StudioSnapshotResponse) {
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
  const response = await readStudioSnapshot();
  if (response.configured && response.snapshot) {
    const snapshot = response.snapshot as {
        students?: Array<{ id: string }>;
        archivedStudents?: Array<{ id: string }>;
        sessions?: Array<{ studentId: string }>;
        postponeRequests?: Array<{ studentId: string }>;
        blockedEmails?: string[];
      };
    const url = new URL(request.url);
    const studentId = url.searchParams.get("studentId")?.trim();
    const includeBlockedEmails =
      url.searchParams.get("includeBlockedEmails") !== "false";

    if (!studentId) {
      return NextResponse.json({
        ...response,
        snapshot: {
          ...snapshot,
          blockedEmails: includeBlockedEmails ? snapshot.blockedEmails ?? [] : [],
        },
      });
    }

    return NextResponse.json({
      ...response,
      snapshot: {
        ...snapshot,
        students: (snapshot.students ?? []).filter(
          (student) => student.id === studentId,
        ),
        archivedStudents: (snapshot.archivedStudents ?? []).filter(
          (student) => student.id === studentId,
        ),
        sessions: (snapshot.sessions ?? []).filter(
          (session) => session.studentId === studentId,
        ),
        postponeRequests: (snapshot.postponeRequests ?? []).filter(
          (postponeRequest) => postponeRequest.studentId === studentId,
        ),
        blockedEmails: includeBlockedEmails ? snapshot.blockedEmails ?? [] : [],
      },
    });
  }

  return NextResponse.json({ configured: false, snapshot: null });
}

export async function POST(request: Request) {
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
