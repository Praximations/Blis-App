// The delivery choice end to end, with a stand-in for the basket and for
// the Blis Delivery app.

import * as app from '@/delivery/app';
import type { Cart } from '@/shopify/types';
import type { CartStore } from '@/state/cart';
import { DeliveryStore } from '@/state/delivery';

import { cartWith, line } from './helpers';

jest.mock('@/lib/storage', () => ({
  keys: { delivery: 'delivery', rules: 'rules' },
  readJSON: jest.fn(async () => null),
  writeJSON: jest.fn(async () => undefined),
}));
jest.mock('@/delivery/rules', () => ({
  cachedRules: jest.fn(async () => jest.requireActual('@/delivery/bundled-rules').BUNDLED_RULES),
  fetchPublishedRules: jest.fn(async () => null),
}));
jest.mock('@/delivery/app');

const appMock = jest.mocked(app);

/** A basket that keeps its attributes the way Shopify's does. */
class FakeCart {
  cart: Cart | null = null;
  listeners = new Set<() => void>();
  writes = 0;
  fail = false;
  getState = () => ({ cart: this.cart });
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(cart: Cart | null) {
    this.cart = cart;
    this.listeners.forEach((listener) => listener());
  }
  setAttributes = async (build: (cart: Cart) => { key: string; value: string }[] | null) => {
    if (!this.cart) return null;
    const attributes = build(this.cart);
    if (!attributes) return this.cart;
    if (this.fail) throw new Error('offline');
    this.writes += 1;
    this.set({ ...this.cart, attributes });
    return this.cart;
  };
  attribute(key: string) {
    return this.cart?.attributes.find((a) => a.key === key)?.value ?? '';
  }
}

// Monday 16 November 2026, 1 pm in New York.
const NOW = new Date('2026-11-16T13:00:00-05:00');
const milk = line({ productId: '11', variantId: '21', title: 'Raw Milk', localOnly: true });
const honey = line({ productId: '13', variantId: '23', title: 'Truffle Honey' });

const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise<void>((resolve) => setImmediate(() => resolve()));
};

async function start(cart: Cart | null = cartWith([milk])) {
  const basket = new FakeCart();
  basket.cart = cart;
  const store = new DeliveryStore(basket as unknown as CartStore, () => NOW);
  store.start();
  await settle();
  return { basket, store };
}

beforeEach(() => {
  jest.clearAllMocks();
  appMock.fetchAppConfig.mockResolvedValue(null);
  appMock.fetchAvailability.mockResolvedValue(null);
  appMock.placeHold.mockResolvedValue({ ok: false, reason: 'unreachable' });
  appMock.releaseHold.mockResolvedValue(undefined);
});

