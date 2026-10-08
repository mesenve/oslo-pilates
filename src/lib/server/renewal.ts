import { getClassGroupById, isPresetGroupId } from "@/data/groups";
import { buildSessionsForStudent } from "@/data/seed";
import { todayISO } from "@/lib/dates";
import {
  patchSupabasePostponeStatus,
  readSupabaseStudioData,
  saveSupabaseStudentBundle,
} from "@/lib/server/supabase-rest";
import type { PackageHistoryEntry, RenewalRequest, Student } from "@/types/studio";

type StudioData = Awaited<ReturnType<typeof readSupabaseStudioData>>;

/** Replace the active package period with a fresh one starting at `request.startDate`. */
export async function startRenewedPackage(
  student: Student,
  data: StudioData,
  request: RenewalRequest & { startDate: string },
): Promise<{ error: string } | { student: Student }> {
  const historyEntry: PackageHistoryEntry = {
    ...student.package,
    id: `pkg-${student.id}-${student.package.startDate}`,
    createdAt: student.package.startDate,
    endedAt: new Date().toISOString(),
  };
  const renewed: Student = {
    ...student,
    package: {
      ...student.package,
      startDate: request.startDate,
      remainingSessions: student.package.totalSessions,
      isLastWeek: false,
    },
    packageHistory: [historyEntry, ...(student.packageHistory ?? [])],
    renewalRequest: request,
    postponeLessonUsed: false,
    postponeLessonUsedAt: undefined,
    postponeLessonNote: undefined,
  };
  const group = isPresetGroupId(renewed.groupId)
    ? getClassGroupById(renewed.groupId)
    : data.customGroups.find((item) => item.id === renewed.groupId);
  const sessions = buildSessionsForStudent(renewed, { fromPackageStart: true, group });
  if (sessions.length !== renewed.package.totalSessions) {
    return { error: "Yeni paket seansları oluşturulamadı. Program günlerini kontrol et." };
  }
  renewed.package.endDate = sessions.at(-1)!.date;

  await saveSupabaseStudentBundle({ student: renewed, sessions });

  // Pending postpones on retired sessions would otherwise sit in the admin queue forever.
  const nextIds = new Set(sessions.map((session) => session.id));
  for (const postpone of data.postponeRequests) {
    if (postpone.studentId === student.id && postpone.status === "pending" && !nextIds.has(postpone.sessionId)) {
      await patchSupabasePostponeStatus(postpone.id, "rejected");
    }
  }
  return { student: renewed };
}

/** Start approved renewals whose start date has arrived. Returns true if anything changed. */
export async function applyDueRenewals(data: StudioData) {
  const today = todayISO();
  // ponytail: runs on studio reads instead of a scheduled job; a Netlify scheduled function is the upgrade path.
  const due = data.students.filter((student) => {
    const request = student.renewalRequest;
    return (
      request?.status === "approved" &&
      request.startDate &&
      request.startDate <= today &&
      student.package.startDate < request.startDate
    );
  });
  for (const student of due) {
    try {
      const result = await startRenewedPackage(student, data, {
        ...student.renewalRequest!,
        startDate: student.renewalRequest!.startDate!,
      });
      if ("error" in result) console.error(`Scheduled renewal failed for ${student.id}: ${result.error}`);
    } catch (error) {
      // Concurrent reads may race; the optimistic lock makes the loser fail harmlessly.
      console.error(`Scheduled renewal failed for ${student.id}:`, error);
    }
  }
  return due.length > 0;
}
