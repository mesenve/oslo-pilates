import { DEFAULT_STAFF_PASSWORDS } from "@/lib/staff-auth";
import {
  getSupabaseStaffPasswordHash,
  isSupabaseConfigured,
  setSupabaseStaffPasswordHash,
} from "@/lib/server/supabase-rest";

/**
 * Staff passwords live in Supabase `staff_credentials` (hashed).
 * Until a row exists, login falls back to the bootstrap default in code.
 */
export async function resolveStaffPassword(staffId: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const stored = await getSupabaseStaffPasswordHash(staffId);
    if (stored) return stored;
  }
  return DEFAULT_STAFF_PASSWORDS[staffId] ?? "";
}

export async function setStaffPasswordHash(staffId: string, hash: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase yapılandırılmadı; staff şifresi kaydedilemez.");
  }
  await setSupabaseStaffPasswordHash(staffId, hash);
}
