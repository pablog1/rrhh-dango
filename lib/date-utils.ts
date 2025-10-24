import { subDays, format, isWeekend } from 'date-fns';

/**
 * Get the last N workdays (excluding weekends)
 * @param count Number of workdays to get
 * @returns Array of Date objects representing the last N workdays
 */
export function getLastWorkdays(count: number): Date[] {
  const workdays: Date[] = [];
  let currentDay = subDays(new Date(), 1); // Start from yesterday

  while (workdays.length < count) {
    if (!isWeekend(currentDay)) {
      workdays.push(currentDay);
    }
    currentDay = subDays(currentDay, 1);
  }

  return workdays;
}

/**
 * Get the date range for the last N workdays
 * @param count Number of workdays
 * @returns Object with 'from' (oldest) and 'to' (most recent) dates
 */
export function getLastWorkdaysRange(count: number): { from: Date; to: Date } {
  const workdays = getLastWorkdays(count);

  return {
    from: workdays[workdays.length - 1], // Oldest workday
    to: workdays[0],                      // Most recent workday
  };
}

/**
 * Format a date to ISO string for API consistency
 * @param date Date to format
 * @returns ISO date string
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get formatted date range for display
 * @param from Start date
 * @param to End date
 * @returns Formatted string like "2025-01-20 to 2025-01-21"
 */
export function formatDateRange(from: Date, to: Date): string {
  return `${toISODate(from)} to ${toISODate(to)}`;
}
