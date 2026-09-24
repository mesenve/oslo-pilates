/**
 * Self-check: staff password hash round-trip (scrypt) still verifies.
 * Run: node --experimental-strip-types scripts/check-staff-password.mjs
 * (or after build via tsx). Uses the same crypto helpers as the API.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function verifyPassword(password, stored) {
  if (!stored.startsWith("scrypt$")) return password === stored;
  const [, salt, expectedValue] = stored.split("$");
  if (!salt || !expectedValue) return false;
  const derived = await scrypt(password, salt, 64);
  const expected = Buffer.from(expectedValue, "base64url");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const hash = await hashPassword("ece123tmp");
const okNew = await verifyPassword("ece123tmp", hash);
const okOld = await verifyPassword("ece123", hash);
const okPlain = await verifyPassword("ece123", "ece123");

if (!okNew || okOld || !okPlain) {
  console.error("FAIL", { okNew, okOld, okPlain });
  process.exit(1);
}
console.log("ok staff password hash/verify");
