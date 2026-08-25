"use client";

import { remainingPostponeRights, remainingSessions } from "@/data/accessors";
import { DEFAULT_INSTRUCTOR_ID, getStaffById } from "@/data/staff";
import { buildSessionsForStudent } from "@/data/seed";
import { studentsForUser, sessionsForUser } from "@/lib/access";
import { addDays, startOfWeekMonday, toISODate, todayISO } from "@/lib/dates";
import {
  getServerStudioSnapshot,
  getStudioSnapshot,
  setStudioState,
  subscribeStudio,
} from "@/lib/store";
import type {
  NewStudentInput,
  Role,
  Session,
  Student,
  StudioState,
} from "@/types/studio";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

type StudioContextValue = {
  ready: boolean;
  user: StudioState["user"];
  students: Student[];
  visibleStudents: Student[];
  archivedStudents: Student[];
  sessions: Session[];
  visibleSessions: Session[];
  postponeRequests: StudioState["postponeRequests"];
  isSuperAdmin: boolean;
  loginAs: (role: Role, staffId?: string) => void;
  logout: () => void;
  markAttended: (sessionId: string) => void;
  approveAttendance: (sessionIds: string[]) => void;
  rejectAttendance: (sessionIds: string[]) => void;
  requestPostpone: (sessionId: string, reason: string) => void;
  approveRequest: (requestId: string) => void;
  markSessionByInstructor: (
    sessionId: string,
    outcome: "attended" | "postponed" | "missed",
  ) => void;
  addStudent: (input: NewStudentInput) => { error: string | null; id: string | null };
  archiveStudent: (studentId: string) => void;
  restoreStudent: (
    studentId: string,
    input: NewStudentInput,
  ) => { error: string | null; id: string | null };
  permanentlyDeleteStudent: (studentId: string) => void;
  remainingFor: (studentId: string) => number;
  remainingPostponeFor: (studentId: string) => number;
};

const StudioContext = createContext<StudioContextValue | null>(null);

