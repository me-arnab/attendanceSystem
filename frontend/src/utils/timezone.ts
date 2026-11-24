/**
 * Robust IANA Timezone utilities for frontend forms and displays.
 */

// Fallback timezone list covering major global regions if Intl.supportedValuesOf is not supported
const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Colombo',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Riyadh',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Dublin',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Honolulu',
];

/**
 * Returns a sorted list of all supported IANA timezones.
 * If currentTimezone is provided, ensures it is included in the returned list.
 */
export function getSupportedTimezones(currentTimezone?: string): string[] {
  let timezones: string[] = [];

  try {
    if (typeof Intl !== 'undefined' && typeof (Intl as any).supportedValuesOf === 'function') {
      timezones = (Intl as any).supportedValuesOf('timeZone');
    }
  } catch {
    timezones = [];
  }

  if (!timezones || timezones.length === 0) {
    timezones = [...FALLBACK_TIMEZONES];
  }

  // Ensure current timezone is included if valid and not already in the list
  if (currentTimezone && !timezones.includes(currentTimezone)) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: currentTimezone });
      timezones = [currentTimezone, ...timezones];
    } catch {
      // Ignored if invalid
    }
  }

  return Array.from(new Set(timezones)).sort((a, b) => a.localeCompare(b));
}

/**
 * Checks if a given timezone string is a valid IANA timezone.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
