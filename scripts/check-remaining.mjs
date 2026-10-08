// Run: node scripts/check-remaining.mjs
import assert from "node:assert/strict";
import { countRemainingSessions } from "../src/lib/remaining.ts";

const today = "2026-10-08";
const total = 12;

assert.equal(
  countRemainingSessions(
    total,
    [
      { date: "2026-10-01", status: "attended" },
      { date: "2026-10-03", status: "missed" },
      { date: "2026-10-06", status: "upcoming" }, // past unmarked
      { date: "2026-10-07", status: "postpone_pending" }, // past pending keeps seat
      { date: "2026-10-09", status: "upcoming" },
      { date: "2026-10-11", status: "postpone_pending" },
      { date: "2026-10-13", status: "postponed" },
    ],
    today,
  ),
  9, // 12 - attended - missed - past unmarked; postponed / pending still owed
);

assert.equal(
  countRemainingSessions(
    total,
    [
      { date: "2026-10-09", status: "upcoming" },
      { date: "2026-10-10", status: "attend_pending" },
    ],
    today,
  ),
  12,
);

console.log("countRemainingSessions ok");
