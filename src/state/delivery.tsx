// The delivery choice: where to (a ZIP code in a delivery area, or a pickup
// place), which day and, when the delivery app books time windows, when.
// It follows the website's basket (Blis repo, assets/blis-theme.js,
// createDeliveryStore): the Blis Delivery app answers the open days when it
// can be reached, the rules on the phone otherwise; the choice is written
// to the cart as attributes, which is how it reaches the order.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import * as app from '@/delivery/app';
import {
  attributesMatch,
  cutoffMode,
  dayLimits,
  deliveryAttributes,
  lineRefs,
  localOnlyLines,
  mergeAttributes,
} from '@/delivery/basket';
import { BUNDLED_RULES } from '@/delivery/bundled-rules';
import {
  dayFromApp,
  deliveryDaysText,
  limitText,
  matchArea,
  pickupSlots,
  slotsFor,
} from '@/delivery/days';
import { cachedRules, fetchPublishedRules } from '@/delivery/rules';
import * as select from '@/delivery/select';
import type { DeliveryState } from '@/delivery/select';
import {
  EMPTY_CHOICE,
  type DeliveryChoice,
  type DeliveryDay,
  type TimeWindow,
} from '@/delivery/types';
import { keys, readJSON, writeJSON } from '@/lib/storage';
import type { Cart } from '@/shopify/types';

import type { CartStore } from './cart';

interface Saved {
  choice: DeliveryChoice;
  hold: string | null;
}

const MESSAGES = {
  save: 'We could not save your delivery date. Please try checkout again.',
  full: 'That day just filled up. Please choose another.',
  gone: 'That day is no longer available. Please choose again.',
};

/** How often the delivery app is looked for again while it doesn't answer. */
const APP_RETRY_MS = 5 * 60_000;

type Listener = () => void;

export class DeliveryStore {
  private state: DeliveryState = {
    ready: false,
    rules: BUNDLED_RULES,
    app: null,
    choice: EMPTY_CHOICE,
    hold: null,
    lines: '',
    limits: [],
    mode: 'general',
    localOnly: false,
    appLocalOnly: false,
    appDelivery: null,
    appPickup: null,
    checking: false,
    error: '',
  };
  private listeners = new Set<Listener>();
  private started = false;
  private appAskedAt = 0;
  private appSeq = 0;
  private holdKey = '';
  private holdPending: Promise<void> | null = null;
  private syncVersion = 0;
  /** The cart last looked at, so the same cart isn't acted on twice. */
  private lastCart: Cart | null = null;

  constructor(
    private readonly cart: CartStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<DeliveryState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    void writeJSON(keys.delivery, { choice: this.state.choice, hold: this.state.hold } satisfies Saved);
  }

