import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_STAFF_PASSWORDS } from "@/lib/staff-auth";

const BLOB_STORE_NAME = "oslo-pilates-staff";
const PASSWORD_PREFIX = "password:";

type StaffPasswordBlobAdapter = {
  getHash: (staffId: string) => Promise<string | null>;
  setHash: (staffId: string, hash: string) => Promise<void>;
};

let blobAdapterPromise: Promise<StaffPasswordBlobAdapter | null> | null = null;

async function getBlobAdapter(): Promise<StaffPasswordBlobAdapter | null> {
  if (blobAdapterPromise) return blobAdapterPromise;

  blobAdapterPromise = (async () => {
    try {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore(BLOB_STORE_NAME);

      return {
        async getHash(staffId: string) {
          try {
            const value = await store.get(`${PASSWORD_PREFIX}${staffId}`, {
              type: "text",
            });
            return value || null;
          } catch {
            return null;
          }
        },

        async setHash(staffId: string, hash: string) {
          await store.set(`${PASSWORD_PREFIX}${staffId}`, hash);
        },
      };
    } catch {
      return null;
    }
  })();

  return blobAdapterPromise;
}

function getFileStorePath() {
  return path.join(process.cwd(), ".data", "staff-passwords.json");
}

async function readFileStore(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(getFileStorePath(), "utf8");
    const parsed = JSON.parse(raw) as { passwords?: Record<string, string> };
    return parsed.passwords ?? {};
  } catch {
    return {};
  }
}

async function writeFileStore(passwords: Record<string, string>) {
  const dataDir = path.dirname(getFileStorePath());
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    getFileStorePath(),
    JSON.stringify({ passwords }, null, 2),
    "utf8",
  );
}

/** Stored scrypt hash if changed; otherwise null (caller falls back to default). */
export async function getStaffPasswordHash(
  staffId: string,
): Promise<string | null> {
  const blob = await getBlobAdapter();
  if (blob) return blob.getHash(staffId);

  const passwords = await readFileStore();
  return passwords[staffId] ?? null;
}

export async function setStaffPasswordHash(staffId: string, hash: string) {
  const blob = await getBlobAdapter();
  if (blob) {
    await blob.setHash(staffId, hash);
    return;
  }

  const passwords = await readFileStore();
  passwords[staffId] = hash;
  await writeFileStore(passwords);
}

/** Hash or plaintext default used for verifyPassword. */
export async function resolveStaffPassword(staffId: string): Promise<string> {
  return (
    (await getStaffPasswordHash(staffId)) ??
    DEFAULT_STAFF_PASSWORDS[staffId] ??
    ""
  );
}
