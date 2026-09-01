import { getClassGroupById, IRREGULAR_GROUP_ID } from "@/data/groups";
import type { PackageType } from "@/types/studio";

export const PACKAGE_TYPES: PackageType[] = ["group_5", "duet_2", "private"];

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  group_5: "5 kişilik grup",
  duet_2: "2 kişilik düet",
  private: "Özel ders",
};

export const SESSION_COUNTS = [8, 12, 24, 36] as const;

export const PACKAGE_PRICES: Record<
  PackageType,
  Record<(typeof SESSION_COUNTS)[number], number>
> = {
  group_5: { 8: 3500, 12: 4500, 24: 9000, 36: 13500 },
  duet_2: { 8: 5000, 12: 6500, 24: 13000, 36: 19500 },
  private: { 8: 7000, 12: 9000, 24: 18000, 36: 27000 },
};

function formatPrice(amount: number) {
  return amount.toLocaleString("tr-TR");
}

export function sessionOptionsForPackage(packageType: PackageType) {
  return SESSION_COUNTS.map((count) => ({
    value: String(count),
    label: `${count} seans · ${formatPrice(PACKAGE_PRICES[packageType][count])} ₺`,
  }));
}

export function inferPackageType(groupId: string): PackageType {
  const group = getClassGroupById(groupId);
  if (!group || group.id === IRREGULAR_GROUP_ID) return "group_5";
  if (group.capacity === 1) return "private";
  if (group.capacity === 2) return "duet_2";
  return "group_5";
}
