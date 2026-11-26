/**
 * Unit tests for committed frontend dateUtils and timezone utilities.
 * Run via: npx --prefix backend tsx frontend/src/utils/dateUtils.test.ts
 */
import assert from 'node:assert/strict';
import {
  getCompanyTodayString,
  getCompanyYearMonth,
  getLocalizedMonthOptions,
  getAvailableYears,
  formatDateInTimezone,
  formatTimeInTimezone,
  toDateTimeLocalString,
} from './dateUtils';
import { getSupportedTimezones, isValidTimezone } from './timezone';

// Date formatting
assert.match(getCompanyTodayString('UTC'), /^\d{4}-\d{2}-\d{2}$/);
const ym = getCompanyYearMonth('Asia/Kolkata');
assert.ok(ym.year >= 2024);
assert.ok(ym.month >= 1 && ym.month <= 12);

// Localized months and years
const months = getLocalizedMonthOptions('en-US');
assert.equal(months.length, 12);
assert.equal(months[0].label, 'January');

const years = getAvailableYears(2026, 2, 1);
assert.deepEqual(years, [2027, 2026, 2025, 2024]);

// Timezone-aware formatting
assert.equal(formatDateInTimezone(null, 'UTC'), '-');
assert.equal(formatTimeInTimezone(undefined, 'UTC'), '-');
assert.equal(formatDateInTimezone('2026-11-25T15:00:00Z', 'UTC'), 'Nov 25, 2026');
assert.equal(toDateTimeLocalString('2026-11-25T15:30:00Z', 'UTC'), '2026-11-25T15:30');

// Supported timezones
assert.equal(isValidTimezone('Asia/Kolkata'), true);
assert.equal(isValidTimezone('Not/A_Timezone'), false);
const tzList = getSupportedTimezones('Asia/Kolkata');
assert.ok(tzList.includes('Asia/Kolkata'));
assert.ok(tzList.length > 10);

console.log('[PASS] All frontend dateUtils & timezone unit tests passed.');