const emptySubscribe = () => () => {};

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const state = useSyncExternalStore(
    subscribeStudio,
    getStudioSnapshot,
    getServerStudioSnapshot,
  );

  const loginAs = useCallback((role: Role, staffId?: string) => {
    if (role === "super_admin" || role === "instructor") {
      const staff = staffId ? getStaffById(staffId) : undefined;
      if (!staff || staff.role !== role) return;
      setStudioState((current) => ({
        ...current,
        user: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
        },
      }));
      return;
    }

    setStudioState((current) => {
      const student =
        current.students.find((item) => item.id === "stu-merve") ??
        current.students[0];
      if (!student) return current;
      return {
        ...current,
        user: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: "student",
        },
      };
    });
  }, []);

  const logout = useCallback(() => {
    setStudioState((current) => ({ ...current, user: null }));
  }, []);

  const markAttended = useCallback((sessionId: string) => {
    setStudioState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId && session.status === "upcoming"
          ? { ...session, status: "attend_pending" }
          : session,
      ),
    }));
  }, []);

  const approveAttendance = useCallback((sessionIds: string[]) => {
    const idSet = new Set(sessionIds);
    setStudioState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        idSet.has(session.id) && session.status === "attend_pending"
          ? { ...session, status: "attended" }
          : session,
      ),
    }));
  }, []);

  const rejectAttendance = useCallback((sessionIds: string[]) => {
    const idSet = new Set(sessionIds);
    setStudioState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        idSet.has(session.id) && session.status === "attend_pending"
          ? { ...session, status: "upcoming" }
          : session,
      ),
    }));
  }, []);

  const requestPostpone = useCallback((sessionId: string, reason: string) => {
    setStudioState((current) => {
      const session = current.sessions.find((item) => item.id === sessionId);
      if (!session || session.status !== "upcoming") return current;
      const student = current.students.find((item) => item.id === session.studentId);
      if (!student) return current;
      if (remainingPostponeRights(student, current.postponeRequests) <= 0) {
        return current;
      }
      return {
        ...current,
        sessions: current.sessions.map((item) =>
          item.id === sessionId ? { ...item, status: "postpone_pending" } : item,
        ),
        postponeRequests: [
          {
            id: `req-${sessionId}-${Date.now()}`,
            studentId: session.studentId,
            sessionId,
            reason: reason.trim() || "Bu dersi ertelemek istiyorum.",
            status: "pending",
            createdAt: `${todayISO()}T12:00:00`,
          },
          ...current.postponeRequests,
        ],
      };
    });
  }, []);

  const approveRequest = useCallback((requestId: string) => {
    setStudioState((current) => {
      const request = current.postponeRequests.find((item) => item.id === requestId);
      if (!request || request.status !== "pending") return current;
      return {
        ...current,
        postponeRequests: current.postponeRequests.map((item) =>
          item.id === requestId ? { ...item, status: "approved" } : item,
        ),
        sessions: current.sessions.map((session) =>
          session.id === request.sessionId
            ? { ...session, status: "postponed" }
            : session,
        ),
      };
    });
  }, []);

  const markSessionByInstructor = useCallback(
    (sessionId: string, outcome: "attended" | "postponed" | "missed") => {
      setStudioState((current) => {
        const session = current.sessions.find((item) => item.id === sessionId);
        if (!session) return current;
        const status = session.status;
        if (
          status !== "upcoming" &&
          status !== "attend_pending" &&
          status !== "postpone_pending"
        ) {
          return current;
        }

        if (outcome === "attended") {
          return {
            ...current,
            sessions: current.sessions.map((item) =>
              item.id === sessionId ? { ...item, status: "attended" } : item,
            ),
            postponeRequests: current.postponeRequests.map((request) =>
              request.sessionId === sessionId && request.status === "pending"
                ? { ...request, status: "rejected" }
                : request,
            ),
          };
        }

        if (outcome === "missed") {
          return {
            ...current,
            sessions: current.sessions.map((item) =>
              item.id === sessionId ? { ...item, status: "missed" } : item,
            ),
            postponeRequests: current.postponeRequests.map((request) =>
              request.sessionId === sessionId && request.status === "pending"
                ? { ...request, status: "rejected" }
                : request,
            ),
          };
        }

        const pendingRequest = current.postponeRequests.find(
          (request) => request.sessionId === sessionId && request.status === "pending",
        );
        if (pendingRequest) {
          return {
            ...current,
            sessions: current.sessions.map((item) =>
              item.id === sessionId ? { ...item, status: "postponed" } : item,
            ),
            postponeRequests: current.postponeRequests.map((request) =>
              request.id === pendingRequest.id
                ? { ...request, status: "approved" }
                : request,
            ),
          };
        }

        return {
          ...current,
          sessions: current.sessions.map((item) =>
            item.id === sessionId ? { ...item, status: "postponed" } : item,
          ),
          postponeRequests: [
            {
              id: `req-${sessionId}-inst-${Date.now()}`,
              studentId: session.studentId,
              sessionId,
              reason: "Eğitmen erteleme işaretledi.",
              status: "approved" as const,
              createdAt: `${todayISO()}T12:00:00`,
            },
            ...current.postponeRequests,
          ],
        };
      });
    },
    [],
  );

  const addStudent = useCallback((input: NewStudentInput) => {
    const name = input.name.trim();
    if (!name) return { error: "Ad soyad gerekli.", id: null };
    if (!input.groupId) return { error: "Grup seç.", id: null };

    let error: string | null = null;
    let id: string | null = null;
    setStudioState((current) => {
      const email = (input.email.trim() || slugEmail(name)).toLowerCase();
      if (emailTaken(email, current)) {
        error = "Bu e-posta ile kayıtlı öğrenci var.";
        return current;
      }

      const student = studentFromInput(`stu-${Date.now()}`, input, email);
      id = student.id;

      return {
        ...current,
        students: [student, ...current.students],
        sessions: [...current.sessions, ...buildSessionsForStudent(student)],
      };
    });
    return { error, id };
  }, []);

  const archiveStudent = useCallback((studentId: string) => {
    setStudioState((current) => {
      const student = current.students.find((item) => item.id === studentId);
      if (!student) return current;
      return {
        ...current,
        students: current.students.filter((item) => item.id !== studentId),
        archivedStudents: [student, ...current.archivedStudents],
        user:
          current.user?.id === studentId && current.user.role === "student"
            ? null
            : current.user,
      };
    });
  }, []);

  const restoreStudent = useCallback(
    (studentId: string, input: NewStudentInput) => {
      const name = input.name.trim();
      if (!name) return { error: "Ad soyad gerekli.", id: null };
      if (!input.groupId) return { error: "Grup seç.", id: null };

      let error: string | null = null;
      let id: string | null = null;
      setStudioState((current) => {
        const archived = current.archivedStudents.find(
          (item) => item.id === studentId,
        );
        if (!archived) {
          error = "Arşiv kaydı bulunamadı.";
          return current;
        }
        const email = (input.email.trim() || slugEmail(name)).toLowerCase();
        if (emailTaken(email, current, studentId)) {
          error = "Bu e-posta ile kayıtlı öğrenci var.";
          return current;
        }

        const student = studentFromInput(studentId, input, email);
        id = student.id;

        return {
          ...current,
          archivedStudents: current.archivedStudents.filter(
            (item) => item.id !== studentId,
          ),
          students: [student, ...current.students],
          postponeRequests: current.postponeRequests.filter(
            (request) => request.studentId !== studentId,
          ),
          sessions: [
            ...current.sessions.filter((session) => session.studentId !== studentId),
            ...buildSessionsForStudent(student, { fromToday: true }),
          ],
        };
      });
      return { error, id };
    },
    [],
  );

  const permanentlyDeleteStudent = useCallback((studentId: string) => {
    setStudioState((current) => ({
      ...current,
      archivedStudents: current.archivedStudents.filter(
        (item) => item.id !== studentId,
      ),
      sessions: current.sessions.filter((session) => session.studentId !== studentId),
      postponeRequests: current.postponeRequests.filter(
        (request) => request.studentId !== studentId,
      ),
    }));
  }, []);

  const remainingFor = useCallback(
    (studentId: string) => {
      const student = state.students.find((item) => item.id === studentId);
      if (!student) return 0;
      return remainingSessions(student, state.sessions);
    },
    [state.sessions, state.students],
  );

  const remainingPostponeFor = useCallback(
    (studentId: string) => {
      const student = state.students.find((item) => item.id === studentId);
      if (!student) return 0;
      return remainingPostponeRights(student, state.postponeRequests);
    },
    [state.postponeRequests, state.students],
  );

  const visibleStudents = useMemo(
    () => studentsForUser(state.user, state.students),
    [state.students, state.user],
  );

  const visibleSessions = useMemo(
    () => sessionsForUser(state.user, state.sessions, state.students),
    [state.sessions, state.students, state.user],
  );

  const isSuperAdmin = state.user?.role === "super_admin";

  const value = useMemo<StudioContextValue>(
    () => ({
      ready,
      user: state.user,
      students: state.students,
      visibleStudents,
      archivedStudents: state.archivedStudents,
      sessions: state.sessions,
      visibleSessions,
      postponeRequests: state.postponeRequests,
      isSuperAdmin,
      loginAs,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      requestPostpone,
      approveRequest,
      markSessionByInstructor,
      addStudent,
      archiveStudent,
      restoreStudent,
      permanentlyDeleteStudent,
      remainingFor,
      remainingPostponeFor,
    }),
    [
      addStudent,
      approveRequest,
      archiveStudent,
      loginAs,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      markSessionByInstructor,
      permanentlyDeleteStudent,
      ready,
      remainingFor,
      remainingPostponeFor,
      requestPostpone,
      restoreStudent,
      state.archivedStudents,
      state.postponeRequests,
      state.sessions,
      state.students,
      state.user,
      visibleSessions,
      visibleStudents,
      isSuperAdmin,
    ],
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return context;
}

