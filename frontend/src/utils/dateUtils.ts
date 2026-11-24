/**
 * Dynamic tenant-local date and time utility functions.
 * Prevents UTC off-by-one errors and removes hardcoded years.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the company's timezone.
 */
export function getCompanyTodayString(timezone?: string): string {
  try {
    const tz = timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // en-CA formats as YYYY-MM-DD
  } catch {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Returns the current year and 1-indexed month in the company's timezone.
 */
export function getCompanyYearMonth(timezone?: string): { year: number; month: number } {
  try {
    const tz = timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    const yearPart = parts.find((p) => p.type === 'year')?.value;
    const monthPart = parts.find((p) => p.type === 'month')?.value;
    return {
      year: yearPart ? parseInt(yearPart, 10) : new Date().getFullYear(),
      month: monthPart ? parseInt(monthPart, 10) : new Date().getMonth() + 1,
    };
  } catch {
    const d = new Date();
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    };
  }
}

/**
 * Returns month options (1-12) with localized month names.
 */
export function getLocalizedMonthOptions(locale: string = 'en-US'): { value: number; label: string }[] {
  const months: { value: number; label: string }[] = [];
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });

  for (let m = 0; m < 12; m++) {
    // Reference date (month m, day 1) to extract localized month name
    const date = new Date(2000, m, 1);
    months.push({
      value: m + 1,
      label: formatter.format(date),
    });
  }

  return months;
}

/**
 * Returns an array of available years dynamically centered around currentYear.
 * Defaults to 5 years in the past up to 1 year in the future.
 */
export function getAvailableYears(currentYear?: number, pastCount = 5, futureCount = 1): number[] {
  const base = currentYear || new Date().getFullYear();
  const years: number[] = [];
  for (let y = base - pastCount; y <= base + futureCount; y++) {
    years.push(y);
  }
  return years.sort((a, b) => b - a); // Descending order (newest first)
}

/**
 * Formats a date or ISO string in the specified timezone.
 */
export function formatDateInTimezone(
  dateInput: Date | string | undefined | null,
  timezone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: timezone || 'UTC',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats time in the specified timezone.
 */
export function formatTimeInTimezone(
  dateInput: Date | string | undefined | null,
  timezone?: string
): string {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '-';

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/**
 * Converts a UTC Date/ISO string to an input value for <input type="datetime-local" /> in the specified timezone.
 * Returns "YYYY-MM-DDTHH:mm".
 */
export function toDateTimeLocalString(
  dateInput: Date | string | undefined | null,
  timezone?: string
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  try {
    const tz = timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const h = parts.find((p) => p.type === 'hour')?.value;
    const min = parts.find((p) => p.type === 'minute')?.value;
    if (y && m && d && h && min) {
      return `${y}-${m}-${d}T${h}:${min}`;
    }
  } catch {
    // fallback to slice
  }

  return date.toISOString().slice(0, 16);
}
