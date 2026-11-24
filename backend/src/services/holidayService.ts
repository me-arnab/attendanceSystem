import { Types } from 'mongoose';
import { Holiday, IHoliday, HolidayType } from '../models/Holiday';
import { logAudit } from './auditService';

export interface ResolvedHoliday {
  _id: string;
  companyId: string;
  name: string;
  description: string;
  date: string; // Target-year resolved date: 'YYYY-MM-DD'
  endDate?: string | null; // Target-year resolved end date: 'YYYY-MM-DD'
  holidayType: HolidayType;
  isRecurring: boolean;
  originalDate: string; // The baseline stored date
  originalEndDate?: string | null;
  createdBy: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Determines whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Resolves an annual recurring date string (YYYY-MM-DD) for a specific target year.
 * Explicitly handles February 29: In non-leap years, resolves to February 28.
 */
export function resolveRecurringDateForYear(dateStr: string, targetYear: number): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;

  const month = parts[1];
  const day = parts[2];

  // Explicit February 29 handling
  if (month === '02' && day === '29') {
    if (isLeapYear(targetYear)) {
      return `${targetYear}-02-29`;
    } else {
      // In non-leap years, observe on February 28
      return `${targetYear}-02-28`;
    }
  }

  // Ensure day is valid for month in non-leap year (e.g. Feb 30/31 safety)
  if (month === '02') {
    const dayNum = parseInt(day, 10);
    const maxDays = isLeapYear(targetYear) ? 29 : 28;
    if (dayNum > maxDays) {
      return `${targetYear}-02-${String(maxDays).padStart(2, '0')}`;
    }
  }

  return `${targetYear}-${month}-${day}`;
}

/**
 * Resolves a holiday document for a specific calendar year.
 */
