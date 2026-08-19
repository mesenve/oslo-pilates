export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday";

export type Role = "student" | "admin";

export type SessionStatus =
  | "upcoming"
  | "attend_pending"
  | "attended"
  | "missed"
  | "postpone_pending"
  | "postponed";

export type PostponeStatus = "pending" | "approved" | "rejected";

export type PaymentStatus = "paid" | "pending" | "overdue";

export type Measurements = {
  weightKg: number;
  heightCm: number;
  waistCm: number;
  hipCm: number;
  chestCm: number;
};

export type StudentPackage = {
  totalSessions: number;
  remainingSessions: number;
  startDate: string;
  endDate: string;
  paymentStatus: PaymentStatus;
  isLastWeek: boolean;
};

export type ClassGroup = {
  id: string;
  days: DayOfWeek[];
  time: string;
  timeByDay?: Partial<Record<DayOfWeek, string>>;
  capacity: number;
  label: string;
};

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  groupId: string;
  note: string;
  measurements: Measurements;
  package: StudentPackage;
  monthlyPostponeLimit: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
};

export type Session = {
  id: string;
  studentId: string;
  groupId: string;
  date: string;
  status: SessionStatus;
};

export type PostponeRequest = {
  id: string;
  studentId: string;
  sessionId: string;
  reason: string;
  status: PostponeStatus;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type NewStudentInput = {
  name: string;
  email: string;
  phone: string;
  groupId: string;
  weightKg: number;
  heightCm: number;
  waistCm: number;
  hipCm: number;
  chestCm: number;
  totalSessions: number;
  paymentStatus: PaymentStatus;
  note: string;
  monthlyPostponeLimit: number;
};

export type StudioState = {
  user: AuthUser | null;
  students: Student[];
  archivedStudents: Student[];
  sessions: Session[];
  postponeRequests: PostponeRequest[];
};
