import type { Student } from "@/types/studio";

type PackagePeriodShape = Pick<Student, "packageType"> & {
  package: Pick<Student["package"], "startDate" | "totalSessions" | "customSchedule">;
};

/**
 * The active package period changes only when a new package is started.
 * Program edits (group, days, or time) are schedule changes inside the same
 * package and must preserve package-scoped usage such as postpone rights.
 * This key is shared by the client and API so both sides apply the same rule.
 */
export function packagePeriodKey(value: PackagePeriodShape): string {
  return JSON.stringify([
    value.package.startDate,
    value.package.totalSessions,
    value.packageType,
  ]);
}

export function sessionPeriodToken(value: PackagePeriodShape): string {
  return packagePeriodKey(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}
