import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  isSupabaseConfigured,
  listSupabaseAttendance,
  saveSupabaseAttendance,
} from "@/lib/server/supabase-rest";

export type AttendanceMarkStatus = "attend_pending" | "attended" | "upcoming";

export type StoredAttendanceMark = {
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: AttendanceMarkStatus;
  updatedAt: string;
};

type AttendanceStore = {
  marks: Record<string, StoredAttendanceMark>;
};

const BLOB_STORE_NAME = "oslo-pilates-attendance";
const MARK_PREFIX = "mark:";

type AttendanceBlobAdapter = {
  saveMark: (mark: StoredAttendanceMark) => Promise<void>;
  getMark: (sessionId: string) => Promise<StoredAttendanceMark | null>;
  listMarks: (filter?: {
    status?: AttendanceMarkStatus;
    studentId?: string;
  }) => Promise<StoredAttendanceMark[]>;
};

let blobAdapterPromise: Promise<AttendanceBlobAdapter | null> | null = null;

async function getBlobAdapter(): Promise<AttendanceBlobAdapter | null> {
  if (blobAdapterPromise) return blobAdapterPromise;

  blobAdapterPromise = (async () => {
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore(BLOB_STORE_NAME);

      return {
        async saveMark(mark: StoredAttendanceMark) {
          await store.setJSON(`${MARK_PREFIX}${mark.sessionId}`, mark);
        },

        async getMark(sessionId: string) {
          try {
            return (await store.get(`${MARK_PREFIX}${sessionId}`, {
              type: "json",
            })) as StoredAttendanceMark | null;
          } catch {
            return null;
          }
        },

        async listMarks(filter) {
          const { blobs } = await store.list({ prefix: MARK_PREFIX });
          const marks: StoredAttendanceMark[] = [];

          for (const item of blobs) {
            const mark = (await store.get(item.key, {
              type: "json",
            })) as StoredAttendanceMark | null;
            if (!mark) continue;
            if (filter?.status && mark.status !== filter.status) continue;
            if (filter?.studentId && mark.studentId !== filter.studentId) continue;
            marks.push(mark);
          }

          return marks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        },
      };
    } catch {
      return null;
    }
  })();

  return blobAdapterPromise;
}

function getFileStorePath() {
  return path.join(process.cwd(), ".data", "attendance.json");
}

async function readFileStore(): Promise<AttendanceStore> {
  try {
    const raw = await readFile(getFileStorePath(), "utf8");
    return JSON.parse(raw) as AttendanceStore;
  } catch {
    return { marks: {} };
  }
}

async function writeFileStore(store: AttendanceStore) {
  const dataDir = path.dirname(getFileStorePath());
  await mkdir(dataDir, { recursive: true });
  await writeFile(getFileStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function saveAttendanceMark(input: {
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: AttendanceMarkStatus;
}) {
  const mark: StoredAttendanceMark = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    await saveSupabaseAttendance({
      session_id: mark.sessionId,
      student_id: mark.studentId,
      session_date: mark.date,
      group_id: mark.groupId,
      status: mark.status,
      updated_at: mark.updatedAt,
    });
    return mark;
  }

  const blobs = await getBlobAdapter();
  if (blobs) {
    await blobs.saveMark(mark);
    return mark;
  }

  const store = await readFileStore();
  store.marks[mark.sessionId] = mark;
  await writeFileStore(store);
  return mark;
}

export async function listAttendanceMarks(filter?: {
  status?: AttendanceMarkStatus;
  studentId?: string;
}) {
  if (isSupabaseConfigured()) {
    const marks = (await listSupabaseAttendance()).map((mark) => ({
      sessionId: mark.session_id,
      studentId: mark.student_id,
      date: mark.session_date,
      groupId: mark.group_id,
      status: mark.status,
      updatedAt: mark.updated_at ?? new Date().toISOString(),
    }));
    return marks.filter((mark) =>
      (!filter?.status || mark.status === filter.status) &&
      (!filter?.studentId || mark.studentId === filter.studentId),
    );
  }
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.listMarks(filter);
  }

  const store = await readFileStore();
  return Object.values(store.marks)
    .filter((mark) => {
      if (filter?.status && mark.status !== filter.status) return false;
      if (filter?.studentId && mark.studentId !== filter.studentId) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
