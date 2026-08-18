import type { ClassGroup } from "@/types/studio";

export function getClassGroups(): ClassGroup[] {
  return CLASS_GROUPS;
}

export function getClassGroupById(id: string): ClassGroup | undefined {
  return CLASS_GROUPS.find((group) => group.id === id);
}

export function getClassGroupsForDay(day: ClassGroup["days"][number]): ClassGroup[] {
  return CLASS_GROUPS.filter((group) => group.days.includes(day));
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
    id: "pzt-car-1200",
    days: ["monday", "wednesday"],
    time: "12.00",
    capacity: 1,
    label: "Pazartesi–Çarşamba 12.00",
  },
  {
    id: "pzt-per-1900",
    days: ["monday", "thursday"],
    time: "19.00",
    capacity: 1,
    label: "Pazartesi–Perşembe 19.00",
  },
  {
    id: "sal-per-1100",
    days: ["tuesday", "thursday"],
    time: "11.00",
    capacity: 3,
    label: "Salı–Perşembe 11.00",
  },
  {
    id: "sal-per-1800",
    days: ["tuesday", "thursday"],
    time: "18.00",
    capacity: 2,
    label: "Salı–Perşembe 18.00",
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
    id: "sal-per-2100",
    days: ["tuesday", "thursday"],
    time: "21.00",
    capacity: 3,
    label: "Salı–Perşembe 21.00",
  },
];
