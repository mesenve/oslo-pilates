export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type Role = "student" | "super_admin" | "instructor";

export type StaffRole = "super_admin" | "instructor";

export type SessionStatus =
  | "upcoming"
  | "attend_pending"
  | "attended"
  | "missed"
  | "postpone_pending"
  | "postponed";

export type PostponeStatus = "pending" | "approved" | "rejected";

export type PaymentStatus = "paid" | "pending" | "overdue";

export type RenewalRequestStatus = "pending" | "approved" | "rejected";

export type RenewalRequest = {
  id: string;
  requestedStartDate?: string;
  status: RenewalRequestStatus;
  createdAt: string;
  actedAt?: string;
  actedBy?: string;
};

export type StudentChangeLogEntry = {
  id: string;
  actorId: string;
  action: string;
  field: string;
  before: string;
  after: string;
  createdAt: string;
};

export type PackageType = "group_5" | "duet_2" | "private";

export type StudentAccountStatus = "invited" | "active";

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
  paymentUpdatedAt?: string;
  paymentUpdatedBy?: string;
  frozenAt?: string;
  resumedAt?: string;
  isLastWeek: boolean;
  customSchedule?: {
    days: DayOfWeek[];
    time: string;
  };
};

/** Immutable record of a previous package period. Kept inside the student
 * package JSON so it remains compatible with the existing Supabase schema. */
export type PackageHistoryEntry = StudentPackage & {
  id: string;
  createdAt: string;
  endedAt: string;
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
  instructorId: string;
  packageType: PackageType;
  note: string;
  measurements: Measurements;
  package: StudentPackage;
  packageHistory?: PackageHistoryEntry[];
  renewalRequest?: RenewalRequest;
  changeLog?: StudentChangeLogEntry[];
  monthlyPostponeLimit: number;
  postponeLessonUsed?: boolean;
  accountStatus: StudentAccountStatus;
  inviteToken?: string;
  inviteExpiresAt?: string;
  invitedAt?: string;
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
};

/** @deprecated Use StaffUser */
export type AdminUser = StaffUser;

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
  actedAt?: string;
  actedBy?: string;
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
  instructorId: string;
  packageType: PackageType;
  weightKg: number;
  heightCm: number;
  waistCm: number;
  hipCm: number;
  chestCm: number;
  totalSessions: number;
  paymentStatus: PaymentStatus;
  note: string;
  monthlyPostponeLimit: number;
  startDate: string;
  customDays?: DayOfWeek[];
  customTime?: string;
  customGroup?: ClassGroup;
};

export type StudioState = {
  user: AuthUser | null;
  students: Student[];
  archivedStudents: Student[];
  sessions: Session[];
  postponeRequests: PostponeRequest[];
  customGroups: ClassGroup[];
  staffPasswords: Record<string, string>;
  studentPasswords: Record<string, string>;
};