describe('with the rules on the phone', () => {
  it('asks for a day only when the basket holds something that cannot be shipped', async () => {
    const { store, basket } = await start(cartWith([honey]));
    expect(store.needsDelivery).toBe(false);
    expect(store.canCheckout).toBe(true);
    basket.set(cartWith([honey, milk]));
    expect(store.needsDelivery).toBe(true);
    expect(store.canCheckout).toBe(false);
    expect(store.needs()).toBe('address');
  });

  it('walks from a ZIP code to a day and writes the choice to the cart', async () => {
    const { store, basket } = await start();

    expect(await store.check('10001')).toBe(false);
    expect(store.getState().choice).toMatchObject({ eligible: false, zip: '10001', area: null });
    expect(store.days()).toEqual([]);

    expect(await store.check('33432')).toBe(true);
    expect(store.getState().choice).toMatchObject({ eligible: true, zip: '33432', area: 'Boca Raton' });
    expect(store.needs()).toBe('day');
    expect(store.days(3).map((d) => d.iso)).toEqual(['2026-11-20', '2026-11-22', '2026-11-25']);
    await settle();
    expect(basket.attribute('Delivery date')).toBe('');

    store.chooseDate('2026-11-20');
    await settle();
    expect(store.needs()).toBe('');
    expect(store.canCheckout).toBe(true);
    expect(basket.attribute('Delivery date')).toBe('2026-11-20');
    expect(basket.attribute('Delivery method')).toBe('Local delivery');
    expect(basket.attribute('Delivery ZIP')).toBe('33432');
    expect(basket.attribute('_blis_method')).toBe('DELIVERY');
    expect(await store.prepareCheckout()).toBe(true);
    // No delivery app: nothing to hold.
    expect(appMock.placeHold).not.toHaveBeenCalled();
  });

  it('refuses a day that is not on offer', async () => {
    const { store, basket } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-18'); // Wednesday closed on Sunday at noon.
    await settle();
    expect(store.getState().choice.date).toBeNull();
    expect(basket.attribute('Delivery date')).toBe('');
    expect(await store.prepareCheckout()).toBe(false);
  });

  it('switches to pickup, which is open to everyone', async () => {
    const { store, basket } = await start();
    await store.check('10001');
    store.chooseMethod('pickup');
    expect(store.needs()).toBe('day');
    store.chooseDate(store.days(1)[0].iso);
    await settle();
    expect(basket.attribute('Delivery date')).toBe('2026-11-21');
    expect(basket.attribute('Delivery method')).toBe('Pickup at Swank Farmers Market');
    expect(basket.attribute('Pickup location')).toBe('Swank Farmers Market · 10 am – 1 pm · 14311 North Road, Loxahatchee Groves');
    expect(basket.attribute('Delivery ZIP')).toBe('');
    expect(store.canCheckout).toBe(true);
  });

  it('drops a chosen day the basket no longer allows', async () => {
    const { store, basket } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-20');
    await settle();
    // Sunday-only milk joins the basket: Friday can't stay.
    basket.set(cartWith([milk, line({ productId: '14', variantId: '24', title: 'Guernsey Milk', tags: ['delivery-day:sunday'], localOnly: true })], basket.cart!.attributes));
    await settle();
    expect(store.getState().choice.date).toBeNull();
    expect(store.days(2).map((d) => d.iso)).toEqual(['2026-11-22', '2026-11-29']);
    expect(basket.attribute('Delivery date')).toBe('');
  });

  it('takes the choice off the cart when nothing needs it any more', async () => {
    const { store, basket } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-20');
    await settle();
    basket.set(cartWith([honey], basket.cart!.attributes));
    await settle();
    expect(store.needsDelivery).toBe(false);
    expect(basket.attribute('Delivery date')).toBe('');
    expect(basket.attribute('_blis_method')).toBe('');
  });

  it('says so when the choice could not be saved, without trying forever', async () => {
    const { store, basket } = await start();
    await store.check('33432');
    await settle();
    basket.fail = true;
    store.chooseDate('2026-11-20');
    await settle();
    expect(store.getState().error).toBe('We could not save your delivery date. Please try checkout again.');
    expect(await store.prepareCheckout()).toBe(false);
    basket.fail = false;
    expect(await store.prepareCheckout()).toBe(true);
    expect(basket.attribute('Delivery date')).toBe('2026-11-20');
  });

  it('keeps the address but not the day after an order', async () => {
    const { store } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-20');
    store.afterOrder();
    expect(store.getState().choice).toMatchObject({ zip: '33432', eligible: true, date: null });
  });
});

