// Run: node scripts/check-renewal-start.mjs
import assert from "node:assert/strict";
import { renewalStartDate } from "../src/lib/package-period.ts";

const student = (endDate, requestedStartDate) => ({
  package: { endDate },
  renewalRequest: requestedStartDate ? { requestedStartDate } : undefined,
});

// Early renewal keeps remaining lessons: start the day after the current package ends.
assert.equal(renewalStartDate(student("2026-10-09"), "2026-10-08"), "2026-10-10");
// Month rollover.
assert.equal(renewalStartDate(student("2026-10-31"), "2026-10-20"), "2026-11-01");
// Package already over: start today.
assert.equal(renewalStartDate(student("2026-10-01"), "2026-10-08"), "2026-10-08");
// A later preferred date wins.
assert.equal(renewalStartDate(student("2026-10-09", "2026-10-20"), "2026-10-08"), "2026-10-20");
// An earlier preferred date cannot cut the current package short.
assert.equal(renewalStartDate(student("2026-10-09", "2026-10-08"), "2026-10-08"), "2026-10-10");

console.log("renewalStartDate ok");
