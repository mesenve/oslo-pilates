import {
  getSupabaseStaffPasswordHash,
  isSupabaseConfigured,
  setSupabaseStaffPasswordHash,
} from "@/lib/server/supabase-rest";

/**
 * Staff passwords live in Supabase `staff_credentials` (hashed).
 * A missing DB row is a service/configuration error, never a default password.
 */
export async function resolveStaffPassword(staffId: string): Promise<string> {
  if (isSupabaseConfigured()) {
    const stored = await getSupabaseStaffPasswordHash(staffId);
    if (stored) return stored;
    throw new Error("Eğitmen giriş bilgisi bulunamadı.");
  }
  throw new Error("Supabase yapılandırılmadı; giriş bilgileri okunamıyor.");
}

export async function setStaffPasswordHash(staffId: string, hash: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase yapılandırılmadı; staff şifresi kaydedilemez.");
  }
  await setSupabaseStaffPasswordHash(staffId, hash);
}
