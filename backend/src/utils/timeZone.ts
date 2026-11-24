/**
 * Centralized TimeZone and Date Utility for Improx Monitoring System
 * Default Timezone: Asia/Kolkata (IST = UTC + 5:30)
 */

export const COMPANY_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// IST is fixed UTC+05:30 (5 hours, 30 minutes = 330 minutes = 19,800,000 ms)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Returns YYYY-MM-DD string in the company timezone (Asia/Kolkata)
 */
export function getCompanyTodayString(d: Date = new Date()): string {
  // Convert UTC timestamp to IST timestamp
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split('T')[0];
}

/**
 * Given a "YYYY-MM-DD" date string (in Asia/Kolkata timezone),
 * returns the exact UTC Date objects for 00:00:00.000 IST and 23:59:59.999 IST.
 * 
 * Example for 2026-11-23:
 * startOfDay = 2026-11-22T18:30:00.000Z (00:00:00 IST)
 * endOfDay   = 2026-11-23T18:29:59.999Z (23:59:59.999 IST)
 */
export function getDayBounds(dateStr: string): { startOfDay: Date; endOfDay: Date } {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  // UTC midnight for the requested date minus 5.5 hours
  const startOfDayMs = Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endOfDayMs = Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS;

  return {
    startOfDay: new Date(startOfDayMs),
    endOfDay: new Date(endOfDayMs)
  };
}

/**
 * Format Date to 12-hour formatted time in company timezone
 * Example: "10:30 am"
 */
export function formatToCompanyTime(d: Date): string {
  try {
    return d.toLocaleTimeString('en-US', {
      timeZone: COMPANY_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  } catch (e) {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    let h = ist.getUTCHours();
    const m = ist.getUTCMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${m}${ampm}`;
  }
}

/**
 * Mathematically validates and bounds attendance records against physical wall-clock time.
 * Invariant: totalActiveSeconds + totalIdleSeconds + manualPauseSeconds <= maxAllowedShiftSeconds
 * where maxAllowedShiftSeconds = Math.max(0, Math.floor(((clockOutAt || asOf) - clockInAt) / 1000)).
 *
 * This mathematically guarantees that no matter what delays, retries, sleeps or intervals occur,
 * tracked time CANNOT exceed the physical time elapsed since clock in.
 */
export function sanitizeAttendanceTimes(att: {
  clockInAt: Date | string;
  clockOutAt?: Date | string | null;
  totalActiveSeconds?: number | null;
  totalIdleSeconds?: number | null;
  manualPauseSeconds?: number | null;
  totalWorkSeconds?: number | null;
}, asOf: Date = new Date()) {
  const clockInMs = new Date(att.clockInAt).getTime();
  const endMs = att.clockOutAt ? new Date(att.clockOutAt).getTime() : asOf.getTime();
  const maxAllowedSeconds = Math.max(0, Math.floor((endMs - clockInMs) / 1000));

  let active = Math.max(0, Math.round(att.totalActiveSeconds || 0));
  let idle = Math.max(0, Math.round(att.totalIdleSeconds || 0));
  let pause = Math.max(0, Math.round(att.manualPauseSeconds || 0));

  // 1. Active work cannot exceed total physical elapsed time
  active = Math.min(active, maxAllowedSeconds);

  // 2. Maximum remaining time allowed for idle/break is elapsed minus active work
  const maxRemainingForBreaks = Math.max(0, maxAllowedSeconds - active);
  const combinedBreaks = idle + pause;

  if (combinedBreaks > maxRemainingForBreaks) {
    if (combinedBreaks > 0) {
      idle = Math.round((idle / combinedBreaks) * maxRemainingForBreaks);
      pause = maxRemainingForBreaks - idle;
    } else {
      idle = 0;
      pause = 0;
    }
  }

  const finalBreaks = idle + pause;
  const finalTotalWork = active + finalBreaks;

  return {
    totalActiveSeconds: active,
    totalIdleSeconds: idle,
    manualPauseSeconds: pause,
    combinedBreakSeconds: finalBreaks,
    totalWorkSeconds: finalTotalWork,
    maxAllowedSeconds
  };
}