export function resolveHolidayForYear(holiday: IHoliday, targetYear: number): ResolvedHoliday {
  const h = holiday.toObject ? holiday.toObject() : holiday;
  const idStr = h._id ? h._id.toString() : '';

  if (!h.isRecurring) {
    return {
      _id: idStr,
      companyId: h.companyId.toString(),
      name: h.name,
      description: h.description || '',
      date: h.date,
      endDate: h.endDate || null,
      holidayType: h.holidayType,
      isRecurring: false,
      originalDate: h.date,
      originalEndDate: h.endDate || null,
      createdBy: h.createdBy,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    };
  }

  // Calculate resolved start date for target year
  const resolvedDate = resolveRecurringDateForYear(h.date, targetYear);
  let resolvedEndDate: string | null = null;

  if (h.endDate) {
    // If multi-day recurring holiday: calculate original duration in days
    const origStart = new Date(h.date);
    const origEnd = new Date(h.endDate);
    const diffDays = Math.max(
      0,
      Math.round((origEnd.getTime() - origStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (diffDays > 0) {
      const resStartDate = new Date(`${resolvedDate}T00:00:00Z`);
      const resEndDate = new Date(resStartDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
      resolvedEndDate = resEndDate.toISOString().substring(0, 10);
    } else {
      resolvedEndDate = resolvedDate;
    }
  }

  return {
    _id: idStr,
    companyId: h.companyId.toString(),
    name: h.name,
    description: h.description || '',
    date: resolvedDate,
    endDate: resolvedEndDate,
    holidayType: h.holidayType,
    isRecurring: true,
    originalDate: h.date,
    originalEndDate: h.endDate || null,
    createdBy: h.createdBy,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
  };
}

/**
 * Tests whether a specific date string (YYYY-MM-DD) falls within a holiday's active range.
 */
function dateFallsInHoliday(dateStr: string, holiday: { date: string; endDate?: string | null }): boolean {
  const start = holiday.date;
  const end = holiday.endDate || holiday.date;
  return dateStr >= start && dateStr <= end;
}

/**
 * Checks if a specific date (YYYY-MM-DD) is an approved company holiday.
 */
export async function isCompanyHoliday(
  companyId: Types.ObjectId | string,
  targetDateStr: string
): Promise<{ isHoliday: boolean; holiday?: ResolvedHoliday }> {
  const cId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
  const targetYear = parseInt(targetDateStr.slice(0, 4), 10);

  // 1. Check non-recurring holidays for this company
  // Find holidays where targetDateStr is between date and (endDate || date)
  const nonRecurring = await Holiday.find({
    companyId: cId,
    isRecurring: false,
    date: { $lte: targetDateStr },
  });

  for (const h of nonRecurring) {
    const resolved = resolveHolidayForYear(h, targetYear);
    if (dateFallsInHoliday(targetDateStr, resolved)) {
      return { isHoliday: true, holiday: resolved };
    }
  }

  // 2. Check recurring holidays for this company
  const recurring = await Holiday.find({
    companyId: cId,
    isRecurring: true,
  });

  for (const h of recurring) {
    const resolved = resolveHolidayForYear(h, targetYear);
    if (dateFallsInHoliday(targetDateStr, resolved)) {
      return { isHoliday: true, holiday: resolved };
    }
  }

  return { isHoliday: false };
}

/**
 * Retrieves all company holidays resolved for a target year and optional month.
 */
export async function getCompanyHolidays(
  companyId: Types.ObjectId | string,
  options: { year?: number; month?: number; search?: string } = {}
): Promise<ResolvedHoliday[]> {
  const cId = typeof companyId === 'string' ? new Types.ObjectId(companyId) : companyId;
  const targetYear = options.year || new Date().getFullYear();

  // Query all holidays for this company
  const holidays = await Holiday.find({ companyId: cId })
    .populate('createdBy', 'fullName email')
    .sort({ date: 1 });

  const resolvedList: ResolvedHoliday[] = [];

  for (const h of holidays) {
    if (h.isRecurring) {
      // Resolve recurring holiday for the requested year
      const resolved = resolveHolidayForYear(h, targetYear);
      resolvedList.push(resolved);
    } else {
      // Non-recurring: check if the holiday intersects the requested year
      const holidayYear = parseInt(h.date.slice(0, 4), 10);
      const holidayEndYear = h.endDate ? parseInt(h.endDate.slice(0, 4), 10) : holidayYear;

      if (targetYear >= holidayYear && targetYear <= holidayEndYear) {
        resolvedList.push(resolveHolidayForYear(h, targetYear));
      }
    }
  }

  let results = resolvedList;

  // Filter by month if specified (1-12)
  if (options.month) {
    const monthStr = String(options.month).padStart(2, '0');
    results = results.filter((h) => {
      const startMonth = h.date.split('-')[1];
      const endMonth = (h.endDate || h.date).split('-')[1];
      return startMonth === monthStr || endMonth === monthStr;
    });
  }

  // Search filter
  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    results = results.filter(
      (h) => h.name.toLowerCase().includes(q) || (h.description && h.description.toLowerCase().includes(q))
    );
  }

  // Sort chronologically by resolved start date
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns upcoming holidays starting from fromDateStr (default today).
 */
export async function getUpcomingHolidays(
  companyId: Types.ObjectId | string,
  fromDateStr: string,
  limit = 5
): Promise<ResolvedHoliday[]> {
  const fromYear = parseInt(fromDateStr.slice(0, 4), 10);

  // Fetch holidays for this year and next year to ensure upcoming coverage
  const [thisYearHolidays, nextYearHolidays] = await Promise.all([
    getCompanyHolidays(companyId, { year: fromYear }),
    getCompanyHolidays(companyId, { year: fromYear + 1 }),
  ]);

  const combined = [...thisYearHolidays, ...nextYearHolidays];

  // Filter for holidays where endDate (or date) is on or after fromDateStr
  const upcoming = combined.filter((h) => (h.endDate || h.date) >= fromDateStr);

  // Remove potential duplicates if date spans crossed years
  const seenIds = new Set<string>();
  const uniqueUpcoming: ResolvedHoliday[] = [];

  for (const h of upcoming) {
    const key = `${h._id}-${h.date}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueUpcoming.push(h);
    }
  }

  uniqueUpcoming.sort((a, b) => a.date.localeCompare(b.date));
  return uniqueUpcoming.slice(0, limit);
}

/**
 * Validates whether a new or updated holiday would create an accidental duplicate.
 */
export async function checkHolidayConflict(
  companyId: Types.ObjectId,
  date: string,
  endDate?: string | null,
  excludeId?: string
): Promise<{ hasConflict: boolean; conflictingHolidayName?: string }> {
  const start = date;
  const end = endDate || date;

  const query: any = {
    companyId,
    $or: [
      // Direct date match or range overlap
      { date: { $lte: end }, endDate: { $gte: start } },
      { date: { $gte: start, $lte: end }, endDate: null },
      { date: start },
    ],
  };

  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const existing = await Holiday.findOne(query);
  if (existing) {
    return { hasConflict: true, conflictingHolidayName: existing.name };
  }

  return { hasConflict: false };
}
