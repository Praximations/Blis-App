// What the delivery choice comes to, worked out from one snapshot of its
// state. Pure functions: the same state and time always give the same
// answer, which is what lets the screens (and React's compiler) trust them.

import type { AppConfig } from './app';
import { allowedWeekdays, dayNumber, pickupSlots, upcoming } from './days';
import type { CutoffMode, DayLimit, DeliveryChoice, DeliveryDay, Rules, TimeWindow } from './types';

export interface DeliveryState {
  ready: boolean;
  rules: Rules;
  /** What the Blis Delivery app offers; null while it can't be reached. */
  app: AppConfig | null;
  choice: DeliveryChoice;
  /** The app's 15-minute reservation of the chosen day. */
  hold: string | null;
  /** The basket, as delivery sees it. */
  lines: string;
  limits: DayLimit[];
  mode: CutoffMode;
  /** The basket holds something that can't be shipped. */
  localOnly: boolean;
  /** The delivery app says so too (it also knows the shop's own rules). */
  appLocalOnly: boolean;
  /** The app's open days for the checked ZIP and for the pickup places; null = not answered. */
  appDelivery: DeliveryDay[] | null;
  appPickup: DeliveryDay[] | null;
  /** Asking whether a ZIP is served. */
  checking: boolean;
  error: string;
}

/** What still has to be chosen before checkout ('' = nothing). */
export type Needs = 'address' | 'none' | 'day' | 'time' | '';

export function hasPickup(state: DeliveryState): boolean {
  if (state.app) return state.app.methods.includes('PICKUP') && state.app.pickupLocations.length > 0;
  return pickupSlots(state.rules).length > 0;
}

/** The basket needs a delivery or pickup day before checkout. */
export function needsDelivery(state: DeliveryState): boolean {
  if (!state.lines) return false;
  return state.localOnly || state.appLocalOnly || state.app?.showFor === 'always';
}

/** The days on offer for the chosen way: delivery days for a served address, or pickup days. */
export function offeredDays(state: DeliveryState, now: Date, limit = 6): DeliveryDay[] {
  const pickup = state.choice.method === 'pickup';
  if (!pickup && state.choice.eligible !== true) return [];
  const fromApp = state.app ? (pickup ? state.appPickup : state.appDelivery) : null;
  if (fromApp) {
    const allowed = allowedWeekdays(state.limits);
    return fromApp
      .filter((d) => !allowed || allowed.includes(new Date(dayNumber(d.iso) ?? 0).getUTCDay()))
      .slice(0, limit);
  }
  return upcoming(state.rules, {
    area: state.choice.area,
    pickup,
    limits: state.limits,
    mode: state.mode,
    now,
    limit,
  });
}

export function chosenDay(state: DeliveryState, now: Date): DeliveryDay | null {
  const date = state.choice.date;
  return date ? (offeredDays(state, now, 6).find((d) => d.iso === date) ?? null) : null;
}

export function chosenWindow(state: DeliveryState, day: DeliveryDay | null): TimeWindow | null {
  const key = state.choice.window;
  return day && key ? (day.windows.find((w) => w.key === key) ?? null) : null;
}

export function needs(state: DeliveryState, now: Date): Needs {
  if (state.choice.method !== 'pickup' && state.choice.eligible !== true) return 'address';
  if (!offeredDays(state, now, 1).length) return 'none';
  const day = chosenDay(state, now);
  if (!day) return 'day';
  if (day.windows.length && !chosenWindow(state, day)) return 'time';
  return '';
}

export const canCheckout = (state: DeliveryState, now: Date) => !needsDelivery(state) || needs(state, now) === '';
