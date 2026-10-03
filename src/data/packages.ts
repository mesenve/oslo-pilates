import { getClassGroupById, IRREGULAR_GROUP_ID } from "@/data/groups";
import type { PackageType } from "@/types/studio";

export const PACKAGE_TYPES: PackageType[] = ["group_5", "duet_2", "private"];

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  group_5: "5 kişilik grup",
  duet_2: "2 kişilik düet",
  private: "Özel ders",
};

export const SESSION_COUNTS = [8, 12, 24, 36] as const;

export function sessionOptionsForPackage() {
  return SESSION_COUNTS.map((count) => ({
    value: String(count),
    label: `${count} seans`,
  }));
}

export function inferPackageType(groupId: string): PackageType {
  const group = getClassGroupById(groupId);
  if (!group || group.id === IRREGULAR_GROUP_ID) return "group_5";
  if (group.capacity === 1) return "private";
  if (group.capacity === 2) return "duet_2";
  return "group_5";
}
