"use client";

import { remainingPostponeRights, remainingSessions } from "@/data/accessors";
import {
  DEFAULT_INSTRUCTOR_ID,
  getStaffById,
} from "@/data/staff";
import { buildSessionsForStudent, collectSessionDates } from "@/data/seed";
import { getClassGroupById, legacyGroupFromId, setCustomGroups } from "@/data/groups";
import { studentsForUser, sessionsForUser, postponeRequestsForUser, canManageStudent, isStaffRole } from "@/lib/access";
import { fetchAttendanceMarks, pushAttendanceMark } from "@/lib/attendance-client";
import { mergeActivatedInvites, mergeAttendanceMarks } from "@/lib/attendance-sync";
import { addDays, startOfWeekMonday, toISODate, todayISO } from "@/lib/dates";
import {
  createInviteToken,
  getStudentPassword,
  inviteExpiresAt,
  inviteUrl,
  isInviteValid,
  validateStudentPassword,
} from "@/lib/student-auth";
import {
  activateInviteAccount,
  buildActivatedMerge,
  fetchActivatedInvites,
  loginStudentAccount,
} from "@/lib/invite-client";
import { fetchStudioSnapshot } from "@/lib/studio-client";
import {
  enableStudioSnapshotPersistence,
  flushStudioSnapshotPersistence,
  getServerStudioSnapshot,
  getStudioSnapshot,
  setStudioSnapshotRevision,
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
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

type StudentActionResult = {
  error: string | null;
  id: string | null;
  inviteUrl?: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  invitedAt?: string;
  passwordResetOnly?: boolean;
};

type StudioContextValue = {
  ready: boolean;
  sessionChecked: boolean;
  studioDataStatus: "idle" | "loading" | "ready" | "error";
  retryStudioData: () => Promise<void>;
  user: StudioState["user"];
  students: Student[];
  visibleStudents: Student[];
  archivedStudents: Student[];
  customGroups: StudioState["customGroups"];
  sessions: Session[];
  visibleSessions: Session[];
  postponeRequests: StudioState["postponeRequests"];
  visiblePostponeRequests: StudioState["postponeRequests"];
  isSuperAdmin: boolean;
  loginAs: (role: Role, staffId?: string) => boolean;
  loginStaff: (email: string, password: string) => Promise<{ error: string | null }>;
  loginStudent: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  activateStudentInvite: (
    token: string,
    password: string,
    confirmPassword: string,
  ) => Promise<{ error: string | null }>;
  resendStudentInvite: (studentId: string) => StudentActionResult;
  changeStaffPassword: (
    staffId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<{ error: string | null; success: boolean }>;
  logout: () => void;
  markAttended: (sessionId: string) => void;
  approveAttendance: (sessionIds: string[]) => void;
  rejectAttendance: (sessionIds: string[]) => void;
  requestPostpone: (sessionId: string, reason: string) => void;
  withdrawPostpone: (sessionId: string) => Promise<void>;
  requestRenewal: (requestedStartDate?: string) => Promise<{ error: string | null }>;
  reviewRenewal: (studentId: string, status: "approved" | "rejected") => Promise<{ error: string | null }>;
  approveRequest: (requestId: string) => void;
  markSessionByInstructor: (
    sessionId: string,
    outcome: "attended" | "postponed" | "missed" | "upcoming",
  ) => void;
  setPostponeLessonUsed: (
    studentId: string,
    used: boolean,
    usedAt?: string,
  ) => Promise<void>;
  setPostponeLessonNote: (studentId: string, note: string) => Promise<void>;
  setPostponeRequestReason: (requestId: string, reason: string) => Promise<void>;
  addStudent: (input: NewStudentInput) => Promise<StudentActionResult>;
  archiveStudent: (studentId: string) => void;
  restoreStudent: (
    studentId: string,
    input: NewStudentInput,
  ) => Promise<StudentActionResult>;
  updateStudent: (
    studentId: string,
    input: NewStudentInput,
  ) => Promise<StudentActionResult>;
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
  const [sessionChecked, setSessionChecked] = useState(false);
  const [studioLoad, setStudioLoad] = useState<{
    userId: string;
    status: "loading" | "ready" | "error";
  } | null>(null);
  const studioDataStatus = !state.user
    ? "idle"
    : studioLoad?.userId === state.user.id
      ? studioLoad.status
      : "loading";

  useEffect(() => {
    const groups = [...(state.customGroups ?? [])];
    const knownIds = new Set(groups.map((group) => group.id));
    state.students.forEach((student) => {
      if (knownIds.has(student.groupId) || getClassGroupById(student.groupId)) return;
      const legacyGroup = legacyGroupFromId(student.groupId);
      if (legacyGroup) {
        groups.push(legacyGroup);
        knownIds.add(legacyGroup.id);
      }
    });
    setCustomGroups(groups);
  }, [state.customGroups, state.students]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((response) => response.ok ? response.json() : { user: null })
      .then((data: { user?: StudioState["user"] }) => {
        if (cancelled) return;
        // Never wipe a hydrated session on a flaky/empty session response —
        // that kicked staff back to login/home mid-edit.
        setStudioState((current) => {
          if (data.user) return { ...current, user: data.user };
          if (current.user) return current;
          return { ...current, user: null };
        });
      })
      .catch(() => {
        // Keep existing user on network blips.
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });
    return () => { cancelled = true; };
  }, [ready]);

  const refreshRemoteState = useCallback(async (
    user: NonNullable<StudioState["user"]>,
    isCancelled: () => boolean = () => false,
  ) => {
    const isStale = () => isCancelled() || getStudioSnapshot().user?.id !== user.id;
    const markLoadError = () => setStudioLoad((current) =>
      current?.userId === user.id && current.status === "ready"
        ? current
        : { userId: user.id, status: "error" },
    );

    try {
      const marksPromise = (
        user.role === "student"
          ? fetchAttendanceMarks({ studentId: user.id })
          : isStaffRole(user.role)
            ? fetchAttendanceMarks()
            : Promise.resolve([])
      ).catch(() => []);
      const invitesPromise = (
        user.role === "super_admin"
          ? fetchActivatedInvites()
          : Promise.resolve([])
      ).catch(() => []);
      const studioPromise =
        user.role === "student"
          ? fetchStudioSnapshot({ studentId: user.id, includeBlockedEmails: false })
          : isStaffRole(user.role)
            ? fetchStudioSnapshot()
            : Promise.resolve(null);

      // The dashboard only needs the studio snapshot. Do not make its first
      // count wait for attendance-mark or invite-activation requests.
      const remoteStudioResult = await studioPromise;
      const remoteStudio = remoteStudioResult?.snapshot ?? null;
      if (isStale()) return;

      if (remoteStudioResult && remoteStudio) {
        setStudioSnapshotRevision(remoteStudioResult.revision);
        // Remote hydration must never enqueue the fetched (possibly older)
        // snapshot as a new write. User mutations are persisted separately.
        setStudioState((current) => ({
          ...current,
          ...remoteStudio,
          user: current.user,
          staffPasswords: current.staffPasswords,
          studentPasswords: current.studentPasswords,
        }), { persist: false });
        enableStudioSnapshotPersistence();
        setStudioLoad({ userId: user.id, status: "ready" });
      } else {
        markLoadError();
      }

      const [marks, invites] = await Promise.all([marksPromise, invitesPromise]);
      if (isStale() || (marks.length === 0 && invites.length === 0)) return;

      setStudioState((current) => {
        let next = current;
        if (invites.length > 0) next = mergeActivatedInvites(next, invites);
        if (marks.length > 0) {
          next = { ...next, sessions: mergeAttendanceMarks(next.sessions, marks) };
        }
        return next;
      }, { persist: false });
    } catch {
      if (!isStale()) markLoadError();
    }
  }, []);

  useEffect(() => {
    if (!ready || !state.user) return;

    let cancelled = false;
    const user = state.user;
    const syncRemoteState = () => {
      void refreshRemoteState(user, () => cancelled);
    };

    syncRemoteState();
    const interval = window.setInterval(syncRemoteState, 12000);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncRemoteState();
    };
    const onConflict = () => {
      window.dispatchEvent(
        new CustomEvent("studio:persistence-error", {
          detail: "Veri başka bir yerden güncellendi. Güncel veri yükleniyor.",
        }),
      );
      syncRemoteState();
    };
    window.addEventListener("focus", syncRemoteState);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("studio:persistence-conflict", onConflict);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncRemoteState);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("studio:persistence-conflict", onConflict);
    };
  }, [ready, state.user, refreshRemoteState]);

  const retryStudioData = useCallback(async () => {
    const user = state.user;
    if (!user) return;
    setStudioLoad({ userId: user.id, status: "loading" });
    await refreshRemoteState(user);
  }, [refreshRemoteState, state.user]);

  const loginAs = useCallback((role: Role, staffId?: string) => {
    if (role === "super_admin" || role === "instructor") {
      const staff = staffId ? getStaffById(staffId) : undefined;
      if (!staff || staff.role !== role) return false;
      setStudioState((current) => ({
        ...current,
        user: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
        },
      }));
      return true;
    }

    let ok = false;
    setStudioState((current) => {
      const student =
        current.students.find((item) => item.id === "stu-merve") ??
        current.students[0];
      if (!student) return current;
      ok = true;
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
    return ok;
  }, []);

  const loginStaff = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; user?: StudioState["user"] };
    if (!response.ok || !data.user) return { error: data.error ?? "E-posta veya şifre hatalı." };
    setStudioState((current) => ({ ...current, user: data.user! }));
    return { error: null };
  }, []);

  const loginStudent = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const snapshot = getStudioSnapshot();
    const localStudent = snapshot.students.find(
      (item) => item.email.toLowerCase() === normalizedEmail,
    );

    // Demo-only shortcut: production authentication always goes through the server.
    if (process.env.NODE_ENV !== "production" && localStudent) {
      if (localStudent.accountStatus === "invited") {
        return {
          error:
            "Hesabın henüz aktif değil. E-postadaki davet linkine tıklayarak şifreni oluştur.",
        };
      }
      const stored = getStudentPassword(localStudent.id, snapshot.studentPasswords);
      if (stored && password === stored) {
        setStudioState((current) => ({
          ...current,
          user: {
            id: localStudent.id,
            name: localStudent.name,
            email: localStudent.email,
            role: "student",
          },
        }));
        return { error: null };
      }
    }

    const result = await loginStudentAccount(email, password);
    if (result.error || !result.payload) {
      return { error: result.error ?? "E-posta veya şifre hatalı." };
    }

    const merge = buildActivatedMerge(result.payload);
    setStudioState((current) => ({
      ...current,
      ...merge(current),
      user: {
        id: result.payload!.student.id,
        name: result.payload!.student.name,
        email: result.payload!.student.email,
        role: "student",
      },
    }));

    return { error: null };
  }, []);

  const activateStudentInvite = useCallback(
    async (token: string, password: string, confirmPassword: string) => {
      const validationError = validateStudentPassword(password, confirmPassword);
      if (validationError) {
        return { error: validationError };
      }

      const snapshot = getStudioSnapshot();
      const localStudent = snapshot.students.find(
        (item) => item.inviteToken === token && item.accountStatus === "invited",
      );

      try {
        const payload = await activateInviteAccount({ token, password, confirmPassword });
        const merge = buildActivatedMerge(payload);
        setStudioState((current) => ({
          ...current,
          ...merge(current),
          user: {
            id: payload.student.id,
            name: payload.student.name,
            email: payload.student.email,
            role: "student",
          },
        }));
        return { error: null };
      } catch (error) {
        if (localStudent && isInviteValid(localStudent)) {
          setStudioState((current) => ({
            ...current,
            students: current.students.map((item) =>
              item.id === localStudent.id
                ? {
                    ...item,
                    accountStatus: "active" as const,
                    inviteToken: undefined,
                    inviteExpiresAt: undefined,
                  }
                : item,
            ),
            studentPasswords: {
              ...current.studentPasswords,
              [localStudent.id]: password,
            },
            user: {
              id: localStudent.id,
              name: localStudent.name,
              email: localStudent.email,
              role: "student",
            },
          }));
          return { error: null };
        }

        return {
          error:
            error instanceof Error
              ? error.message
              : "Davet linki geçersiz veya süresi dolmuş.",
        };
      }
    },
    [],
  );

  const resendStudentInvite = useCallback((studentId: string) => {
    let error: string | null = "Davet gönderilemedi.";
    let id: string | null = null;
    let nextInviteUrl: string | undefined;
    let nextInviteToken: string | undefined;
    let nextInviteExpiresAt: string | undefined;
    let nextInvitedAt: string | undefined;
    let passwordResetOnly = false;

    setStudioState((current) => {
      const student = current.students.find((item) => item.id === studentId);
      if (
        !student ||
        !canManageStudent(current.user, studentId, current.students)
      ) {
        return current;
      }

      // Active students already have a password. Resending a fresh invite used
      // to demote them and wipe login — send a reset instead (caller emails it).
      if (student.accountStatus === "active") {
        error = null;
        id = student.id;
        passwordResetOnly = true;
        return current;
      }

      const token = createInviteToken();
      const expiresAt = inviteExpiresAt();
      const invitedAt = new Date().toISOString();
      error = null;
      id = student.id;
      nextInviteUrl = inviteUrl(token);
      nextInviteToken = token;
      nextInviteExpiresAt = expiresAt;
      nextInvitedAt = invitedAt;

      return {
        ...current,
        students: current.students.map((item) =>
          item.id === studentId
            ? {
                ...item,
                accountStatus: "invited",
                inviteToken: token,
                inviteExpiresAt: expiresAt,
                invitedAt,
              }
            : item,
        ),
      };
    });

    return {
      error,
      id,
      inviteUrl: nextInviteUrl,
      inviteToken: nextInviteToken,
      inviteExpiresAt: nextInviteExpiresAt,
      invitedAt: nextInvitedAt,
      passwordResetOnly,
    };
  }, []);

  const changeStaffPassword = useCallback(async (
    staffId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => {
    if (getStudioSnapshot().user?.id !== staffId) {
      return { error: "Bu işlem için yetkin yok.", success: false };
    }
    const response = await fetch("/api/auth/staff/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return response.ok
      ? { error: null, success: true }
      : { error: data.error ?? "Şifre güncellenemedi.", success: false };
  }, []);

  const logout = useCallback(() => {
    void fetch("/api/auth/session", { method: "DELETE" });
    setStudioState((current) => ({ ...current, user: null }));
  }, []);

  const markAttended = useCallback((sessionId: string) => {
    const session = getStudioSnapshot().sessions.find((item) => item.id === sessionId);
    if (!session || session.status !== "upcoming") return;

    void (async () => {
      try {
        await pushAttendanceMark({
          sessionId: session.id,
          studentId: session.studentId,
          date: session.date,
          groupId: session.groupId,
          status: "attend_pending",
        });
        setStudioState((current) => ({
          ...current,
          sessions: current.sessions.map((item) =>
            item.id === sessionId && item.status === "upcoming"
              ? { ...item, status: "attend_pending" }
              : item,
          ),
        }), { persist: false });
      } catch {
        // Sunucu kaydı olmadan yerel durum güncellenmez.
      }
    })();
  }, []);

  const approveAttendance = useCallback((sessionIds: string[]) => {
    void (async () => {
      const snapshot = getStudioSnapshot();
      const idSet = new Set(sessionIds);
      const allowed = sessionIds.every((sessionId) => {
        const session = snapshot.sessions.find((item) => item.id === sessionId);
        return (
          session &&
          canManageStudent(snapshot.user, session.studentId, snapshot.students)
        );
      });
      if (!allowed) return;

      const targets = sessionIds
        .map((sessionId) => snapshot.sessions.find((item) => item.id === sessionId))
        .filter(
          (session): session is Session =>
            Boolean(session && session.status === "attend_pending"),
        );

      if (targets.length === 0) return;

      try {
        await Promise.all(
          targets.map((session) =>
            pushAttendanceMark({
              sessionId: session.id,
              studentId: session.studentId,
              date: session.date,
              groupId: session.groupId,
              status: "attended",
            }),
          ),
        );
        setStudioState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            idSet.has(session.id) && session.status === "attend_pending"
              ? { ...session, status: "attended" }
              : session,
          ),
        }), { persist: false });
      } catch {
        // Onay sunucuya yazılamazsa yerel durum değişmez.
      }
    })();
  }, []);

  const rejectAttendance = useCallback((sessionIds: string[]) => {
    void (async () => {
      const snapshot = getStudioSnapshot();
      const idSet = new Set(sessionIds);
      const allowed = sessionIds.every((sessionId) => {
        const session = snapshot.sessions.find((item) => item.id === sessionId);
        return (
          session &&
          canManageStudent(snapshot.user, session.studentId, snapshot.students)
        );
      });
      if (!allowed) return;

      const targets = sessionIds
        .map((sessionId) => snapshot.sessions.find((item) => item.id === sessionId))
        .filter(
          (session): session is Session =>
            Boolean(session && session.status === "attend_pending"),
        );

      if (targets.length === 0) return;

      try {
        await Promise.all(
          targets.map((session) =>
            pushAttendanceMark({
              sessionId: session.id,
              studentId: session.studentId,
              date: session.date,
              groupId: session.groupId,
              status: "upcoming",
            }),
          ),
        );
        setStudioState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            idSet.has(session.id) && session.status === "attend_pending"
              ? { ...session, status: "upcoming" }
              : session,
          ),
        }), { persist: false });
      } catch {
        // Geri alma sunucuya yazılamazsa yerel durum değişmez.
      }
    })();
  }, []);

  const requestPostpone = useCallback(async (sessionId: string, reason: string) => {
    const response = await fetch("/api/sessions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "postpone_pending", reason }),
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as {
      request?: StudioState["postponeRequests"][number];
      revision?: string;
    } | null;
    const request = data?.request;
    if (!request) return;
    setStudioSnapshotRevision(data?.revision);
    setStudioState((current) => ({
      ...current,
      sessions: current.sessions.map((item) =>
        item.id === sessionId ? { ...item, status: "postpone_pending" } : item,
      ),
      postponeRequests: [request, ...current.postponeRequests.filter((item) => item.id !== request.id)],
    }), { persist: false });
  }, []);

  const withdrawPostpone = useCallback(async (sessionId: string) => {
    const response = await fetch("/api/sessions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "upcoming" }),
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as { revision?: string } | null;
    setStudioSnapshotRevision(data?.revision);
    setStudioState((current) => ({
      ...current,
      sessions: current.sessions.map((item) =>
        item.id === sessionId ? { ...item, status: "upcoming" } : item,
      ),
      postponeRequests: current.postponeRequests.filter(
        (item) => !(item.sessionId === sessionId && item.status === "pending"),
      ),
    }), { persist: false });
  }, []);

  const requestRenewal = useCallback(async (requestedStartDate?: string) => {
    const response = await fetch("/api/renewals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedStartDate: requestedStartDate || undefined }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; request?: Student["renewalRequest"]; revision?: string } | null;
    if (!response.ok || !data?.request) return { error: data?.error ?? "Yenileme talebi gönderilemedi." };
    setStudioSnapshotRevision(data.revision);
    setStudioState((current) => ({
      ...current,
      students: current.students.map((student) =>
        student.id === current.user?.id ? { ...student, renewalRequest: data.request } : student,
      ),
    }), { persist: false });
    return { error: null };
  }, []);

  const reviewRenewal = useCallback(async (studentId: string, status: "approved" | "rejected") => {
    const response = await fetch("/api/renewals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, status }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; request?: Student["renewalRequest"]; revision?: string } | null;
    if (!response.ok || !data?.request) return { error: data?.error ?? "Yenileme talebi güncellenemedi." };
    setStudioSnapshotRevision(data.revision);
    setStudioState((current) => ({
      ...current,
      students: current.students.map((student) => student.id === studentId ? { ...student, renewalRequest: data.request } : student),
    }), { persist: false });
    return { error: null };
  }, []);

  const approveRequest = useCallback((requestId: string) => {
    void (async () => {
      const current = getStudioSnapshot();
      const request = current.postponeRequests.find((item) => item.id === requestId);
      if (!request || request.status !== "pending" || !canManageStudent(current.user, request.studentId, current.students)) return;
      const response = await fetch("/api/sessions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: request.sessionId, status: "postponed" }),
      });
      if (!response.ok) return;
      const data = (await response.json().catch(() => null)) as { revision?: string } | null;
      setStudioSnapshotRevision(data?.revision);
      setStudioState((state) => ({
        ...state,
        postponeRequests: state.postponeRequests.map((item) =>
          item.id === requestId ? { ...item, status: "approved", actedAt: new Date().toISOString(), actedBy: current.user?.id } : item,
        ),
        sessions: state.sessions.map((session) =>
          session.id === request.sessionId ? { ...session, status: "postponed" } : session,
        ),
      }), { persist: false });
    })();
  }, []);

  const markSessionByInstructor = useCallback(
    (
      sessionId: string,
      outcome: "attended" | "postponed" | "missed" | "upcoming",
    ) => {
      const current = getStudioSnapshot();
      const session = current.sessions.find((item) => item.id === sessionId);
      if (!session || !canManageStudent(current.user, session.studentId, current.students)) {
        return;
      }
      if (session.date > todayISO() && outcome !== "upcoming") {
        return;
      }
      void (async () => {
        const response = await fetch("/api/sessions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: outcome }),
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as { revision?: string } | null;
        setStudioSnapshotRevision(data?.revision);
        setStudioState((current) => {
        const session = current.sessions.find((item) => item.id === sessionId);
        if (!session) return current;
        if (!canManageStudent(current.user, session.studentId, current.students)) {
          return current;
        }
        if (outcome === "attended") {
          return {
            ...current,
            sessions: current.sessions.map((item) =>
              item.id === sessionId ? { ...item, status: "attended" } : item,
            ),
            postponeRequests: current.postponeRequests.map((request) =>
              request.sessionId === sessionId && request.status !== "rejected"
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
              request.sessionId === sessionId && request.status !== "rejected"
                ? { ...request, status: "rejected" }
                : request,
            ),
          };
        }

        if (outcome === "upcoming") {
          return {
            ...current,
            sessions: current.sessions.map((item) =>
              item.id === sessionId ? { ...item, status: "upcoming" } : item,
            ),
            postponeRequests: current.postponeRequests.map((request) =>
              request.sessionId === sessionId && request.status !== "rejected"
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
        }, { persist: false });
      })();
    },
    [],
  );

  const setPostponeLessonUsed = useCallback(
    async (studentId: string, used: boolean, usedAt?: string) => {
      setStudioState((current) => {
        const student = current.students.find((item) => item.id === studentId);
        if (!student || !canManageStudent(current.user, studentId, current.students)) return current;
        return {
          ...current,
          students: current.students.map((item) =>
            item.id === studentId
              ? {
                  ...item,
                  postponeLessonUsed: used,
                  postponeLessonUsedAt: used
                    ? (usedAt?.trim() || item.postponeLessonUsedAt || todayISO())
                    : undefined,
                  postponeLessonNote: used ? item.postponeLessonNote : undefined,
                }
              : item,
          ),
        };
        });
      await flushStudioSnapshotPersistence();
    },
    [],
  );

  const setPostponeLessonNote = useCallback(
    async (studentId: string, note: string) => {
      setStudioState((current) => {
        const student = current.students.find((item) => item.id === studentId);
        if (!student || !canManageStudent(current.user, studentId, current.students)) return current;
        const trimmed = note.trim();
        return {
          ...current,
          students: current.students.map((item) =>
            item.id === studentId
              ? {
                  ...item,
                  postponeLessonNote: trimmed || undefined,
                  postponeLessonUsed: trimmed ? true : item.postponeLessonUsed,
                  postponeLessonUsedAt:
                    trimmed && !item.postponeLessonUsedAt
                      ? todayISO()
                      : item.postponeLessonUsedAt,
                }
              : item,
          ),
        };
      });
      await flushStudioSnapshotPersistence();
    },
    [],
  );

  const setPostponeRequestReason = useCallback(
    async (requestId: string, reason: string) => {
      setStudioState((current) => {
        const request = current.postponeRequests.find((item) => item.id === requestId);
        if (
          !request ||
          !canManageStudent(current.user, request.studentId, current.students)
        ) {
          return current;
        }
        return {
          ...current,
          postponeRequests: current.postponeRequests.map((item) =>
            item.id === requestId ? { ...item, reason: reason.trim() } : item,
          ),
        };
      });
      await flushStudioSnapshotPersistence();
    },
    [],
  );

  const addStudent = useCallback(async (input: NewStudentInput) => {
    const name = input.name.trim();
    if (!name) return { error: "Ad soyad gerekli.", id: null };
    if (!input.groupId) return { error: "Grup seç.", id: null };
    if (!input.email.trim()) {
      return { error: "E-posta gerekli. Davet maili gönderilecek.", id: null };
    }

    let error: string | null = null;
    let id: string | null = null;
    let nextInviteUrl: string | undefined;
    setStudioState((current) => {
      const normalized = normalizeStudentInput(input, current.user);
      const email = normalized.email.trim().toLowerCase();
      if (emailTaken(email, current)) {
        error = "Bu e-posta ile kayıtlı öğrenci var.";
        return current;
      }

      const token = createInviteToken();
      const student = withInvite(
        studentFromInput(`stu-${Date.now()}`, normalized, email),
        token,
      );
      id = student.id;
      nextInviteUrl = inviteUrl(token);

      return {
        ...current,
        customGroups:
          input.customGroup && !current.customGroups.some((group) => group.id === input.customGroup!.id)
            ? [...current.customGroups, input.customGroup]
            : current.customGroups,
        students: [student, ...current.students],
        sessions: [
          ...current.sessions,
          ...buildSessionsForStudent(student, {
            fromPackageStart: true,
            group: input.customGroup ?? current.customGroups.find((group) => group.id === student.groupId),
          }),
        ],
      };
    });
    if (!error) {
      const persisted = await flushStudioSnapshotPersistence();
      if (!persisted) {
        return {
          error: "Kayıt sunucuya yazılamadı. Form bilgileri korunuyor; bağlantıyı kontrol edip tekrar deneyin.",
          id: null,
        };
      }
    }
    return { error, id, inviteUrl: nextInviteUrl };
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
    async (studentId: string, input: NewStudentInput) => {
      const name = input.name.trim();
      if (!name) return { error: "Ad soyad gerekli.", id: null };
      if (!input.groupId) return { error: "Grup seç.", id: null };

      let error: string | null = null;
      let id: string | null = null;
      let nextInviteUrl: string | undefined;
      setStudioState((current) => {
        const normalized = normalizeStudentInput(input, current.user);
        const archived = current.archivedStudents.find(
          (item) => item.id === studentId,
        );
        if (!archived) {
          error = "Arşiv kaydı bulunamadı.";
          return current;
        }
        const email = normalized.email.trim().toLowerCase();
        if (!email) {
          error = "E-posta gerekli.";
          return current;
        }
        if (emailTaken(email, current, studentId)) {
          error = "Bu e-posta ile kayıtlı öğrenci var.";
          return current;
        }

        const token = createInviteToken();
        const student = withInvite(
          studentFromInput(studentId, normalized, email),
          token,
        );
        id = student.id;
        nextInviteUrl = inviteUrl(token);

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
            ...buildSessionsForStudent(student, {
              fromPackageStart: true,
              group: input.customGroup ?? current.customGroups.find((group) => group.id === student.groupId),
            }),
          ],
        };
      });
      if (!error) {
        const persisted = await flushStudioSnapshotPersistence();
        if (!persisted) {
          return {
            error: "Kayıt sunucuya yazılamadı. Form bilgileri korunuyor; bağlantıyı kontrol edip tekrar deneyin.",
            id: null,
          };
        }
      }
      return { error, id, inviteUrl: nextInviteUrl };
    },
    [],
  );

  const updateStudent = useCallback(
    async (studentId: string, input: NewStudentInput) => {
      const name = input.name.trim();
      if (!name) return { error: "Ad soyad gerekli.", id: null };
      if (!input.groupId) return { error: "Grup seç.", id: null };

      let error: string | null = null;
      let id: string | null = null;
      // A form can be submitted before the first remote hydration completes.
      // Enable persistence here so the explicit change is sent to Supabase.
      enableStudioSnapshotPersistence();
      setStudioState((current) => {
        const previous = current.students.find((item) => item.id === studentId);
        if (!previous) {
          error = "Öğrenci bulunamadı.";
          return current;
        }
        if (!canManageStudent(current.user, studentId, current.students)) {
          error = "Bu öğrenci sana atanmamış.";
          return current;
        }
        const normalizedBase = normalizeStudentInput(input, current.user);
        const normalized =
          current.user?.role === "instructor"
            ? { ...normalizedBase, instructorId: previous.instructorId }
            : normalizedBase;
        const email = normalized.email.trim().toLowerCase();
        if (!email) {
          error = "E-posta gerekli.";
          return current;
        }
        if (emailTaken(email, current, studentId)) {
          error = "Bu e-posta ile kayıtlı öğrenci var.";
          return current;
        }

        const attended =
          previous.package.totalSessions - previous.package.remainingSessions;
        let student = studentFromInput(studentId, normalized, email, previous);
        const periodChanged =
          student.packageHistory?.length !== (previous.packageHistory?.length ?? 0);
        student.package.remainingSessions = periodChanged
          ? normalized.totalSessions
          : Math.max(
              0,
              Math.min(normalized.totalSessions, normalized.totalSessions - attended),
            );

        if (previous.package.paymentStatus !== student.package.paymentStatus) {
          student.package.paymentUpdatedAt = new Date().toISOString();
          student.package.paymentUpdatedBy = current.user?.id ?? "system";
        } else {
          student.package.paymentUpdatedAt = previous.package.paymentUpdatedAt;
          student.package.paymentUpdatedBy = previous.package.paymentUpdatedBy;
        }
        const changes = collectStudentChanges(previous, student);
        if (changes.length > 0) {
          student.changeLog = [
            ...changes.map((change) => ({
              id: `change-${student.id}-${Date.now()}-${change.field}`,
              actorId: current.user?.id ?? "system",
              action: "update",
              ...change,
              createdAt: new Date().toISOString(),
            })),
            ...(previous.changeLog ?? []),
          ].slice(0, 100);
        }

        if (previous.accountStatus === "invited") {
          const emailChanged = email !== previous.email.toLowerCase();
          if (emailChanged) {
            const token = createInviteToken();
            student = withInvite(student, token);
          } else {
            student = {
              ...student,
              accountStatus: "invited",
              inviteToken: previous.inviteToken,
              inviteExpiresAt: previous.inviteExpiresAt,
              invitedAt: previous.invitedAt,
            };
          }
        } else {
          student = { ...student, accountStatus: previous.accountStatus ?? "active" };
        }

        id = student.id;

        // A program change must also update the student's generated timetable.
        // Retain the outcome already recorded for lessons that stay on the same date.
        const previousSessions = current.sessions.filter(
          (session) => session.studentId === studentId,
        );
        const statusByDate = new Map(
          previousSessions.map((session) => [session.date, session.status]),
        );
        const updatedSessions = buildSessionsForStudent(student, {
          fromPackageStart: true,
          group: normalized.customGroup ?? current.customGroups.find((group) => group.id === student.groupId),
        }).map((session) => ({
          ...session,
          status: statusByDate.get(session.date) ?? session.status,
        }));
        const updatedSessionIds = new Set(updatedSessions.map((session) => session.id));

        return {
          ...current,
          customGroups:
            normalized.customGroup &&
            !current.customGroups.some((group) => group.id === normalized.customGroup!.id)
              ? [...current.customGroups, normalized.customGroup]
              : current.customGroups,
          students: current.students.map((item) =>
            item.id === studentId ? student : item,
          ),
          sessions: [
            ...current.sessions.filter((session) => session.studentId !== studentId),
            ...updatedSessions,
          ],
          postponeRequests: current.postponeRequests.filter(
            (request) =>
              request.studentId !== studentId || updatedSessionIds.has(request.sessionId),
          ),
          user:
            current.user?.id === studentId && current.user.role === "student"
              ? {
                  ...current.user,
                  name: student.name,
                  email: student.email,
                }
              : current.user,
        };
      });
      if (!error) {
        const persisted = await flushStudioSnapshotPersistence();
        if (!persisted) {
          return {
            error: "Kayıt sunucuya yazılamadı. Form bilgileri korunuyor; bağlantıyı kontrol edip tekrar deneyin.",
            id: null,
          };
        }
      }
      return { error, id };
    },
    [],
  );

  const permanentlyDeleteStudent = useCallback((studentId: string) => {
    void (async () => {
      // Finish any earlier full-snapshot writes first. Otherwise a queued stale
      // snapshot can race the DELETE and recreate the student immediately.
      await flushStudioSnapshotPersistence();
      const response = await fetch("/api/studio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
      });
      if (!response.ok) {
        window.dispatchEvent(new CustomEvent("studio:persistence-error", {
          detail: "Öğrenci kalıcı olarak silinemedi. Sayfayı yenileyip tekrar deneyin.",
        }));
        return;
      }
      setStudioState((current) => ({
        ...current,
        students: current.students.filter((item) => item.id !== studentId),
        archivedStudents: current.archivedStudents.filter((item) => item.id !== studentId),
        sessions: current.sessions.filter((session) => session.studentId !== studentId),
        postponeRequests: current.postponeRequests.filter(
          (request) => request.studentId !== studentId,
        ),
      }));
    })().catch(() => {
      window.dispatchEvent(new CustomEvent("studio:persistence-error", {
        detail: "Öğrenci kalıcı olarak silinemedi. Bağlantınızı kontrol edin.",
      }));
    });
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
      if (student.monthlyPostponeLimit <= 0) return 0;
      return remainingPostponeRights(
        student,
        state.postponeRequests,
        state.sessions,
      );
    },
    [state.postponeRequests, state.sessions, state.students],
  );

  const visibleStudents = useMemo(
    () => studentsForUser(state.user, state.students),
    [state.students, state.user],
  );

  const visibleSessions = useMemo(
    () => sessionsForUser(state.user, state.sessions, state.students),
    [state.sessions, state.students, state.user],
  );

  const visiblePostponeRequests = useMemo(
    () => postponeRequestsForUser(state.user, state.postponeRequests, state.students),
    [state.postponeRequests, state.students, state.user],
  );

  const isSuperAdmin = state.user?.role === "super_admin";

  const value = useMemo<StudioContextValue>(
    () => ({
      ready,
      sessionChecked,
      studioDataStatus,
      retryStudioData,
      user: state.user,
      students: state.students,
      visibleStudents,
      archivedStudents: state.archivedStudents,
      customGroups: state.customGroups,
      sessions: state.sessions,
      visibleSessions,
      postponeRequests: state.postponeRequests,
      visiblePostponeRequests,
      isSuperAdmin,
      loginAs,
      loginStaff,
      loginStudent,
      activateStudentInvite,
      resendStudentInvite,
      changeStaffPassword,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      requestPostpone,
      withdrawPostpone,
      requestRenewal,
      reviewRenewal,
      approveRequest,
      markSessionByInstructor,
      setPostponeLessonUsed,
      setPostponeLessonNote,
      setPostponeRequestReason,
      addStudent,
      archiveStudent,
      restoreStudent,
      updateStudent,
      permanentlyDeleteStudent,
      remainingFor,
      remainingPostponeFor,
    }),
    [
      addStudent,
      approveRequest,
      archiveStudent,
      changeStaffPassword,
      loginAs,
      loginStaff,
      loginStudent,
      activateStudentInvite,
      resendStudentInvite,
      logout,
      markAttended,
      approveAttendance,
      rejectAttendance,
      markSessionByInstructor,
      setPostponeLessonUsed,
      setPostponeLessonNote,
      setPostponeRequestReason,
      permanentlyDeleteStudent,
      ready,
      sessionChecked,
      remainingFor,
      remainingPostponeFor,
      retryStudioData,
      requestPostpone,
      withdrawPostpone,
      requestRenewal,
      reviewRenewal,
      restoreStudent,
      updateStudent,
      state.archivedStudents,
      state.customGroups,
      state.postponeRequests,
      state.sessions,
      state.students,
      state.user,
      studioDataStatus,
      visiblePostponeRequests,
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
function normalizeStudentInput(
  input: NewStudentInput,
  user: StudioState["user"],
): NewStudentInput {
  if (user?.role === "instructor") {
    return { ...input, instructorId: user.id };
  }
  return input;
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

function collectStudentChanges(previous: Student, next: Student) {
  const values: Array<[string, string, string]> = [
    ["name", previous.name, next.name],
    ["email", previous.email, next.email],
    ["phone", previous.phone, next.phone],
    ["groupId", previous.groupId, next.groupId],
    ["instructorId", previous.instructorId, next.instructorId],
    ["package.startDate", previous.package.startDate, next.package.startDate],
    ["package.totalSessions", String(previous.package.totalSessions), String(next.package.totalSessions)],
    ["package.paymentStatus", previous.package.paymentStatus, next.package.paymentStatus],
  ];
  return values
    .filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ field, before, after }));
}

function withInvite(student: Student, token = createInviteToken()): Student {
  return {
    ...student,
    accountStatus: "invited",
    inviteToken: token,
    inviteExpiresAt: inviteExpiresAt(),
    invitedAt: new Date().toISOString(),
  };
}
function studentFromInput(
  id: string,
  input: NewStudentInput,
  email: string,
  previous?: Student,
): Student {
  const currentMonday = startOfWeekMonday();
  const startDate =
    input.startDate?.trim() ||
    previous?.package.startDate ||
    toISODate(addDays(currentMonday, -21));
  const sessionDates = collectSessionDates(
    startDate,
    input.groupId,
    input.totalSessions,
    input.customDays,
  );
  const customSchedule =
    input.customDays?.length && input.customTime?.trim()
      ? { days: input.customDays, time: input.customTime.trim() }
      : undefined;
  // A new package period is explicit: changing the start date or the number
  // of sessions creates history. Program/payment edits keep the current
  // period and therefore do not reset remaining lessons.
  const packagePeriodChanged = Boolean(
    previous &&
      (startDate !== previous.package.startDate ||
        input.totalSessions !== previous.package.totalSessions),
  );
  const packageHistory = [...(previous?.packageHistory ?? [])];
  if (previous && packagePeriodChanged) {
    const historyId = `pkg-${previous.id}-${previous.package.startDate}`;
    if (!packageHistory.some((entry) => entry.id === historyId)) {
      packageHistory.push({
        ...previous.package,
        id: historyId,
        createdAt: previous.package.startDate,
        endedAt: new Date().toISOString(),
      });
    }
  }
  const endDate =
    sessionDates.at(-1) ??
    previous?.package.endDate ??
    toISODate(addDays(currentMonday, 4));

  return {
    id,
    name: input.name.trim(),
    email,
    phone: input.phone.trim() || "—",
    groupId: input.groupId,
    instructorId: input.instructorId?.trim() || DEFAULT_INSTRUCTOR_ID,
    packageType: input.packageType,
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
      remainingSessions: packagePeriodChanged
        ? input.totalSessions
        : previous?.package.remainingSessions ?? input.totalSessions,
      startDate,
      endDate,
      paymentStatus: input.paymentStatus,
      paymentUpdatedAt: previous?.package.paymentUpdatedAt,
      paymentUpdatedBy: previous?.package.paymentUpdatedBy,
      isLastWeek: packagePeriodChanged ? false : previous?.package.isLastWeek ?? false,
      customSchedule,
    },
    packageHistory: packageHistory.length > 0 ? packageHistory : undefined,
    renewalRequest: previous?.renewalRequest,
    changeLog: previous?.changeLog,
    monthlyPostponeLimit: Number.isFinite(input.monthlyPostponeLimit)
      ? Math.max(0, Math.round(input.monthlyPostponeLimit))
      : 1,
    postponeLessonUsed: packagePeriodChanged
      ? false
      : previous?.postponeLessonUsed ?? false,
    postponeLessonUsedAt: packagePeriodChanged
      ? undefined
      : previous?.postponeLessonUsedAt,
    postponeLessonNote: packagePeriodChanged
      ? undefined
      : previous?.postponeLessonNote,
    accountStatus: previous?.accountStatus ?? "active",
    inviteToken: previous?.inviteToken,
    inviteExpiresAt: previous?.inviteExpiresAt,
    invitedAt: previous?.invitedAt,
  };
}
