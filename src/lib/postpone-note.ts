/** Placeholder written when an instructor marks postponed without a note. */
export const INSTRUCTOR_POSTPONE_PLACEHOLDER = "Eğitmen erteleme işaretledi.";

/** Note text safe to show on the student side (hides empty / internal placeholders). */
export function studentVisiblePostponeNote(
  reason?: string | null,
  fallback?: string | null,
) {
  const pick = (value?: string | null) => {
    const trimmed = value?.trim() ?? "";
    if (!trimmed || trimmed === INSTRUCTOR_POSTPONE_PLACEHOLDER) return "";
    return trimmed;
  };
  return pick(reason) || pick(fallback) || undefined;
}
