"use client";

import { remainingSessions } from "@/data/accessors";
import { getAdminUser } from "@/data/students";
import { buildSessionsForStudent } from "@/data/seed";
import { addDays, startOfWeekMonday, toISODate, todayISO } from "@/lib/dates";
import {
  getServerStudioSnapshot,
  getStudioSnapshot,
  setStudioState,
  subscribeStudio,
} from "@/lib/store";
import type {
  NewStudentInput,
  PostponeStatus,
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
  sessions: Session[];
  postponeRequests: StudioState["postponeRequests"];
  loginAs: (role: Role) => void;
  logout: () => void;
  markAttended: (sessionId: string) => void;
  approveAttendance: (sessionIds: string[]) => void;
  rejectAttendance: (sessionIds: string[]) => void;
  requestPostpone: (sessionId: string, reason: string) => void;
  resolveRequest: (
    requestId: string,
    status: Exclude<PostponeStatus, "pending">,
  ) => void;
  addStudent: (input: NewStudentInput) => { error: string | null; id: string | null };
  remainingFor: (studentId: string) => number;
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

  const loginAs = useCallback((role: Role) => {
    if (role === "admin") {
      const admin = getAdminUser();
      setStudioState((current) => ({
        ...current,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: "admin",
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

  const resolveRequest = useCallback(
    (requestId: string, status: Exclude<PostponeStatus, "pending">) => {
      setStudioState((current) => {
        const request = current.postponeRequests.find((item) => item.id === requestId);
        if (!request || request.status !== "pending") return current;
        return {
          ...current,
          postponeRequests: current.postponeRequests.map((item) =>
            item.id === requestId ? { ...item, status } : item,
          ),
          sessions: current.sessions.map((session) => {
            if (session.id !== request.sessionId) return session;
            if (status === "approved") return { ...session, status: "postponed" };
            if (session.status === "postpone_pending") {
              return { ...session, status: "upcoming" };
            }
            return session;
          }),
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
      if (
        current.students.some(
          (student) => student.email.toLowerCase() === email,
        )
      ) {
        error = "Bu e-posta ile kayıtlı öğrenci var.";
        return current;
      }

      const currentMonday = startOfWeekMonday();
      const student: Student = {
        id: `stu-${Date.now()}`,
        name,
        email,
        phone: input.phone.trim() || "—",
        groupId: input.groupId,
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
          remainingSessions: input.totalSessions,
          startDate: toISODate(addDays(currentMonday, -21)),
          endDate: toISODate(addDays(currentMonday, 4)),
          paymentStatus: input.paymentStatus,
          isLastWeek: false,
        },
      };
      id = student.id;

      return {
        ...current,
        students: [student, ...current.students],
        sessions: [...current.sessions, ...buildSessionsForStudent(student)],
      };
    });
    return { error, id };
  }, []);

  const remainingFor = useCallback(
    (studentId: string) => {
      const student = state.students.find((item) => item.id === studentId);
      if (!student) return 0;
      return remainingSessions(student, state.sessions);
    },
    [state.sessions, state.students],
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      ready,
      user: state.user,
      students: state.students,
      sessions: state.sessions,
      postponeRequests: state.postponeRequests,
      loginAs,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      requestPostpone,
      resolveRequest,
      addStudent,
      remainingFor,
    }),
    [
      addStudent,
      loginAs,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      ready,
      remainingFor,
      requestPostpone,
      resolveRequest,
      state.postponeRequests,
      state.sessions,
      state.students,
      state.user,
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
