import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
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

function sign(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken(secret, kind, accountId, email) {
  const body = Buffer.from(
    JSON.stringify({
      kind,
      accountId,
      email: email.toLowerCase(),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

function verifyToken(secret, token) {
  const [body, provided] = token.split(".");
  if (!body || !provided) return null;
  const expected = sign(secret, body);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

const hash = await hashPassword("ece123tmp");
if (!(await verifyPassword("ece123tmp", hash)) || (await verifyPassword("ece123", hash))) {
  console.error("FAIL hash/verify");
  process.exit(1);
}

const secret = "local-development-session-secret";
const studentTok = createToken(secret, "student", "stu-1", "a@b.com");
const staffTok = createToken(secret, "staff", "staff-ece", "ece@x.com");
const s = verifyToken(secret, studentTok);
const t = verifyToken(secret, staffTok);
if (s?.kind !== "student" || t?.kind !== "staff" || verifyToken(secret, "bad.token")) {
  console.error("FAIL reset token", { s, t });
  process.exit(1);
}

console.log("ok password hash + reset token (student/staff)");
