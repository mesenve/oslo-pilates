import type { Session, Student } from "@/types/studio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "@/lib/server/staff-credentials";
import {
  getSupabaseInvite,
  activateSupabaseStudent,
  deleteSupabaseInvite,
  isSupabaseConfigured,
  listSupabaseInvites,
  saveSupabaseInvite,
  type SupabaseInviteRow,
} from "@/lib/server/supabase-rest";

export type StoredInvite = {
  token: string;
  student: Student;
  sessions: Session[];
  expiresAt: string;
  password?: string;
  activatedAt?: string;
};

type InviteStore = {
  invites: Record<string, StoredInvite>;
};

const BLOB_STORE_NAME = "oslo-pilates-invites";
const TOKEN_PREFIX = "token:";
const STUDENT_INDEX_PREFIX = "student:";

type InviteBlobAdapter = {
  getInvite: (token: string) => Promise<StoredInvite | null>;
  getInviteByStudentId: (studentId: string) => Promise<StoredInvite | null>;
  saveInvite: (invite: StoredInvite) => Promise<void>;
  findActivatedByEmail: (email: string) => Promise<StoredInvite | null>;
  listActivated: () => Promise<StoredInvite[]>;
};

let blobAdapterPromise: Promise<InviteBlobAdapter | null> | null = null;

async function getBlobAdapter(): Promise<InviteBlobAdapter | null> {
  if (blobAdapterPromise) return blobAdapterPromise;

  blobAdapterPromise = (async () => {
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore(BLOB_STORE_NAME);

      return {
        async getInvite(token: string) {
          try {
            return (await store.get(`${TOKEN_PREFIX}${token}`, {
              type: "json",
            })) as StoredInvite | null;
          } catch {
            return null;
          }
        },

        async saveInvite(invite: StoredInvite) {
          const indexKey = `${STUDENT_INDEX_PREFIX}${invite.student.id}`;
          const previousToken = await store.get(indexKey, { type: "text" });

          if (previousToken) {
            await store.delete(`${TOKEN_PREFIX}${previousToken}`);
          }

          await store.setJSON(`${TOKEN_PREFIX}${invite.token}`, invite);
          await store.set(indexKey, invite.token);
        },

        async findActivatedByEmail(email: string) {
          const normalized = email.trim().toLowerCase();
          const { blobs } = await store.list({ prefix: TOKEN_PREFIX });
          const invites = await Promise.all(
            blobs.map(async (item) =>
              (await store.get(item.key, { type: "json" })) as StoredInvite | null,
            ),
          );

          return (
            invites.find(
              (invite) =>
                invite?.student.email.toLowerCase() === normalized &&
                invite.password &&
                invite.activatedAt,
            ) ?? null
          );
        },

        async getInviteByStudentId(studentId: string) {
          try {
            const token = await store.get(`${STUDENT_INDEX_PREFIX}${studentId}`, {
              type: "text",
            });
            if (!token) return null;
            return (await store.get(`${TOKEN_PREFIX}${token}`, {
              type: "json",
            })) as StoredInvite | null;
          } catch {
            return null;
          }
        },

        async listActivated() {
          const { blobs } = await store.list({ prefix: TOKEN_PREFIX });
          const invites = await Promise.all(
            blobs.map(async (item) =>
              (await store.get(item.key, { type: "json" })) as StoredInvite | null,
            ),
          );

          return invites.filter(
            (invite): invite is StoredInvite => Boolean(invite?.activatedAt && invite.password),
          );
        },
      };
    } catch {
      return null;
    }
  })();

  return blobAdapterPromise;
}

function getFileStorePath() {
  return path.join(process.cwd(), ".data", "invites.json");
}

async function readFileStore(): Promise<InviteStore> {
  try {
    const raw = await readFile(getFileStorePath(), "utf8");
    return JSON.parse(raw) as InviteStore;
  } catch {
    return { invites: {} };
  }
}

async function writeFileStore(store: InviteStore) {
  const dataDir = path.dirname(getFileStorePath());
  await mkdir(dataDir, { recursive: true });
  await writeFile(getFileStorePath(), JSON.stringify(store, null, 2), "utf8");
}

async function saveInviteToFile(invite: StoredInvite) {
  const store = await readFileStore();

  for (const [token, existing] of Object.entries(store.invites)) {
    if (existing.student.id === invite.student.id) {
      delete store.invites[token];
    }
  }

  store.invites[invite.token] = invite;
  await writeFileStore(store);
}

async function getInviteFromFile(token: string) {
  const store = await readFileStore();
  return store.invites[token] ?? null;
}

async function activateInviteInFile(token: string, password: string) {
  const store = await readFileStore();
  const invite = store.invites[token];
  if (!invite) return null;

  invite.password = await hashPassword(password);
  invite.activatedAt = new Date().toISOString();
  invite.student = {
    ...invite.student,
    accountStatus: "active",
    inviteToken: undefined,
    inviteExpiresAt: undefined,
  };

  await writeFileStore(store);
  return invite;
}

