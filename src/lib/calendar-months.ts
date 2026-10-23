/** Calendar dates and 12-month windows are always UTC (YYYY-MM-DD). */

export function utcTodayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addCalendarMonthsUtc(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error("Invalid ISO date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthIndex = month - 1 + months;
  const nextYear = year + Math.floor(monthIndex / 12);
  const nextMonth = ((monthIndex % 12) + 12) % 12;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

/** Exclusive of today, inclusive of today + 12 calendar months, UTC dates. */
export function isDateInNext12CalendarMonths(endIso: string, todayIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endIso) || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return false;
  const horizon = addCalendarMonthsUtc(todayIso, 12);
  return endIso > todayIso && endIso <= horizon;
}