export function useCurrentStudent() {
  const { user, students } = useStudio();
  if (!user || user.role !== "student") return null;
  return students.find((student) => student.id === user.id) ?? null;
}

function emailTaken(
  email: string,
  current: StudioState,
  ignoreStudentId?: string,
) {
  const match = (student: Student) =>
    student.id !== ignoreStudentId && student.email.toLowerCase() === email;
  return (
    (current.students ?? []).some(match) ||
    (current.archivedStudents ?? []).some(match)
  );
}

function studentFromInput(
  id: string,
  input: NewStudentInput,
  email: string,
  previous?: Student,
): Student {
  const currentMonday = startOfWeekMonday();
  return {
    id,
    name: input.name.trim(),
    email,
    phone: input.phone.trim() || "—",
    groupId: input.groupId,
    instructorId: input.instructorId?.trim() || DEFAULT_INSTRUCTOR_ID,
    note: input.note?.trim() ?? "",
    measurements: {
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      chestCm: input.chestCm,
    },
    package: {
      totalSessions: input.totalSessions,
      remainingSessions: previous?.package.remainingSessions ?? input.totalSessions,
      startDate: previous?.package.startDate ?? toISODate(addDays(currentMonday, -21)),
      endDate: previous?.package.endDate ?? toISODate(addDays(currentMonday, 4)),
      paymentStatus: input.paymentStatus,
      isLastWeek: previous?.package.isLastWeek ?? false,
    },
    monthlyPostponeLimit: Number.isFinite(input.monthlyPostponeLimit)
      ? Math.max(0, Math.round(input.monthlyPostponeLimit))
      : 1,
  };
}

function slugEmail(name: string) {
  const slug = name
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${slug || "ogrenci"}@oslo`;
}
