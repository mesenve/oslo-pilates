import type { ClassGroup } from "@/types/studio";

export const IRREGULAR_GROUP_ID = "duzensiz";
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
  const byId = new Map<string, ClassGroup>();
  for (const group of CLASS_GROUPS) byId.set(group.id, group);
  for (const group of customGroups.filter(hasUsableSchedule)) byId.set(group.id, group);
  return [...byId.values()].map((group) => ({
    ...group,
    label: readableGroupLabel(group),
  }));
}

export function setCustomGroups(groups: ClassGroup[]) {
  customGroups = groups.filter(hasUsableSchedule);
}

// Eski verilerde gün seçilip saat boş bırakılmış özel gruplar bulunabiliyor.
// Bunlar gerçek bir ders programı olmadığı için seçim listesinde gösterilmez.
function hasUsableSchedule(group: ClassGroup) {
  const time = group.time?.trim();
  return group.days.length > 0 && Boolean(time) && time !== "Belirtilmedi" && time !== "—";
}

export function groupIdForSchedule(days: ClassGroup["days"], time: string) {
  const dayCode: Record<ClassGroup["days"][number], string> = {
    monday: "pzt", tuesday: "sal", wednesday: "car", thursday: "per",
    friday: "cum", saturday: "cmt", sunday: "paz",
  };
  const dayOrder: Record<ClassGroup["days"][number], number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 7,
  };
  const dayPart = [...days]
    .sort((a, b) => dayOrder[a] - dayOrder[b])
    .map((day) => dayCode[day])
    .join("-");
  const normalizedTime = time.trim().replace(/:/g, ".");
  return `${dayPart}-${normalizedTime.replace(/[^0-9]/g, "")}`;
}

export function groupLabelForSchedule(days: ClassGroup["days"], time: string) {
  const labels = { monday: "Pazartesi", tuesday: "Salı", wednesday: "Çarşamba", thursday: "Perşembe", friday: "Cuma", saturday: "Cumartesi", sunday: "Pazar" };
  const ordered = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  return `${ordered.filter((day) => days.includes(day)).map((day) => labels[day]).join("–")} ${time.trim().replace(/:/g, ".")}`;
}

function readableGroupLabel(group: ClassGroup) {
  const labels = { monday: "Pazartesi", tuesday: "Salı", wednesday: "Çarşamba", thursday: "Perşembe", friday: "Cuma", saturday: "Cumartesi", sunday: "Pazar" };
  const hasPerDayTimes = Object.keys(group.timeByDay ?? {}).length > 0;
  if (hasPerDayTimes) {
    return group.days
      .map((day) => `${labels[day]} ${group.timeByDay?.[day] ?? group.time}`)
      .join(" – ");
  }

  // Eski kayıtlarda saat alanına gün adlarıyla birlikte yazılmış programlar
  // bulunabiliyor. Gün başlığını ikinci kez eklemeyiz.
  if (Object.values(labels).some((dayLabel) => group.time.includes(dayLabel))) {
    return group.time;
  }

  return groupLabelForSchedule(group.days, group.time);
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
  ];
}

export function getClassGroupById(id: string): ClassGroup | undefined {
  if (id === IRREGULAR_GROUP_ID) return IRREGULAR_GROUP;
  return getClassGroups().find((group) => group.id === id);
}

// İlk aktarımda bazı özel saatler yalnızca grup kimliğiyle kaydedilmişti.
// Bu kayıtlara ait günleri ve saati yeniden tanıyarak, öğrenci formunda
// mevcut programın kaybolmadan düzenlenebilmesini sağlarız.
export function legacyGroupFromId(id: string): ClassGroup | undefined {
  const match = id.match(/^([a-z-]+)-(\d{4,})$/);
  if (!match) return undefined;

  const dayById: Record<string, ClassGroup["days"][number]> = {
    pzt: "monday",
    sal: "tuesday",
    car: "wednesday",
    per: "thursday",
    cum: "friday",
    cmt: "saturday",
    paz: "sunday",
  };
  const days = match[1].split("-").map((day) => dayById[day]);
  if (!days.length || days.some((day) => !day)) return undefined;

  const timeParts = match[2].match(/\d{4}/g);
  if (!timeParts?.length || timeParts.join("") !== match[2]) return undefined;
  const time = timeParts
    .map((part) => `${part.slice(0, 2)}.${part.slice(2)}`)
    .join(" / ");
  const scheduleDays = days as ClassGroup["days"];

  return {
    id,
    days: scheduleDays,
    time,
    capacity: 2,
    label: groupLabelForSchedule(scheduleDays, time),
  };
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
