import type { ClassGroup } from "@/types/studio";

export const IRREGULAR_GROUP_ID = "duzensiz";
export const NEW_GROUP_ID = "yeni-grup";
let customGroups: ClassGroup[] = [];

const IRREGULAR_GROUP: ClassGroup = {
  id: IRREGULAR_GROUP_ID,
  days: [],
  time: "—",
  capacity: 0,
  label: "Düzensiz öğrenci",
};

export function isIrregularGroup(groupId: string) {
  return groupId === IRREGULAR_GROUP_ID;
}

export function getClassGroups(): ClassGroup[] {
  return [...CLASS_GROUPS, ...customGroups];
}

export function setCustomGroups(groups: ClassGroup[]) {
  customGroups = groups;
}

export function groupIdForSchedule(days: ClassGroup["days"], time: string) {
  const dayPart = days.map((day) => ({ monday: "pzt", tuesday: "sal", wednesday: "car", thursday: "per", friday: "cum", saturday: "cmt", sunday: "paz" })[day]).join("-");
  return `${dayPart}-${time.replace(/[^0-9]/g, "")}`;
}

export function groupLabelForSchedule(days: ClassGroup["days"], time: string) {
  const labels = { monday: "Pazartesi", tuesday: "Salı", wednesday: "Çarşamba", thursday: "Perşembe", friday: "Cuma", saturday: "Cumartesi", sunday: "Pazar" };
  return `${days.map((day) => labels[day]).join("–")} ${time}`;
}

export function getGroupSelectOptions(): {
  value: string;
  label: string;
  separatorBefore?: boolean;
}[] {
  return [
    ...getClassGroups().map((group) => ({
      value: group.id,
      label: group.label,
    })),
    {
      value: IRREGULAR_GROUP_ID,
      label: IRREGULAR_GROUP.label,
      separatorBefore: true,
    },
    { value: NEW_GROUP_ID, label: "+ Yeni grup oluştur", separatorBefore: true },
  ];
}

export function getClassGroupById(id: string): ClassGroup | undefined {
  if (id === IRREGULAR_GROUP_ID) return IRREGULAR_GROUP;
  return getClassGroups().find((group) => group.id === id);
}

export function getClassGroupsForDay(day: ClassGroup["days"][number]): ClassGroup[] {
  return getClassGroups().filter((group) => group.days.includes(day));
}

const CLASS_GROUPS: ClassGroup[] = [
  {
    id: "pzt-car-cum-0915",
    days: ["monday", "wednesday", "friday"],
    time: "09.15",
    capacity: 2,
    label: "Pazartesi–Çarşamba–Cuma 09.15",
  },
  {
    id: "pzt-car-cum-1000",
    days: ["monday", "wednesday", "friday"],
    time: "10.00",
    capacity: 2,
    label: "Pazartesi–Çarşamba–Cuma 10.00",
  },
  {
    id: "pzt-car-cum-1100",
    days: ["monday", "wednesday", "friday"],
    time: "11.00",
    capacity: 2,
    label: "Pazartesi–Çarşamba–Cuma 11.00",
  },
  {
    id: "pzt-car-cum-1800",
    days: ["monday", "wednesday", "friday"],
    time: "18.00",
    capacity: 2,
    label: "Pazartesi–Çarşamba–Cuma 18.00",
  },
  {
    id: "pzt-car-1200",
    days: ["monday", "wednesday"],
    time: "12.00",
    capacity: 1,
    label: "Pazartesi–Çarşamba 12.00",
  },
  {
    id: "pzt-car-1600",
    days: ["monday", "wednesday"],
    time: "16.00",
    capacity: 2,
    label: "Pazartesi–Çarşamba 16.00",
  },
  {
    id: "pzt-car-1700",
    days: ["monday", "wednesday"],
    time: "17.00",
    capacity: 2,
    label: "Pazartesi–Çarşamba 17.00",
  },
  {
    id: "pzt-per-1900",
    days: ["monday", "thursday"],
    time: "19.00",
    capacity: 1,
    label: "Pazartesi–Perşembe 19.00",
  },
  {
    id: "sal-per-1000",
    days: ["tuesday", "thursday"],
    time: "10.00",
    capacity: 2,
    label: "Salı–Perşembe 10.00",
  },
  {
    id: "sal-per-1100",
    days: ["tuesday", "thursday"],
    time: "11.00",
    capacity: 3,
    label: "Salı–Perşembe 11.00",
  },
  {
    id: "sal-per-1600",
    days: ["tuesday", "thursday"],
    time: "16.00",
    capacity: 2,
    label: "Salı–Perşembe 16.00",
  },
  {
    id: "sal-per-1800",
    days: ["tuesday", "thursday"],
    time: "18.00",
    capacity: 2,
    label: "Salı–Perşembe 18.00",
  },
  {
    id: "sal-per-2100",
    days: ["tuesday", "thursday"],
    time: "21.00",
    capacity: 3,
    label: "Salı–Perşembe 21.00",
  },
  {
    id: "sal-1900-cum-2000",
    days: ["tuesday", "friday"],
    time: "19.00 / 20.00",
    timeByDay: { tuesday: "19.00", friday: "20.00" },
    capacity: 5,
    label: "Salı 19.00 – Cuma 20.00",
  },
  {
    id: "sal-cum-1400",
    days: ["tuesday", "friday"],
    time: "14.00",
    capacity: 2,
    label: "Salı–Cuma 14.00",
  },
  {
    id: "car-cum-1500",
    days: ["wednesday", "friday"],
    time: "15.00",
    capacity: 2,
    label: "Çarşamba–Cuma 15.00",
  },
  {
    id: "car-cum-1600",
    days: ["wednesday", "friday"],
    time: "16.00",
    capacity: 2,
    label: "Çarşamba–Cuma 16.00",
  },
  {
    id: "car-cum-1900",
    days: ["wednesday", "friday"],
    time: "19.00",
    capacity: 2,
    label: "Çarşamba–Cuma 19.00",
  },
];
