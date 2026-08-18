import { PAYMENT_LABELS, REQUEST_LABELS, SESSION_LABELS } from "@/lib/labels";
import type { PaymentStatus, PostponeStatus, SessionStatus } from "@/types/studio";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/70 bg-white/70 shadow-[0_8px_24px_rgba(194,24,91,0.06)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary:
      "bg-gradient-to-r from-[#ec407a] to-accent text-white shadow-[0_8px_20px_rgba(194,24,91,0.28)] hover:from-accent hover:to-accent-hover disabled:from-accent-soft disabled:to-accent-soft disabled:text-accent disabled:shadow-none",
    secondary:
      "bg-white text-accent border border-accent/30 hover:bg-accent-soft",
    ghost: "bg-transparent text-muted hover:text-foreground hover:bg-surface-muted",
    danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  const styles = {
    neutral: "bg-surface-muted text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid" ? "success" : status === "pending" ? "warning" : "danger";
  return <Badge tone={tone}>{PAYMENT_LABELS[status]}</Badge>;
}

export function SessionBadge({ status }: { status: SessionStatus }) {
  const tone =
    status === "attended"
      ? "success"
      : status === "attend_pending" ||
          status === "postpone_pending" ||
          status === "postponed"
        ? "warning"
        : status === "missed"
          ? "danger"
          : "neutral";
  return <Badge tone={tone}>{SESSION_LABELS[status]}</Badge>;
}

export function RequestBadge({ status }: { status: PostponeStatus }) {
  const tone =
    status === "approved"
      ? "success"
      : status === "rejected"
        ? "danger"
        : "warning";
  return <Badge tone={tone}>{REQUEST_LABELS[status]}</Badge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border/80 bg-white/40 px-6 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