async function findActivatedInviteByEmailInFile(email: string) {
  const store = await readFileStore();
  const normalized = email.trim().toLowerCase();

  return (
    Object.values(store.invites).find(
      (invite) =>
        invite.student.email.toLowerCase() === normalized &&
        invite.password &&
        invite.activatedAt,
    ) ?? null
  );
}

export async function saveInvite(invite: StoredInvite) {
  if (isSupabaseConfigured()) {
    const existing = (await listSupabaseInvites()).find((row) => row.student_id === invite.student.id);
    // Keep the existing password/activation when re-saving an invite token.
    // Wiping them on resend locked activated students out of login.
    await saveSupabaseInvite({
      token: invite.token,
      student_id: invite.student.id,
      student: invite.student,
      sessions: invite.sessions,
      expires_at: invite.expiresAt,
      password: invite.password ?? existing?.password ?? null,
      activated_at: invite.activatedAt ?? existing?.activated_at ?? null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (existing && existing.token !== invite.token) {
      await deleteSupabaseInvite(existing.token);
    }
    return;
  }
  const blobs = await getBlobAdapter();
  if (blobs) {
    await blobs.saveInvite(invite);
    return;
  }

  await saveInviteToFile(invite);
}

export async function getInviteByToken(token: string) {
  if (isSupabaseConfigured()) {
    const row = await getSupabaseInvite(token);
    return row ? fromSupabaseRow(row) : null;
  }
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.getInvite(token);
  }

  return getInviteFromFile(token);
}

export async function getInviteByStudentId(studentId: string) {
  if (isSupabaseConfigured()) {
    const rows = await listSupabaseInvites();
    const row = rows.find((item) => item.student_id === studentId);
    return row ? fromSupabaseRow(row) : null;
  }
  const blobs = await getBlobAdapter();
  if (blobs) return blobs.getInviteByStudentId(studentId);

  const store = await readFileStore();
  return (
    Object.values(store.invites).find(
      (invite) => invite.student.id === studentId,
    ) ?? null
  );
}

export async function activateInvite(token: string, password: string) {
  const invite = await getInviteByToken(token);
  if (!invite) return null;

  const activated: StoredInvite = {
    ...invite,
    password: await hashPassword(password),
    activatedAt: new Date().toISOString(),
    student: {
      ...invite.student,
      accountStatus: "active",
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    },
  };

  if (isSupabaseConfigured()) {
    await activateSupabaseStudent(activated.student.id);
    await saveSupabaseInvite({
      token: activated.token,
      student_id: activated.student.id,
      student: activated.student,
      sessions: activated.sessions,
      expires_at: activated.expiresAt,
      password: activated.password,
      activated_at: activated.activatedAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return activated;
  }

  const blobs = await getBlobAdapter();
  if (blobs) {
    await blobs.saveInvite(activated);
    return activated;
  }

  return activateInviteInFile(token, password);
}

export async function findActivatedInviteByEmail(email: string) {
  if (isSupabaseConfigured()) {
    const normalized = email.trim().toLowerCase();
    const rows = await listSupabaseInvites();
    const row = rows.find(
      (item) => item.student.email.toLowerCase() === normalized && item.password && item.activated_at,
    );
    return row ? fromSupabaseRow(row) : null;
  }
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.findActivatedByEmail(email);
  }

  return findActivatedInviteByEmailInFile(email);
}

export async function listActivatedInvites() {
  if (isSupabaseConfigured()) {
    return (await listSupabaseInvites())
      .filter((row) => row.activated_at && row.password)
      .map(fromSupabaseRow);
  }
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.listActivated();
  }

  const store = await readFileStore();
  return Object.values(store.invites).filter(
    (invite) => invite.activatedAt && invite.password,
  );
}

function fromSupabaseRow(row: SupabaseInviteRow): StoredInvite {
  return {
    token: row.token,
    student: row.student,
    sessions: row.sessions ?? [],
    expiresAt: row.expires_at,
    password: row.password ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  };
}

export async function setInvitePassword(studentId: string, password: string) {
  const invite = await getInviteByStudentId(studentId);
  if (!invite) return null;
  const hashed = await hashPassword(password);
  const next: StoredInvite = {
    ...invite,
    password: hashed,
    activatedAt: invite.activatedAt ?? new Date().toISOString(),
    student: {
      ...invite.student,
      accountStatus: "active",
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    },
  };
  if (isSupabaseConfigured()) {
    await activateSupabaseStudent(studentId);
    await saveSupabaseInvite({
      token: next.token,
      student_id: next.student.id,
      student: next.student,
      sessions: next.sessions,
      expires_at: next.expiresAt,
      password: next.password ?? null,
      activated_at: next.activatedAt ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return next;
  }
  await saveInvite(next);
  return next;
}

export function inviteTokenFromUrl(link: string) {
  try {
    return new URL(link).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}

