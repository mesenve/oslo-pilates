import type {
  AuthUser,
  PostponeRequest,
  Role,
  Session,
  Student,
  StudioState,
} from "@/types/studio";

export function isStaffRole(role: Role): role is "super_admin" | "instructor" {
  return role === "super_admin" || role === "instructor" || (role as string) === "admin";
}

export function adminHomeFor(user: AuthUser) {
  if (user.role === "student") return "/ogrenci";
  return "/admin";
}

export function studentsForUser(user: AuthUser | null, students: Student[]) {
  if (!user) return [];
  if (user.role === "student") {
    return students.filter((student) => student.id === user.id);
  }
  if (user.role === "instructor") {
    return students.filter((student) => student.instructorId === user.id);
  }
  return students;
}

export function sessionsForUser(
  user: AuthUser | null,
  sessions: Session[],
  students: Student[],
) {
  const visibleIds = new Set(studentsForUser(user, students).map((s) => s.id));
  return sessions.filter((session) => visibleIds.has(session.studentId));
}

export function postponeRequestsForUser(
  user: AuthUser | null,
  requests: PostponeRequest[],
  students: Student[],
) {
  const visibleIds = new Set(studentsForUser(user, students).map((s) => s.id));
  return requests.filter((request) => visibleIds.has(request.studentId));
}

export function canManageStudent(
  user: AuthUser | null,
  studentId: string,
  students: Student[],
) {
  if (!user || user.role === "student") return false;
  if (user.role === "super_admin") return true;
  const student = students.find((item) => item.id === studentId);
  return student?.instructorId === user.id;
}

export function canAccessAdminRoute(user: AuthUser, pathname: string) {
  if (user.role === "super_admin") return true;
  const blocked = ["/admin/arsiv", "/admin/ekip"];
  if (blocked.some((route) => pathname.startsWith(route))) return false;
  return true;
}

export function staffTitle(user: AuthUser) {
  if (user.role === "super_admin") return "Yönetici";
  if (user.role === "instructor") return "Eğitmen";
  return "Öğrenci";
}
