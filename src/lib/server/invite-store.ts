import type { Session, Student } from "@/types/studio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

        async listActivated() {
          const { blobs } = await store.list({ prefix: TOKEN_PREFIX });
          const invites: StoredInvite[] = [];

          for (const item of blobs) {
            const invite = (await store.get(item.key, {
              type: "json",
            })) as StoredInvite | null;

            if (invite?.activatedAt && invite.password) {
              invites.push(invite);
            }
          }

          return invites;
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

  invite.password = password;
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
  const blobs = await getBlobAdapter();
  if (blobs) {
    await blobs.saveInvite(invite);
    return;
  }

  await saveInviteToFile(invite);
}

export async function getInviteByToken(token: string) {
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.getInvite(token);
  }

  return getInviteFromFile(token);
}

export async function activateInvite(token: string, password: string) {
  const invite = await getInviteByToken(token);
  if (!invite) return null;

  const activated: StoredInvite = {
    ...invite,
    password,
    activatedAt: new Date().toISOString(),
    student: {
      ...invite.student,
      accountStatus: "active",
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    },
  };

  const blobs = await getBlobAdapter();
  if (blobs) {
    await blobs.saveInvite(activated);
    return activated;
  }

  return activateInviteInFile(token, password);
}

export async function findActivatedInviteByEmail(email: string) {
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.findActivatedByEmail(email);
  }

  return findActivatedInviteByEmailInFile(email);
}

export async function listActivatedInvites() {
  const blobs = await getBlobAdapter();
  if (blobs) {
    return blobs.listActivated();
  }

  const store = await readFileStore();
  return Object.values(store.invites).filter(
    (invite) => invite.activatedAt && invite.password,
  );
}

export function inviteTokenFromUrl(link: string) {
  try {
    return new URL(link).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}
