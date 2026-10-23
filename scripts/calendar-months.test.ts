import assert from "node:assert/strict";
import {
  addCalendarMonthsUtc,
  isDateInNext12CalendarMonths,
  utcTodayIso,
} from "../src/lib/calendar-months.ts";

assert.equal(utcTodayIso(new Date("2026-10-16T23:30:00Z")), "2026-10-16");
assert.equal(addCalendarMonthsUtc("2026-01-31", 1), "2026-02-28");
assert.equal(addCalendarMonthsUtc("2024-02-29", 12), "2025-02-28");
assert.equal(addCalendarMonthsUtc("2026-10-16", 12), "2027-10-16");

const today = "2026-10-16";
assert.equal(isDateInNext12CalendarMonths("2026-10-16", today), false);
assert.equal(isDateInNext12CalendarMonths("2026-10-17", today), true);
assert.equal(isDateInNext12CalendarMonths("2027-10-16", today), true);
assert.equal(isDateInNext12CalendarMonths("2027-10-17", today), false);

const leapToday = "2024-02-29";
assert.equal(isDateInNext12CalendarMonths("2024-02-29", leapToday), false);
assert.equal(isDateInNext12CalendarMonths("2025-02-28", leapToday), true);
assert.equal(isDateInNext12CalendarMonths("2025-03-01", leapToday), false);

console.log("calendar-months tests passed");
