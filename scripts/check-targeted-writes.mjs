/**
 * Smoke: studio data is read-only as a collection; every mutation uses a
 * targeted API. Run: node scripts/check-targeted-writes.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const studioRoute = read("src/app/api/studio/route.ts");
if (/export\s+async\s+function\s+(POST|PATCH|DELETE)\b/.test(studioRoute)) {
  throw new Error("/api/studio must remain read-only");
}

const store = read("src/lib/store.ts");
if (/fetch\s*\(|persistence|revision/i.test(store)) {
  throw new Error("Client store must remain an in-memory render cache");
}

for (const route of [
  "src/app/api/students/route.ts",
  "src/app/api/postpone-requests/route.ts",
  "src/app/api/sessions/status/route.ts",
  "src/app/api/renewals/route.ts",
]) {
  if (!read(route).includes("export async function")) {
    throw new Error(`Missing targeted route: ${route}`);
  }
}

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}

for (const path of sourceFiles(fileURLToPath(new URL("src/", root)))) {
  const source = readFileSync(path, "utf8");
  if (/\bsnapshot\b/i.test(source)) {
    throw new Error(`Legacy snapshot concept remains in ${path}`);
  }
}

console.log("check-targeted-writes: ok");
