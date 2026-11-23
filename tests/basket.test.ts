import {
  attributesMatch,
  cutoffMode,
  dayLimits,
  deliveryAttributes,
  isLocalOnly,
  lineRefs,
  localOnlyLines,
  mergeAttributes,
} from '@/delivery/basket';
import type { DeliveryDay } from '@/delivery/types';
import type { Cart } from '@/shopify/types';

import { cartWith, line } from './helpers';

const friday: DeliveryDay = {
  iso: '2026-11-20',
  pickup: false,
  label: 'Friday, November 20',
  weekday: 'Friday',
  weekdayShort: 'Fri',
  monthDay: 'Nov 20',
  cutoffLabel: 'Tuesday at noon',
  location: '',
  locationId: '',
  details: '',
  windows: [{ key: '09:00-12:00', label: '9 am – 12 pm' }],
};
const saturday: DeliveryDay = {
  ...friday,
  iso: '2026-11-21',
  pickup: true,
  label: 'Saturday, November 21',
  weekday: 'Saturday',
  location: 'Swank Farmers Market',
  locationId: 'loc-swank',
  details: '10 am – 1 pm · 14311 North Road, Loxahatchee Groves',
  windows: [],
};

describe('what the basket means for delivery', () => {
  const cart: Cart = cartWith([
    line({ productId: '11', variantId: '21', quantity: 2, title: 'Guernsey Raw Milk', tags: ['delivery-day:sunday'], localOnly: true }),
    line({ productId: '12', variantId: '22', quantity: 1, title: 'Ribeye', productType: 'Beef' }),
    line({ productId: '13', variantId: '23', quantity: 1, title: 'Truffle Honey' }),
  ]);

  it('lists the lines for the delivery app', () => {
    expect(lineRefs(cart)).toBe('11:21:2,12:22:1,13:23:1');
    expect(lineRefs(null)).toBe('');
    // A line of quantity 0 (left by a sold-out product) is not in the basket.
    expect(lineRefs(cartWith([line({ productId: '11', variantId: '21', quantity: 0, localOnly: true })]))).toBe('');
    expect(localOnlyLines(cartWith([line({ quantity: 0, localOnly: true })]))).toEqual([]);
  });

  it('knows what cannot be shipped, from the metafield or the tag', () => {
    expect(localOnlyLines(cart).map((l) => l.merchandise.product.title)).toEqual(['Guernsey Raw Milk']);
    expect(isLocalOnly({ tags: ['Local-Delivery-Only'] })).toBe(true);
    expect(isLocalOnly({ tags: [], localDeliveryOnly: { value: 'false' } })).toBe(false);
    expect(isLocalOnly(null)).toBe(false);
  });

  it('finds the products that only go out on some days', () => {
    expect(dayLimits(cart)).toEqual([{ name: 'Guernsey Raw Milk', days: [0] }]);
  });

  it("decides whose order-by times count", () => {
    expect(cutoffMode(cart, 'Beef')).toBe('both');
    expect(cutoffMode(cartWith([line({ title: 'Ribeye', productType: 'beef' })]), 'Beef')).toBe('own');
    expect(cutoffMode(cartWith([line({ title: 'Steak', tags: ['BEEF'] })]), 'Beef')).toBe('own');
    expect(cutoffMode(cartWith([line({ title: 'Honey' })]), 'Beef')).toBe('general');
    expect(cutoffMode(cart, undefined)).toBe('general');
  });
});

describe('cart attributes', () => {
  it('describe a delivery the way the website does', () => {
    expect(deliveryAttributes(friday, { area: 'Boca Raton', zip: '33432' }, friday.windows[0], 'hold-1')).toEqual({
      'Delivery date': '2026-11-20',
      'Delivery day': 'Friday, November 20',
      'Delivery time': '9 am – 12 pm',
      'Delivery method': 'Local delivery',
      'Delivery area': 'Boca Raton',
      'Delivery ZIP': '33432',
      'Pickup location': '',
      'Next delivery': '',
      'Next pickup': '',
      _blis_method: 'DELIVERY',
      _blis_date: '2026-11-20',
      _blis_zip: '33432',
      _blis_location: '',
      _blis_slot: '09:00-12:00',
      _blis_hold: 'hold-1',
    });
  });

  it('describe a pickup', () => {
    expect(deliveryAttributes(saturday, { area: 'Boca Raton', zip: '33432' }, null, null)).toMatchObject({
      'Delivery date': '2026-11-21',
      'Delivery method': 'Pickup at Swank Farmers Market',
      'Delivery area': '',
      'Delivery ZIP': '',
      'Pickup location': 'Swank Farmers Market · 10 am – 1 pm · 14311 North Road, Loxahatchee Groves',
      _blis_method: 'PICKUP',
      _blis_zip: '',
      _blis_location: 'loc-swank',
      _blis_slot: '',
      _blis_hold: '',
    });
  });

  it('are all empty when nothing is chosen', () => {
    const none = deliveryAttributes(null, { area: 'Boca Raton', zip: '33432' }, null, 'hold-1');
    expect(Object.values(none).every((value) => value === '')).toBe(true);
  });

  it('replace the delivery ones and keep everything else', () => {
    const existing = [
      { key: 'Mobile', value: '(561) 555-0123' },
      { key: 'Delivery date', value: '2026-11-18' },
      { key: '_blis_hold', value: 'old' },
      { key: 'Gift note', value: null },
    ];
    const merged = mergeAttributes(existing, deliveryAttributes(saturday, { area: null, zip: null }, null, null));
    expect(merged[0]).toEqual({ key: 'Mobile', value: '(561) 555-0123' });
    expect(merged.find((a) => a.key === 'Delivery date')?.value).toBe('2026-11-21');
    // Nothing empty is sent: Shopify refuses empty values.
    expect(merged.every((a) => a.value !== '')).toBe(true);
    expect(merged.some((a) => a.key === '_blis_hold' || a.key === 'Gift note')).toBe(false);
  });

  it('tell whether the cart already says so', () => {
    const wanted = deliveryAttributes(friday, { area: 'Boca Raton', zip: '33432' }, null, null);
    const onCart = mergeAttributes([{ key: 'Mobile', value: 'x' }], wanted);
    expect(attributesMatch(onCart, wanted)).toBe(true);
    expect(attributesMatch(onCart, deliveryAttributes(null, { area: null, zip: null }, null, null))).toBe(false);
    expect(attributesMatch([], deliveryAttributes(null, { area: null, zip: null }, null, null))).toBe(true);
  });
});
