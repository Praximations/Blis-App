// Which days can still be ordered for, worked out on the phone from the
// rules. The same arithmetic as the website's basket (Blis repo,
// assets/blis-theme.js: shopClock, slotCutoff, slotOrderBy, upcoming,
// matchArea), so both offer the same days. Nothing here reads the clock or
// the network: callers pass `now`.

import type { CutoffMode, DayLimit, DeliveryDay, Rules, Slot, TimeWindow } from './types';

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAY = 86_400_000;

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function dayIndex(name: string | null | undefined): number | null {
  const i = WEEKDAYS.indexOf(String(name ?? '').toLowerCase().trim());
  return i < 0 ? null : i;
}

export const isPickup = (slot: Slot | null | undefined) => !!slot && slot.type === 'pickup';

/** "noon", "midnight", "9am", "3pm", "12:30pm". */
export function clockText(hour: number | string, minute: number | string = 0): string {
  const h = Number(hour) || 0;
  const m = Number(minute) || 0;
  if (!m) {
    if (h === 12) return 'noon';
    if (h === 0) return 'midnight';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }
  return `${h % 12 || 12}:${m < 10 ? '0' : ''}${m}${h < 12 ? 'am' : 'pm'}`;
}

/** "A", "A and B", "A, B and C". */
export function sentenceList(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? '');
}

/**
 * The shop's wall clock as UTC numbers (today at midnight, and now), so days
 * and cut-offs compare without timezone arithmetic.
 */
export function shopClock(timeZone: string, now: Date): { today: number; now: number } {
  try {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const p: Record<string, number> = {};
    for (const part of format.formatToParts(now)) {
      if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10);
    }
    if (p.hour === 24) p.hour = 0;
    if ([p.year, p.month, p.day, p.hour, p.minute].some((n) => !Number.isFinite(n))) throw new Error('clock');
    return {
      today: Date.UTC(p.year, p.month - 1, p.day),
      now: Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute),
    };
  } catch {
    // No time zone data on this phone: its own clock is the best there is.
    return {
      today: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
      now: Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()),
    };
  }
}

/** A calendar day ("2026-11-18") as a UTC number, or null. */
export function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** The ways a day is written, from its UTC number. */
export function dayLabels(time: number) {
  const d = new Date(time);
  const weekday = WEEKDAY_NAMES[d.getUTCDay()];
  const month = MONTHS[d.getUTCMonth()];
  return {
    /** "Wednesday, November 18" */
    label: `${weekday}, ${month} ${d.getUTCDate()}`,
    weekday,
    weekdayShort: weekday.slice(0, 3),
    /** "Nov 18" */
    monthDay: `${month.slice(0, 3)} ${d.getUTCDate()}`,
  };
}

/**
 * When ordering closes for a delivery or pickup day: the slot's cut-off day
 * before it, at its hour. null for a slot without a usable day.
 */
export function slotCutoff(
  slot: Pick<Slot, 'day' | 'cutoffDay' | 'cutoffHour' | 'cutoffMinute' | 'cutoffDaysBefore'>,
  dayUtc: number,
): number | null {
  const di = dayIndex(slot.day);
  const ci = dayIndex(slot.cutoffDay);
  if (di === null || ci === null) return null;
  const back = slot.cutoffDaysBefore != null ? Number(slot.cutoffDaysBefore) : (di - ci + 7) % 7;
  return dayUtc - back * DAY + ((Number(slot.cutoffHour) || 0) * 60 + (Number(slot.cutoffMinute) || 0)) * 60_000;
}

/**
 * The order-by time that counts for a day. 'own' is for products with their
 * own order-by times (beef), 'both' for a basket mixing them with other
 * products (the earlier of the two), anything else the day's own cut-off.
 */
export function slotOrderBy(slot: Slot, dayUtc: number, mode: CutoffMode) {
  const shop = {
    time: slotCutoff(slot, dayUtc),
    day: slot.cutoffDay,
    hour: slot.cutoffHour,
    minute: slot.cutoffMinute ?? 0,
  };
  if ((mode !== 'own' && mode !== 'both') || !slot.ownCutoffDay) return shop;
  const own = {
    time: slotCutoff({ day: slot.day, cutoffDay: slot.ownCutoffDay, cutoffHour: slot.ownCutoffHour ?? 0 }, dayUtc),
    day: slot.ownCutoffDay,
    hour: slot.ownCutoffHour ?? 0,
    minute: 0,
  };
  if (own.time === null) return shop;
  return mode === 'both' && shop.time !== null && shop.time < own.time ? shop : own;
}

export const deliverySlots = (rules: Rules) => rules.slots.filter((s) => !isPickup(s));
export const pickupSlots = (rules: Rules) => rules.slots.filter(isPickup);

/** Delivery days for an area. */
export function slotsFor(rules: Rules, area: string | null | undefined): Slot[] {
  if (!area) return [];
  const wanted = area.toLowerCase();
  return deliverySlots(rules).filter((s) => s.areas.some((a) => a.toLowerCase() === wanted));
}

export function areas(rules: Rules): string[] {
  const seen = new Set<string>();
  for (const slot of deliverySlots(rules)) for (const area of slot.areas) seen.add(area);
  return [...seen];
}

// Lower case letters and single spaces, without a leading "the".
const placeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');

/**
 * A ZIP code, or a town name. An area can list several towns split by "/"
 * (Lake Worth / Lantana / Greenacres) and each of them matches.
 */
