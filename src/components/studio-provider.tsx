"use client";

import { remainingPostponeRights, remainingSessions } from "@/data/accessors";
import {
  DEFAULT_INSTRUCTOR_ID,
  getStaffById,
} from "@/data/staff";
import { buildSessionsForStudent, collectSessionDates } from "@/data/seed";
import { studentsForUser, sessionsForUser, postponeRequestsForUser, canManageStudent, isStaffRole } from "@/lib/access";
import { fetchAttendanceMarks, pushAttendanceMark } from "@/lib/attendance-client";
import { mergeActivatedInvites, mergeAttendanceMarks } from "@/lib/attendance-sync";
import { addDays, startOfWeekMonday, toISODate, todayISO } from "@/lib/dates";
import {
  getStaffPassword,
  validateNewPassword,
} from "@/lib/staff-auth";
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
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

type StudentActionResult = {
  error: string | null;
  id: string | null;
  inviteUrl?: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  invitedAt?: string;
};

type StudioContextValue = {
  ready: boolean;
  user: StudioState["user"];
  students: Student[];
  visibleStudents: Student[];
  archivedStudents: Student[];
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
  ) => { error: string | null; success: boolean };
  logout: () => void;
  markAttended: (sessionId: string) => void;
  approveAttendance: (sessionIds: string[]) => void;
  rejectAttendance: (sessionIds: string[]) => void;
  requestPostpone: (sessionId: string, reason: string) => void;
  approveRequest: (requestId: string) => void;
  markSessionByInstructor: (
    sessionId: string,
    outcome: "attended" | "postponed" | "missed" | "upcoming",
  ) => void;
  addStudent: (input: NewStudentInput) => StudentActionResult;
  archiveStudent: (studentId: string) => void;
  restoreStudent: (
    studentId: string,
    input: NewStudentInput,
  ) => StudentActionResult;
  updateStudent: (
    studentId: string,
    input: NewStudentInput,
  ) => StudentActionResult;
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

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((response) => response.ok ? response.json() : { user: null })
      .then((data: { user?: StudioState["user"] }) => {
        if (!cancelled) setStudioState((current) => ({ ...current, user: data.user ?? null }));
      })
      .catch(() => {
        if (!cancelled) setStudioState((current) => ({ ...current, user: null }));
      });
    return () => { cancelled = true; };
  }, [ready]);

  useEffect(() => {
    if (!ready || !state.user) return;

    let cancelled = false;

    async function syncRemoteState() {
      try {
        const user = state.user!;
        const marksPromise =
          user.role === "student"
            ? fetchAttendanceMarks({ studentId: user.id })
            : isStaffRole(user.role)
              ? fetchAttendanceMarks()
              : Promise.resolve([]);

        const invitesPromise =
          user.role === "super_admin"
            ? fetchActivatedInvites()
            : Promise.resolve([]);

        const studioPromise =
          user.role === "student"
            ? fetchStudioSnapshot({
                studentId: user.id,
                includeBlockedEmails: false,
              })
            : isStaffRole(user.role)
              ? fetchStudioSnapshot()
              : Promise.resolve(null);

        const [marks, invites, remoteStudio] = await Promise.all([
          marksPromise,
          invitesPromise,
          studioPromise,
        ]);
        if (
          cancelled ||
          (marks.length === 0 && invites.length === 0 && !remoteStudio)
        ) {
          return;
        }

        setStudioState((current) => {
          let next = remoteStudio
            ? {
                ...current,
                ...remoteStudio,
                user: current.user,
                staffPasswords: current.staffPasswords,
                studentPasswords: current.studentPasswords,
              }
            : current;
          if (invites.length > 0) {
            next = mergeActivatedInvites(next, invites);
          }
          if (marks.length > 0) {
            next = {
              ...next,
              sessions: mergeAttendanceMarks(next.sessions, marks),
            };
          }
          return next;
        });
        if (remoteStudio) enableStudioSnapshotPersistence();
      } catch {
        // Ağ hatasında yerel durum korunur.
      }
    }

    void syncRemoteState();
    const interval = window.setInterval(syncRemoteState, 12000);
    const onFocus = () => {
      void syncRemoteState();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncRemoteState();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, state.user?.id, state.user?.role]);

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

    if (localStudent) {
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

    setStudioState((current) => {
      const student = current.students.find((item) => item.id === studentId);
      if (
        !student ||
        student.accountStatus !== "invited" ||
        !canManageStudent(current.user, studentId, current.students)
      ) {
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
    };
  }, []);

  const changeStaffPassword = useCallback(
    (
      staffId: string,
      currentPassword: string,
      newPassword: string,
      confirmPassword: string,
    ) => {
      const validationError = validateNewPassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      if (validationError) {
        return { error: validationError, success: false };
      }

      let error: string | null = "Mevcut şifre hatalı.";
      let success = false;
      setStudioState((current) => {
        const stored = getStaffPassword(staffId, current.staffPasswords);
        if (currentPassword !== stored) return current;
        error = null;
        success = true;
        return {
          ...current,
          staffPasswords: {
            ...current.staffPasswords,
            [staffId]: newPassword,
          },
        };
      });
      return { error, success };
    },
    [],
  );

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
        }));
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
        }));
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
        }));
      } catch {
        // Geri alma sunucuya yazılamazsa yerel durum değişmez.
      }
    })();
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
      if (
        !request ||
        request.status !== "pending" ||
        !canManageStudent(current.user, request.studentId, current.students)
      ) {
        return current;
      }
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
    (
      sessionId: string,
      outcome: "attended" | "postponed" | "missed" | "upcoming",
    ) => {
      const current = getStudioSnapshot();
      const session = current.sessions.find((item) => item.id === sessionId);
      if (!session || !canManageStudent(current.user, session.studentId, current.students)) {
        return;
      }
      void fetch("/api/sessions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status: outcome }),
      });
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
      });
    },
    [],
  );

  const addStudent = useCallback((input: NewStudentInput) => {
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
        students: [student, ...current.students],
        sessions: [
          ...current.sessions,
          ...buildSessionsForStudent(student, { fromPackageStart: true }),
        ],
      };
    });
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
    (studentId: string, input: NewStudentInput) => {
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
            ...buildSessionsForStudent(student, { fromPackageStart: true }),
          ],
        };
      });
      return { error, id, inviteUrl: nextInviteUrl };
    },
    [],
  );

  const updateStudent = useCallback(
    (studentId: string, input: NewStudentInput) => {
      const name = input.name.trim();
      if (!name) return { error: "Ad soyad gerekli.", id: null };
      if (!input.groupId) return { error: "Grup seç.", id: null };

      let error: string | null = null;
      let id: string | null = null;
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
        student.package.remainingSessions = Math.max(
          0,
          Math.min(normalized.totalSessions, normalized.totalSessions - attended),
        );

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

        return {
          ...current,
          students: current.students.map((item) =>
            item.id === studentId ? student : item,
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

  const visiblePostponeRequests = useMemo(
    () => postponeRequestsForUser(state.user, state.postponeRequests, state.students),
    [state.postponeRequests, state.students, state.user],
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
      approveRequest,
      markSessionByInstructor,
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
      permanentlyDeleteStudent,
      ready,
      remainingFor,
      remainingPostponeFor,
      requestPostpone,
      restoreStudent,
      updateStudent,
      state.archivedStudents,
      state.postponeRequests,
      state.sessions,
      state.students,
      state.user,
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
      remainingSessions: previous?.package.remainingSessions ?? input.totalSessions,
      startDate,
      endDate,
      paymentStatus: input.paymentStatus,
      isLastWeek: previous?.package.isLastWeek ?? false,
      customSchedule,
    },
    monthlyPostponeLimit: Number.isFinite(input.monthlyPostponeLimit)
      ? Math.max(0, Math.round(input.monthlyPostponeLimit))
      : 1,
    accountStatus: previous?.accountStatus ?? "active",
    inviteToken: previous?.inviteToken,
    inviteExpiresAt: previous?.inviteExpiresAt,
    invitedAt: previous?.invitedAt,
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
