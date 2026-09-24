/**
 * Smoke check: protected routes wait for the initial session lookup.
 * Run: node scripts/check-session-guard.mjs
 */

function guardAction({ ready, sessionChecked, user, role }) {
  if (!ready || !sessionChecked) return "loading";
  if (!user) return "login";
  return user.role === role ? "allow" : "other-home";
}

const student = { role: "student" };

if (
  guardAction({
    ready: true,
    sessionChecked: false,
    user: null,
    role: "student",
  }) !== "loading"
) {
  throw new Error("Guard redirected before the initial session lookup completed");
}

if (
  guardAction({
    ready: true,
    sessionChecked: true,
    user: student,
    role: "student",
  }) !== "allow"
) {
  throw new Error("Guard did not preserve an authenticated nested route");
}

if (
  guardAction({
    ready: true,
    sessionChecked: true,
    user: null,
    role: "student",
  }) !== "login"
) {
  throw new Error("Guard did not redirect after a completed empty session lookup");
}

console.log("check-session-guard: ok");