export function matchArea(rules: Rules, query: string): { area: string | null; zip: string | null } | null {
  const q = query.trim();
  if (!q) return null;
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 5) {
    const zip = digits.slice(0, 5);
    return { area: rules.zips[zip] || null, zip };
  }
  const lower = placeName(q);
  if (!lower) return { area: null, zip: null };
  let found: string | null = null;
  for (const area of areas(rules)) {
    for (const town of area.split('/')) {
      const name = placeName(town);
      if (!found && name && (name === lower || lower.includes(name) || (lower.length >= 4 && name.startsWith(lower)))) {
        found = area;
      }
    }
  }
  return { area: found, zip: null };
}

/**
 * The weekdays every limited product in the basket allows, or null when
 * nothing in the basket is limited.
 */
export function allowedWeekdays(limits: DayLimit[]): number[] | null {
  if (!limits.length) return null;
  let allowed = [0, 1, 2, 3, 4, 5, 6];
  for (const limit of limits) allowed = allowed.filter((d) => limit.days.includes(d));
  return allowed;
}

/** "Guernsey Raw Milk is available on Sundays only." */
export function limitText(limits: DayLimit[]): string {
  const allowed = allowedWeekdays(limits);
  if (!allowed) return '';
  const names = limits.map((l) => l.name).filter(Boolean);
  const who = sentenceList(names) || 'Some items';
  if (!allowed.length) {
    return `${who} go out on different days, so they can’t share one order. Please order them separately.`;
  }
  const days = sentenceList(allowed.map((i) => `${WEEKDAY_NAMES[i]}s`));
  return `${who} ${names.length > 1 ? 'are' : 'is'} available on ${days} only.`;
}

export interface UpcomingOptions {
  /** The area to deliver to (delivery days). */
  area?: string | null;
  /** true: pickup days only; false: delivery days only; left out: both. */
  pickup?: boolean;
  limits?: DayLimit[];
  mode?: CutoffMode;
  now: Date;
  limit?: number;
}

/**
 * The next delivery (and pickup) days whose cut-off has not passed, soonest
 * first, in the shop's time zone.
 */
export function upcoming(rules: Rules, options: UpcomingOptions): DeliveryDay[] {
  const { area = null, pickup, limits = [], mode = 'general', now, limit = 4 } = options;
  const slots =
    pickup === true
      ? pickupSlots(rules)
      : pickup === false
        ? slotsFor(rules, area)
        : [...slotsFor(rules, area), ...pickupSlots(rules)];
  const out: DeliveryDay[] = [];
  if (!slots.length) return out;

  const allowed = allowedWeekdays(limits);
  const clock = shopClock(rules.timezone, now);
  for (let i = 0; i < 28 && out.length < limit; i++) {
    const candidate = clock.today + i * DAY;
    const weekday = new Date(candidate).getUTCDay();
    for (const slot of slots) {
      if (out.length >= limit) break;
      if (dayIndex(slot.day) !== weekday) continue;
      if (allowed && !allowed.includes(weekday)) continue;
      const orderBy = slotOrderBy(slot, candidate, mode);
      if (orderBy.time === null || clock.now >= orderBy.time) continue;
      const iso = isoDay(candidate);
      const method = isPickup(slot) ? 'PICKUP' : 'DELIVERY';
      if (rules.blackouts.some((b) => iso >= b.start && iso <= b.end && (!b.method || b.method === method))) continue;
      out.push({
        iso,
        pickup: isPickup(slot),
        ...dayLabels(candidate),
        cutoffLabel: `${capitalize(orderBy.day)} at ${clockText(orderBy.hour, orderBy.minute)}`,
        location: slot.location || '',
        locationId: slot.locationId || '',
        details: slot.details || '',
        // The basket books the day; windows are only chosen when the delivery app offers them.
        windows: [],
      });
    }
  }
  return out;
}

/** One open day as the delivery app answers it, in the shape the basket shows. */
export function dayFromApp(
  rules: Rules | null,
  answer: { date: string; cutoff?: string | null; slots?: TimeWindow[] | null },
  pickup: boolean,
  place: { id: string; name?: string; details?: string } | null,
): DeliveryDay | null {
  const time = dayNumber(String(answer.date));
  if (time === null) return null;
  const weekday = new Date(time).getUTCDay();
  const slot = rules?.slots.find(
    (s) => isPickup(s) === pickup && dayIndex(s.day) === weekday && (!pickup || !place || s.locationId === place.id),
  );
  const cutoff = String(answer.cutoff ?? '');
  const cutoffDay = dayNumber(cutoff);
  return {
    iso: isoDay(time),
    pickup,
    ...dayLabels(time),
    cutoffLabel:
      cutoffDay === null
        ? ''
        : `${WEEKDAY_NAMES[new Date(cutoffDay).getUTCDay()]} at ${clockText(cutoff.slice(11, 13), cutoff.slice(14, 16))}`,
    location: place?.name ?? slot?.location ?? '',
    locationId: place?.id ?? slot?.locationId ?? '',
    details: place?.details ?? slot?.details ?? '',
    windows: (answer.slots ?? []).filter((w) => w && w.key && w.label).map((w) => ({ key: w.key, label: w.label })),
  };
}

/** "Wednesdays, Fridays and Sundays": the delivery days of every area, Monday first. */
export function deliveryDaysText(rules: Rules): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days: number[] = [];
  for (const slot of deliverySlots(rules)) {
    const i = dayIndex(slot.day);
    if (i !== null && !days.includes(i)) days.push(i);
  }
  days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sentenceList(days.map((i) => `${WEEKDAY_NAMES[i]}s`));
}

/** The weekday names a product's delivery-day tags allow, as indexes (0 = Sunday). */
export function tagWeekdays(tags: string[], prefix = 'delivery-day:'): number[] {
  const days: number[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase().trim();
    if (!key.includes(prefix)) continue;
    const i = dayIndex(key.split(':').pop());
    if (i !== null && !days.includes(i)) days.push(i);
  }
  return days;
}
