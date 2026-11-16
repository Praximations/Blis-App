import { BUNDLED_RULES } from '@/delivery/bundled-rules';
import {
  allowedWeekdays,
  clockText,
  dayFromApp,
  deliveryDaysText,
  limitText,
  matchArea,
  shopClock,
  tagWeekdays,
  upcoming,
} from '@/delivery/days';
import type { Rules } from '@/delivery/types';

// Shop time is America/New_York: in November that is UTC−5.
const at = (isoLocal: string) => new Date(`${isoLocal}:00-05:00`);
const isos = (days: { iso: string }[]) => days.map((d) => d.iso);

describe('shopClock', () => {
  it('reads the wall clock of the shop, not of the phone', () => {
    const clock = shopClock('America/New_York', new Date('2026-11-17T03:30:00Z'));
    // 10:30 pm on the 16th in New York.
    expect(new Date(clock.today).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(new Date(clock.now).toISOString()).toBe('2026-11-16T22:30:00.000Z');
  });

  it('follows daylight saving time', () => {
    const clock = shopClock('America/New_York', new Date('2026-07-01T16:00:00Z'));
    expect(new Date(clock.now).toISOString()).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('upcoming delivery days', () => {
  const boca = (now: Date, extra = {}) => upcoming(BUNDLED_RULES, { area: 'Boca Raton', pickup: false, now, ...extra });

  it('offers the days whose order-by time has not passed', () => {
    // Monday afternoon: Wednesday closed on Sunday at noon.
    expect(isos(boca(at('2026-11-16T13:00')))).toEqual(['2026-11-20', '2026-11-22', '2026-11-25', '2026-11-27']);
  });

  it('closes a day exactly at its cut-off', () => {
    expect(isos(boca(at('2026-11-15T11:59')))[0]).toBe('2026-11-18');
    expect(isos(boca(at('2026-11-15T12:00')))[0]).toBe('2026-11-20');
  });

  it('labels a day the way the basket shows it', () => {
    const [friday] = boca(at('2026-11-16T13:00'));
    expect(friday).toMatchObject({
      label: 'Friday, November 20',
      weekday: 'Friday',
      weekdayShort: 'Fri',
      monthDay: 'Nov 20',
      cutoffLabel: 'Tuesday at noon',
      pickup: false,
      windows: [],
    });
  });

  it('only offers the days an area is served', () => {
    const days = upcoming(BUNDLED_RULES, { area: 'Wellington', pickup: false, now: at('2026-11-14T09:00'), limit: 6 });
    expect(days.map((d) => d.weekdayShort)).toEqual(['Fri', 'Sun', 'Fri', 'Sun', 'Fri', 'Sun']);
  });

  it('offers nothing for an area that is not served', () => {
    expect(upcoming(BUNDLED_RULES, { area: 'Miami', pickup: false, now: at('2026-11-16T13:00') })).toEqual([]);
    expect(upcoming(BUNDLED_RULES, { area: null, pickup: false, now: at('2026-11-16T13:00') })).toEqual([]);
  });

  it('keeps to the weekdays a product in the basket allows', () => {
    const milk = [{ name: 'Guernsey Raw Milk', days: [0] }];
    expect(isos(boca(at('2026-11-16T13:00'), { limits: milk, limit: 3 }))).toEqual(['2026-11-22', '2026-11-29', '2026-12-06']);
  });

  it('offers nothing when two products share no day', () => {
    const limits = [
      { name: 'Milk', days: [0] },
      { name: 'Bread', days: [3] },
    ];
    expect(boca(at('2026-11-16T13:00'), { limits })).toEqual([]);
  });

  it("uses a product's own order-by time (beef) when the basket holds nothing else", () => {
    // Tuesday afternoon: Friday is closed for the shop (Tuesday noon) but open for beef (Wednesday noon).
    const now = at('2026-11-17T13:00');
    expect(isos(boca(now))[0]).toBe('2026-11-22');
    expect(isos(boca(now, { mode: 'own' }))[0]).toBe('2026-11-20');
    expect(boca(now, { mode: 'own' })[0].cutoffLabel).toBe('Wednesday at noon');
    // A mixed basket takes the earlier of the two.
    expect(isos(boca(now, { mode: 'both' }))[0]).toBe('2026-11-22');
  });

  it('skips closed days', () => {
    const rules: Rules = { ...BUNDLED_RULES, blackouts: [{ start: '2026-11-20', end: '2026-11-22', method: 'DELIVERY' }] };
    const days = upcoming(rules, { area: 'Boca Raton', pickup: false, now: at('2026-11-16T13:00'), limit: 2 });
    expect(isos(days)).toEqual(['2026-11-25', '2026-11-27']);
    // Pickup is not closed by a delivery-only closure.
    expect(isos(upcoming(rules, { pickup: true, now: at('2026-11-16T13:00'), limit: 1 }))).toEqual(['2026-11-21']);
  });

  it('counts the cut-off back by the number of days the delivery app gives', () => {
    const rules: Rules = {
      ...BUNDLED_RULES,
      // Wednesday, order by the Wednesday before at 5:30 pm.
      slots: [{ ...BUNDLED_RULES.slots[0], cutoffDay: 'wednesday', cutoffHour: 17, cutoffMinute: 30, cutoffDaysBefore: 7 }],
    };
    const days = upcoming(rules, { area: 'Boca Raton', pickup: false, now: at('2026-11-16T13:00'), limit: 1 });
    expect(days[0]).toMatchObject({ iso: '2026-11-25', cutoffLabel: 'Wednesday at 5:30pm' });
  });
});

describe('upcoming pickup days', () => {
  it('are open to everyone, at the place and hours of the rules', () => {
    const [saturday] = upcoming(BUNDLED_RULES, { pickup: true, now: at('2026-11-16T13:00'), limit: 1 });
    expect(saturday).toMatchObject({
      iso: '2026-11-21',
      pickup: true,
      location: 'Swank Farmers Market',
      details: '10 am – 1 pm · 14311 North Road, Loxahatchee Groves',
      cutoffLabel: 'Thursday at noon',
    });
  });

  it('close on Thursday at noon', () => {
    expect(isos(upcoming(BUNDLED_RULES, { pickup: true, now: at('2026-11-19T12:00'), limit: 1 }))).toEqual(['2026-11-28']);
  });
});

describe('matchArea', () => {
  it('finds the area of a ZIP code', () => {
    expect(matchArea(BUNDLED_RULES, '33432')).toEqual({ area: 'Boca Raton', zip: '33432' });
    expect(matchArea(BUNDLED_RULES, ' 33432-1234 ')).toEqual({ area: 'Boca Raton', zip: '33432' });
    expect(matchArea(BUNDLED_RULES, '10001')).toEqual({ area: null, zip: '10001' });
  });

  it('finds an area by any of its towns', () => {
    expect(matchArea(BUNDLED_RULES, 'lantana')?.area).toBe('Lake Worth / Lantana / Greenacres');
    expect(matchArea(BUNDLED_RULES, 'The Acreage')?.area).toBe('Royal Palm Beach / Loxahatchee / Westlake / The Acreage');
    expect(matchArea(BUNDLED_RULES, 'Boca Raton, FL')?.area).toBe('Boca Raton');
    expect(matchArea(BUNDLED_RULES, 'boca')?.area).toBe('Boca Raton');
  });

  it('does not guess from a couple of letters, or from nothing', () => {
    expect(matchArea(BUNDLED_RULES, 'bo')).toEqual({ area: null, zip: null });
    expect(matchArea(BUNDLED_RULES, 'Miami')).toEqual({ area: null, zip: null });
    expect(matchArea(BUNDLED_RULES, '   ')).toBeNull();
  });
});

describe('words', () => {
  it('writes clock times like the website', () => {
    expect([clockText(12), clockText(0), clockText(9), clockText(15), clockText(12, 30), clockText(9, 5)]).toEqual([
      'noon',
      'midnight',
      '9am',
      '3pm',
      '12:30pm',
      '9:05am',
    ]);
  });

  it('lists the delivery days, Monday first', () => {
    expect(deliveryDaysText(BUNDLED_RULES)).toBe('Wednesdays, Fridays and Sundays');
  });

  it('explains day limits', () => {
    expect(limitText([])).toBe('');
    expect(limitText([{ name: 'Guernsey Raw Milk', days: [0] }])).toBe('Guernsey Raw Milk is available on Sundays only.');
    expect(
      limitText([
        { name: 'Milk', days: [0, 3] },
        { name: 'Butter', days: [3] },
      ]),
    ).toBe('Milk and Butter are available on Wednesdays only.');
    expect(
      limitText([
        { name: 'Milk', days: [0] },
        { name: 'Bread', days: [3] },
      ]),
    ).toBe('Milk and Bread go out on different days, so they can’t share one order. Please order them separately.');
    expect(allowedWeekdays([])).toBeNull();
  });

  it('reads delivery-day tags', () => {
    expect(tagWeekdays(['grocery-tax-exempt', 'delivery-day:sunday', 'Delivery-Day: Wednesday '])).toEqual([0, 3]);
    expect(tagWeekdays(['raw', 'delivery-day:someday'])).toEqual([]);
  });
});

describe('dayFromApp', () => {
  it("turns the delivery app's answer into a day with its time windows", () => {
    const day = dayFromApp(
      BUNDLED_RULES,
      { date: '2026-11-20', cutoff: '2026-11-17T12:00', slots: [{ key: '09:00-12:00', label: '9 am – 12 pm' }] },
      false,
      null,
    );
    expect(day).toMatchObject({
      iso: '2026-11-20',
      label: 'Friday, November 20',
      cutoffLabel: 'Tuesday at noon',
      windows: [{ key: '09:00-12:00', label: '9 am – 12 pm' }],
    });
  });

  it('carries the pickup place', () => {
    const day = dayFromApp(null, { date: '2026-11-21', cutoff: '2026-11-19T12:00', slots: [] }, true, {
      id: 'loc-swank',
      name: 'Swank Farmers Market',
      details: '10 am – 1 pm',
    });
    expect(day).toMatchObject({ pickup: true, locationId: 'loc-swank', location: 'Swank Farmers Market', details: '10 am – 1 pm' });
  });

  it('refuses a date it cannot read', () => {
    expect(dayFromApp(null, { date: 'soon' }, false, null)).toBeNull();
  });
});