describe('with the Blis Delivery app answering', () => {
  const windows = [
    { key: '09:00-12:00', label: '9 am – 12 pm' },
    { key: '12:00-15:00', label: '12 pm – 3 pm' },
  ];
  const place = { id: 'loc-swank', name: 'Swank Farmers Market', hours: '10 am – 1 pm', address: '14311 North Road' };

  beforeEach(() => {
    appMock.fetchAppConfig.mockResolvedValue({
      methods: ['DELIVERY', 'PICKUP', 'SHIPPING'],
      days: ['Wed', 'Fri', 'Sun'],
      schedule: [],
      areas: ['Boca Raton'],
      pickupLocations: [place],
      requireSelection: true,
      showFor: 'local',
    });
    appMock.fetchAvailability.mockImplementation(async (where) => ({
      methods: ['DELIVERY', 'PICKUP'],
      localOnly: ['11:21'],
      delivery: where.zip
        ? where.zip === '33432'
          ? {
              eligible: true,
              postalCode: '33432',
              zone: { id: 'z1', name: 'Boca Raton' },
              dates: [{ date: '2026-11-22', cutoff: '2026-11-19T12:00', slots: windows }],
            }
          : { eligible: false, postalCode: where.zip, zone: null, dates: [] }
        : null,
      pickup: where.location ? { location: place, dates: [{ date: '2026-11-21', cutoff: '2026-11-19T12:00', slots: [] }] } : null,
    }));
    appMock.placeHold.mockResolvedValue({ ok: true, token: 'hold-1' });
  });

  it("offers the app's days, asks for a time window and holds the choice", async () => {
    const { store, basket } = await start();
    expect(store.getState().app).not.toBeNull();

    expect(await store.check('33432')).toBe(true);
    // The app's answer, not the rules': Friday is not offered.
    expect(store.days().map((d) => d.iso)).toEqual(['2026-11-22']);

    store.chooseDate('2026-11-22');
    await settle();
    expect(store.needs()).toBe('time');
    expect(store.canCheckout).toBe(false);
    expect(appMock.placeHold).not.toHaveBeenCalled();

    store.chooseWindow('12:00-15:00');
    await settle();
    expect(store.needs()).toBe('');
    expect(appMock.placeHold).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELIVERY', date: '2026-11-22', slot: '12:00-15:00', zip: '33432', lines: '11:21:1' }),
    );
    expect(basket.attribute('Delivery time')).toBe('12 pm – 3 pm');
    expect(basket.attribute('_blis_slot')).toBe('12:00-15:00');
    expect(basket.attribute('_blis_hold')).toBe('hold-1');
    expect(await store.prepareCheckout()).toBe(true);
    // Checking out again doesn't hold twice.
    expect(appMock.placeHold).toHaveBeenCalledTimes(1);
  });

  it('lets the app decide whether a ZIP code is served', async () => {
    const { store } = await start();
    // 33401 is in the rules on the phone, but the app says no.
    expect(await store.check('33401')).toBe(false);
    expect(store.getState().choice.eligible).toBe(false);
  });

  it('clears the day and says so when it filled up meanwhile', async () => {
    appMock.placeHold.mockResolvedValue({ ok: false, reason: 'full' });
    const { store, basket } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-22');
    store.chooseWindow('09:00-12:00');
    await settle();
    expect(store.getState().choice.date).toBeNull();
    expect(store.getState().error).toBe('That day just filled up. Please choose another.');
    expect(basket.attribute('Delivery date')).toBe('');
    expect(store.canCheckout).toBe(false);
  });

  it('carries on without a hold when the app cannot be reached', async () => {
    appMock.placeHold.mockResolvedValue({ ok: false, reason: 'unreachable' });
    const { store, basket } = await start();
    await store.check('33432');
    store.chooseDate('2026-11-22');
    store.chooseWindow('09:00-12:00');
    await settle();
    expect(store.getState().choice.date).toBe('2026-11-22');
    expect(basket.attribute('_blis_hold')).toBe('');
    expect(await store.prepareCheckout()).toBe(true);
  });

  it('holds a pickup day at its place', async () => {
    const { store, basket } = await start();
    store.chooseMethod('pickup');
    expect(store.days().map((d) => d.iso)).toEqual(['2026-11-21']);
    store.chooseDate('2026-11-21');
    await settle();
    expect(appMock.placeHold).toHaveBeenCalledWith(expect.objectContaining({ method: 'PICKUP', date: '2026-11-21', location: 'loc-swank' }));
    expect(basket.attribute('_blis_location')).toBe('loc-swank');
    expect(basket.attribute('Pickup location')).toBe('Swank Farmers Market · 10 am – 1 pm · 14311 North Road');
    expect(basket.attribute('_blis_hold')).toBe('hold-1');
  });

  it('believes the app about what cannot be shipped', async () => {
    // No metafield on the line (no Storefront token), but the app knows.
    const { store } = await start(cartWith([line({ productId: '11', variantId: '21', title: 'Raw Milk' })]));
    expect(store.needsDelivery).toBe(true);
  });
});
