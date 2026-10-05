/**
 * Opening-hours parsing for structured data.
 *
 * `site.config.ts` keeps the hours in the human-readable schema.org syntax
 * (`Mo 09:00-18:00`) because the same array is the published business-hours
 * copy. Google reads `openingHoursSpecification` far more reliably than the
 * free-text `openingHours` property, so the RealEstateAgent node derives the
 * specification from that one source instead of duplicating the hours.
 */

import type { DayOfWeek, OpeningHoursSpecification } from 'schema-dts';

/** schema.org day tokens in week order; day ranges expand along this list. */
const DAY_TOKENS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

type DayToken = (typeof DAY_TOKENS)[number];

const DAY_URLS: Record<DayToken, DayOfWeek> = {
  Mo: 'https://schema.org/Monday',
  Tu: 'https://schema.org/Tuesday',
  We: 'https://schema.org/Wednesday',
  Th: 'https://schema.org/Thursday',
  Fr: 'https://schema.org/Friday',
  Sa: 'https://schema.org/Saturday',
  Su: 'https://schema.org/Sunday',
};

/** Day index like `Date#getDay()` (0 = Sunday), so callers need no day names. */
const DAY_INDEXES: Record<DayToken, number> = {
  Su: 0,
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6,
};

const DAY_NAMES: Record<DayToken, string> = {
  Su: 'Sunday',
  Mo: 'Monday',
  Tu: 'Tuesday',
  We: 'Wednesday',
  Th: 'Thursday',
  Fr: 'Friday',
  Sa: 'Saturday',
};

/** Weekday tokens ordered like `Date#getDay()`, so index 0 is Sunday. */
const SUNDAY_FIRST: readonly DayToken[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Weekday name for a `Date#getDay()` index (0 = Sunday). */
export function dayName(index: number): string {
  const day = SUNDAY_FIRST[index];
  return day ? DAY_NAMES[day] : '';
}

/** One parsed window: the days it covers and the clock range it runs. */
export interface OpeningWindow {
  /** Every day the window covers, in week order — a range expands to its days. */
  days: DayToken[];
  /** `HH:MM`. */
  opens: string;
  /** `HH:MM`. */
  closes: string;
}

/** The weekday indexes a window covers, ready for arithmetic on a `Date`. */
export function openingWindowDays(window: OpeningWindow): number[] {
  return window.days.map((day) => DAY_INDEXES[day]);
}

const ENTRY = /^(\S+)\s+(.+)$/;
/** One `HH:MM-HH:MM` range: real clock values on both sides (00:00–23:59). */
const TIME_RANGE = /^((?:[01]\d|2[0-3]):[0-5]\d)-((?:[01]\d|2[0-3]):[0-5]\d)$/;

function isDayToken(value: string): value is DayToken {
  return (DAY_TOKENS as readonly string[]).includes(value);
}

/** The days a token names: `Mo`, or a range like `We-Su` (which may wrap). */
function daysFor(token: string, entry: string): DayToken[] {
  const [from, to, ...rest] = token.split('-');
  if (!isDayToken(from) || rest.length > 0) {
    throw new Error(`Unreadable day "${token}" in opening hours "${entry}"`);
  }
  if (to === undefined) return [from];
  if (!isDayToken(to)) {
    throw new Error(`Unreadable day "${to}" in opening hours "${entry}"`);
  }

  const start = DAY_TOKENS.indexOf(from);
  const end = DAY_TOKENS.indexOf(to);
  const days: DayToken[] = [];
  for (let index = start; ; index = (index + 1) % DAY_TOKENS.length) {
    days.push(DAY_TOKENS[index]);
    if (index === end) return days;
  }
}

/**
 * Parse entries like `Mo 09:00-18:00`, `We-Su 09:00-18:00` and
 * `Sa 09:00-12:00,13:00-18:00` into one window per day set and time range, with
 * the days as tokens rather than schema.org URLs — so a caller doing arithmetic
 * on a date does not have to parse the URL back out again. Throws on anything it
 * cannot read: the array is build-time config, so a typo should fail the build
 * rather than quietly publish wrong hours.
 */
export function parseOpeningHours(entries: string[]): OpeningWindow[] {
  const windows: OpeningWindow[] = [];

  for (const entry of entries) {
    const match = ENTRY.exec(entry.trim());
    if (!match) {
      throw new Error(`Unreadable opening hours "${entry}" (expected e.g. "Mo 09:00-18:00")`);
    }

    const [, token, times] = match;
    const days = daysFor(token, entry);

    for (const time of times.split(',')) {
      const range = TIME_RANGE.exec(time.trim());
      const [, opens, closes] = range ?? [];
      if (!opens || !closes) {
        throw new Error(`Unreadable time range "${time.trim()}" in opening hours "${entry}"`);
      }
      windows.push({ days, opens, closes });
    }
  }

  return windows;
}

/** The same windows as schema.org `openingHoursSpecification` entries. */
export function openingHoursSpecifications(entries: string[]): OpeningHoursSpecification[] {
  return parseOpeningHours(entries).map(({ days, opens, closes }) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: days.map((day) => DAY_URLS[day]),
    opens,
    closes,
  }));
}
