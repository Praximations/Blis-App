// Delivery and pickup, as the website and the Blis Delivery app describe them.

/** One weekly day: a delivery day for some areas, or a pickup day at a place. */
export interface Slot {
  /** "wednesday" */
  day: string;
  type: 'delivery' | 'pickup';
  /** Pickup place name ("" for delivery). */
  location: string;
  locationId?: string;
  /** Pickup: hours and address. */
  details: string;
  /** Ordering closes on this day… */
  cutoffDay: string;
  /** …at this time (shop time). */
  cutoffHour: number;
  cutoffMinute?: number;
  /** Set by the app when the cut-off is more than a week before. */
  cutoffDaysBefore?: number | null;
  /** Products with their own order-by times (beef) close on this day instead. */
  ownCutoffDay?: string;
  ownCutoffHour?: number;
  /** Delivery: the areas served that day. */
  areas: string[];
  /** Time window labels, shown in the schedule. */
  times: string[];
  /** Time window keys ("09:00-12:00"), same order as `times`. */
  windows?: string[];
}

export interface Blackout {
  start: string;
  end: string;
  method: 'DELIVERY' | 'PICKUP' | 'SHIPPING' | null;
}

/**
 * The rules. Same shape as the shop metafield blis_delivery.rules that the
 * Blis Delivery app publishes for the website.
 */
export interface Rules {
  /** "blis-delivery" when the app published them, "bundled" for the copy shipped in the app. */
  source: string;
  updatedAt?: string;
  timezone: string;
  slots: Slot[];
  /** ZIP → area. */
  zips: Record<string, string>;
  blackouts: Blackout[];
  /** Products tagged delivery-day:<weekday> only go out on those days. */
  dayTagPrefix: string;
  /** Product type or tag of the products with their own order-by times. */
  ownCutoffMatch?: string;
}

export interface TimeWindow {
  /** "09:00-12:00" */
  key: string;
  /** "9 am – 12 pm" */
  label: string;
}

/** A day the customer can choose. */
export interface DeliveryDay {
  /** "2026-11-18" */
  iso: string;
  pickup: boolean;
  /** "Wednesday, November 18" */
  label: string;
  weekday: string;
  weekdayShort: string;
  /** "Nov 18" */
  monthDay: string;
  /** "Sunday at noon" */
  cutoffLabel: string;
  location: string;
  locationId: string;
  details: string;
  /** Time windows to choose from; empty when the day is booked as a whole. */
  windows: TimeWindow[];
}

/** Which order-by times count: the day's, the products' own, or the earlier of the two. */
export type CutoffMode = 'general' | 'own' | 'both';

/** A product in the basket that only goes out on some weekdays. */
export interface DayLimit {
  name: string;
  /** 0 = Sunday. */
  days: number[];
}

/** What the customer chose, as kept on the phone. */
export interface DeliveryChoice {
  /** What was typed: a ZIP code or a town. */
  query: string;
  zip: string | null;
  area: string | null;
  /** null = not checked yet. */
  eligible: boolean | null;
  method: 'delivery' | 'pickup';
  /** ISO date of the chosen day. */
  date: string | null;
  /** Key of the chosen time window. */
  window: string | null;
}

export const EMPTY_CHOICE: DeliveryChoice = {
  query: '',
  zip: null,
  area: null,
  eligible: null,
  method: 'delivery',
  date: null,
  window: null,
};