  private setChoice(patch: Partial<DeliveryChoice>, more: Partial<DeliveryState> = {}) {
    this.set({ ...more, choice: { ...this.state.choice, ...patch } });
    this.persist();
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  start() {
    if (this.started) return;
    this.started = true;
    void (async () => {
      const [saved, rules] = await Promise.all([readJSON<Saved>(keys.delivery), cachedRules()]);
      const choice = saved?.choice && typeof saved.choice === 'object' ? { ...EMPTY_CHOICE, ...saved.choice } : EMPTY_CHOICE;
      this.set({ ready: true, rules, choice, hold: typeof saved?.hold === 'string' ? saved.hold : null });
      this.setBasket(this.cart.getState().cart);
      this.cart.subscribe(() => this.setBasket(this.cart.getState().cart));

      void fetchPublishedRules().then((published) => {
        if (!published) return;
        this.set({ rules: published });
        this.recheck();
      });
      void this.findApp();
    })();
  }

  /** Looks for the delivery app (again, when it didn't answer a while ago). */
  async findApp(force = false) {
    if (this.state.app && !force) return;
    if (!force && Date.now() - this.appAskedAt < APP_RETRY_MS) return;
    this.appAskedAt = Date.now();
    const found = await app.fetchAppConfig();
    if (!found && !this.state.app) return;
    this.set({ app: found });
    if (found) void this.refreshApp();
  }

  // ─── What is on offer (see delivery/select.ts) ────────────────────────────

  get hasPickup(): boolean {
    return select.hasPickup(this.state);
  }

  get needsDelivery(): boolean {
    return select.needsDelivery(this.state);
  }

  days(limit = 6): DeliveryDay[] {
    return select.offeredDays(this.state, this.now(), limit);
  }

  chosenDay(): DeliveryDay | null {
    return select.chosenDay(this.state, this.now());
  }

  chosenWindow(day = this.chosenDay()): TimeWindow | null {
    return select.chosenWindow(this.state, day);
  }

  needs(): select.Needs {
    return select.needs(this.state, this.now());
  }

  get canCheckout(): boolean {
    return select.canCheckout(this.state, this.now());
  }

  // ─── The basket ───────────────────────────────────────────────────────────

  /** Called whenever the basket changes. */
  setBasket(cart: Cart | null) {
    if (!this.state.ready || cart === this.lastCart) return;
    this.lastCart = cart;
    const s = this.state;
    const lines = lineRefs(cart);
    const limits = dayLimits(cart, s.rules.dayTagPrefix);
    const mode = cutoffMode(cart, s.rules.ownCutoffMatch);
    const localOnly = localOnlyLines(cart).length > 0;
    const linesChanged = lines !== s.lines;
    const changed =
      linesChanged || mode !== s.mode || localOnly !== s.localOnly || JSON.stringify(limits) !== JSON.stringify(s.limits);
    if (changed) this.set({ lines, limits, mode, localOnly, appLocalOnly: lines ? s.appLocalOnly : false });
    if (linesChanged) void this.refreshApp();

    if (!cart) return;
    if (!this.needsDelivery) {
      // Nothing left that needs a day: take the choice off the cart.
      const none = deliveryAttributes(null, s.choice, null, null);
      if (!attributesMatch(cart.attributes, none)) void this.syncCart();
      return;
    }
    if (changed && this.ensureDate()) void this.syncCart();
    else if (changed) void this.holdChoice();
  }

  // ─── The delivery app ─────────────────────────────────────────────────────

  /**
   * Asks the app for the open days and windows of the checked ZIP and of
   * each pickup place, for this basket (its product rules, capacity and
   * closed days). Until it answers, the days come from the rules.
   */
  async refreshApp() {
    const config = this.state.app;
    if (!config) return;
    const seq = ++this.appSeq;
    const { choice, lines, rules } = this.state;
    const zip = choice.eligible === true && choice.zip ? choice.zip : null;
    const places = config.pickupLocations;

    const [delivery, pickups] = await Promise.all([
      // Without a ZIP the answer still says which lines can't be shipped.
      lines || zip ? app.fetchAvailability({ zip }, lines) : Promise.resolve(null),
      Promise.all(places.map((place) => app.fetchAvailability({ location: place.id }, lines))),
    ]);
    if (seq !== this.appSeq) return;

    const patch: Partial<DeliveryState> = {};
    const answer = delivery ?? pickups.find((p) => !!p) ?? null;
    if (answer) patch.appLocalOnly = lines !== '' && answer.localOnly.length > 0;

    if (zip && delivery?.delivery) {
      if (delivery.delivery.eligible === false) {
        patch.appDelivery = [];
        patch.choice = { ...this.state.choice, eligible: false, date: null, window: null };
      } else {
        patch.appDelivery = delivery.delivery.dates
          .map((d) => dayFromApp(rules, d, false, null))
          .filter((d): d is DeliveryDay => !!d);
      }
    } else if (!zip) {
      patch.appDelivery = null;
    }

    const answered = pickups.filter((p): p is app.AppAvailability => !!p?.pickup?.location);
    if (answered.length) {
      const days: DeliveryDay[] = [];
      for (const p of answered) {
        const place = p.pickup!.location!;
        const details = [place.hours, place.address].filter(Boolean).join(' · ');
        for (const d of p.pickup!.dates) {
          const day = dayFromApp(rules, d, true, { id: place.id, name: place.name, details });
          if (day) days.push(day);
        }
      }
      days.sort((a, b) => a.iso.localeCompare(b.iso));
      patch.appPickup = days;
    } else if (!places.length) {
      patch.appPickup = null;
    }

    this.set(patch);
    if (patch.choice) this.persist();
    if (this.ensureDate() || patch.choice) void this.syncCart();
    else void this.holdChoice();
  }

  /** Reserves the chosen day with the app for 15 minutes, so two customers can't both take the last place. */
  holdChoice(): Promise<void> {
    const s = this.state;
    if (!s.app || !this.needsDelivery) return Promise.resolve();
    const day = this.chosenDay();
    const window = this.chosenWindow(day);
    if (!day || (day.windows.length && !window)) return Promise.resolve();
    if ((!day.pickup && !s.choice.zip) || (day.pickup && !day.locationId)) return Promise.resolve();

    const method = day.pickup ? 'PICKUP' : 'DELIVERY';
    const key = [method, day.iso, window?.key ?? '', day.pickup ? day.locationId : s.choice.zip, s.lines].join('|');
    if (key === this.holdKey) return this.holdPending ?? Promise.resolve();
    this.holdKey = key;

    this.holdPending = app
      .placeHold({
        method,
        date: day.iso,
        slot: window?.key,
        zip: s.choice.zip,
        location: day.locationId,
        lines: s.lines,
        previous: s.hold,
      })
      .then(async (result) => {
        if (key !== this.holdKey) return;
        if (result.ok) {
          this.set({ hold: result.token });
          this.persist();
          await this.syncCart();
        } else if (result.reason !== 'unreachable') {
          // Filled up or closed since the days were shown, or no longer served.
          this.holdKey = '';
          this.setChoice({ date: null, window: null }, { hold: null });
          void this.refreshApp();
          await this.syncCart();
          this.set({ error: result.reason === 'full' ? MESSAGES.full : MESSAGES.gone });
        } else {
          // The app didn't answer: checkout tries once more, and the order is checked when it arrives.
          this.holdKey = '';
        }
      });
    return this.holdPending;
  }

  private releaseHold() {
    const token = this.state.hold;
    this.holdKey = '';
    if (!token) return;
    this.set({ hold: null });
    if (this.state.app) void app.releaseHold(token);
  }

  // ─── Choosing ─────────────────────────────────────────────────────────────

  /**
   * Checks a ZIP code or a town. Answers true (served), false (not served)
   * or null (nothing to check).
   */
  async check(query: string): Promise<boolean | null> {
    const typed = query.trim();
    const local = matchArea(this.state.rules, typed);
    this.releaseHold();
    if (!local) {
      this.setChoice({ query: typed, area: null, zip: null, eligible: null, date: null, window: null }, { appDelivery: null, error: '' });
      void this.syncCart();
      return null;
    }

    let area = local.area;
    let eligible = !!area && slotsFor(this.state.rules, area).length > 0;
    let appDelivery: DeliveryDay[] | null = null;
    let appLocalOnly = this.state.appLocalOnly;

    // With the app connected, it decides whether the ZIP is served.
    if (this.state.app && local.zip) {
      this.set({ checking: true });
      const seq = ++this.appSeq;
      const answer = await app.fetchAvailability({ zip: local.zip }, this.state.lines);
      if (seq !== this.appSeq) return null;
      if (answer?.delivery) {
        eligible = answer.delivery.eligible;
        area = answer.delivery.zone?.name ?? area;
        appDelivery = eligible
          ? answer.delivery.dates
              .map((d) => dayFromApp(this.state.rules, d, false, null))
              .filter((d): d is DeliveryDay => !!d)
          : [];
        appLocalOnly = this.state.lines !== '' && answer.localOnly.length > 0;
      }
    }

    this.setChoice(
      { query: typed, area: eligible ? area : null, zip: local.zip, eligible, date: null, window: null },
      { appDelivery, appLocalOnly, checking: false, error: '' },
    );
    void this.syncCart();
    return eligible;
  }

  /** The rules changed under a saved choice: is the address still served? */
  private recheck() {
    const { choice, rules } = this.state;
    if (!choice.query || this.state.app) return;
    const local = matchArea(rules, choice.query);
    const area = local?.area ?? null;
    const eligible = !!area && slotsFor(rules, area).length > 0;
    if (eligible === choice.eligible && area === choice.area) {
      if (this.ensureDate()) void this.syncCart();
      return;
    }
    this.setChoice({ area, zip: local?.zip ?? null, eligible, date: null, window: null });
    void this.syncCart();
  }

  /** Forgets the address. */
  reset() {
    this.releaseHold();
    this.setChoice({ query: '', area: null, zip: null, eligible: null, date: null, window: null }, { appDelivery: null, error: '' });
    void this.syncCart();
  }

  chooseMethod(method: 'delivery' | 'pickup') {
    if (method === this.state.choice.method) return;
    if (method === 'pickup' && !this.hasPickup) return;
    this.releaseHold();
    this.setChoice({ method, date: null, window: null }, { error: '' });
    void this.syncCart();
  }

  chooseDate(iso: string | null) {
    this.setChoice({ date: iso, window: null }, { error: '' });
    this.ensureDate();
    void this.syncCart();
    void this.holdChoice();
  }

  chooseWindow(key: string | null) {
    this.setChoice({ window: key }, { error: '' });
    void this.syncCart();
    void this.holdChoice();
  }

  /**
   * Keeps the choice valid without choosing for the customer: a day that is
   * past its cut-off or no longer offered is cleared. Answers whether
   * something changed.
   */
  ensureDate(): boolean {
    const { choice } = this.state;
    if (!choice.date) return false;
    const day = this.chosenDay();
    if (day && (!choice.window || this.chosenWindow(day))) return false;
    if (day) {
      this.setChoice({ window: null });
      return true;
    }
    this.releaseHold();
    this.setChoice({ date: null, window: null });
    return true;
  }

  // ─── The cart ─────────────────────────────────────────────────────────────

  /** Writes the choice to the cart's attributes, so it reaches the order. */
  async syncCart(): Promise<boolean> {
    const version = ++this.syncVersion;
    const day = this.needsDelivery ? this.chosenDay() : null;
    const attributes = deliveryAttributes(day, this.state.choice, this.chosenWindow(day), this.state.hold);
    try {
      await this.cart.setAttributes((cart) =>
        attributesMatch(cart.attributes, attributes) ? null : mergeAttributes(cart.attributes, attributes),
      );
      return true;
    } catch {
      if (version === this.syncVersion) this.set({ error: MESSAGES.save });
      return false;
    }
  }

  /** Before checkout: the hold and the attributes are on the cart, and the choice is still good. */
  async prepareCheckout(): Promise<boolean> {
    if (!this.needsDelivery) return true;
    this.ensureDate();
    if (this.needs() !== '') return false;
    await this.holdChoice();
    if (this.needs() !== '') return false;
    const saved = await this.syncCart();
    return saved && this.needs() === '';
  }

  /** After an order: the address stays, the day is for the next basket to choose. */
  afterOrder() {
    this.holdKey = '';
    this.setChoice({ date: null, window: null }, { hold: null, error: '', appDelivery: null, appPickup: null });
  }

  dismissError() {
    if (this.state.error) this.set({ error: '' });
  }

  /**
   * Called when the basket comes into view: time has passed, so a day may
   * have closed, and the delivery app may have come back.
   */
  refresh() {
    if (!this.state.ready) return;
    if (this.ensureDate()) void this.syncCart();
    else this.set({});
    void this.findApp();
  }
}

// ─── React ──────────────────────────────────────────────────────────────────

const DeliveryContext = createContext<DeliveryStore | null>(null);

export function DeliveryProvider({ store, children }: { store: DeliveryStore; children: ReactNode }) {
  useEffect(() => {
    store.start();
  }, [store]);
  return <DeliveryContext.Provider value={store}>{children}</DeliveryContext.Provider>;
}

/** The delivery choice, with everything the basket card and the product page show. */
export function useDelivery() {
  const store = useContext(DeliveryContext);
  if (!store) throw new Error('useDelivery needs a DeliveryProvider above it');
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  // Everything below is worked out from this one snapshot of the state.
  return useMemo(() => {
    const now = new Date();
    const days = select.offeredDays(state, now, 6);
    const day = state.choice.date ? (days.find((d) => d.iso === state.choice.date) ?? null) : null;
    const pickupSlot = pickupSlots(state.rules)[0];
    const appPlace = state.app?.pickupLocations[0];
    const pickupDay = state.choice.method === 'pickup' ? day : null;
    return {
      ...state,
      store,
      needsDelivery: select.needsDelivery(state),
      hasPickup: select.hasPickup(state),
      days,
      day,
      window: select.chosenWindow(state, day),
      needs: select.needs(state, now),
      canCheckout: select.canCheckout(state, now),
      /** "Guernsey Raw Milk is available on Sundays only." */
      limitNote: limitText(state.limits),
      /** "Wednesdays, Fridays and Sundays" */
      deliveryDays: deliveryDaysText(state.rules),
      /** The pickup place for the chosen (or first) pickup day. */
      pickupPlace: pickupDay
        ? { name: pickupDay.location || 'Pickup', details: pickupDay.details }
        : appPlace
          ? { name: appPlace.name, details: [appPlace.hours, appPlace.address].filter(Boolean).join(' · ') }
          : pickupSlot
            ? { name: pickupSlot.location || 'Pickup', details: pickupSlot.details }
            : null,
      /** "Saturdays": when pickup is open. */
      pickupDays: [...new Set(pickupSlots(state.rules).map((s) => `${s.day.charAt(0).toUpperCase()}${s.day.slice(1)}s`))].join(', '),
    };
  }, [state, store]);
}
