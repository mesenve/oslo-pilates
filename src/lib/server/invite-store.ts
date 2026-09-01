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

function getDataDir() {
  if (
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL
  ) {
    return path.join("/tmp", "oslo-pilates");
  }
  return path.join(process.cwd(), ".data");
}

function getStorePath() {
  return path.join(getDataDir(), "invites.json");
}

async function readStore(): Promise<InviteStore> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    return JSON.parse(raw) as InviteStore;
  } catch {
    return { invites: {} };
  }
}

async function writeStore(store: InviteStore) {
  const dataDir = getDataDir();
  await mkdir(dataDir, { recursive: true });
  await writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf8");
}

export async function saveInvite(invite: StoredInvite) {
  const store = await readStore();

  for (const [token, existing] of Object.entries(store.invites)) {
    if (existing.student.id === invite.student.id) {
      delete store.invites[token];
    }
  }

  store.invites[invite.token] = invite;
  await writeStore(store);
}

export async function getInviteByToken(token: string) {
  const store = await readStore();
  return store.invites[token];
}

export async function activateInvite(token: string, password: string) {
  const store = await readStore();
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

  await writeStore(store);
  return invite;
}

export async function findActivatedInviteByEmail(email: string) {
  const store = await readStore();
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

export function inviteTokenFromUrl(link: string) {
  try {
    return new URL(link).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}
