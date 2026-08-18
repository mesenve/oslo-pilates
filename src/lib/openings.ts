import { getClassGroupById } from "@/data/groups";
import { todayISO, weekdayFromISO } from "@/lib/dates";
import type { PostponeRequest, Session } from "@/types/studio";

export type OpenSlot = {
  date: string;
  time: string;
  groupId: string;
  groupLabel: string;
  spots: number;
};

export function getOpenSlots(
  requests: PostponeRequest[],
  sessions: Session[],
): OpenSlot[] {
  const map = new Map<string, OpenSlot>();

  for (const request of requests) {
    if (request.status !== "approved") continue;
    const session = sessions.find((item) => item.id === request.sessionId);
    if (!session || session.status !== "postponed") continue;
    if (session.date < todayISO()) continue;

    const group = getClassGroupById(session.groupId);
    const day = weekdayFromISO(session.date);
    const time = (day && group?.timeByDay?.[day]) || group?.time || "";
    const key = `${session.date}|${session.groupId}|${time}`;
    const existing = map.get(key);

    if (existing) {
      existing.spots += 1;
    } else {
      map.set(key, {
        date: session.date,
        time,
        groupId: session.groupId,
        groupLabel: group?.label ?? time,
        spots: 1,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
}

export function groupOpeningsByDate(slots: OpenSlot[]) {
  const map = new Map<string, OpenSlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.date) ?? [];
    list.push(slot);
    map.set(slot.date, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
