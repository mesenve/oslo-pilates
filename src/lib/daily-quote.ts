import { DAILY_QUOTES } from "@/data/daily-quotes";
import { parseISODate } from "@/lib/dates";

export function getDailyQuote(isoDate: string): string {
  const date = parseISODate(isoDate);
  const start = new Date(date.getFullYear(), 0, 0, 12, 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}
