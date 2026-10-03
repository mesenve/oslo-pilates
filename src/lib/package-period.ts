import type { Student } from "@/types/studio";

type PackagePeriodShape = Pick<Student, "packageType" | "groupId"> & {
  package: Pick<Student["package"], "startDate" | "totalSessions" | "customSchedule">;
};

/**
 * A package period changes when its schedule identity changes, not only when
 * the lesson count or start date changes. This key is shared by the client
 * and API so package/group/day transitions cannot be mistaken for edits to
 * the same active period.
 */
export function packagePeriodKey(value: PackagePeriodShape): string {
  const customSchedule = value.package.customSchedule;
  return JSON.stringify([
    value.package.startDate,
    value.package.totalSessions,
    value.packageType,
    value.groupId,
    customSchedule?.days ?? [],
    customSchedule?.time ?? "",
  ]);
}

export function sessionPeriodToken(value: PackagePeriodShape): string {
  return packagePeriodKey(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}
