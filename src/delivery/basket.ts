// What the basket's contents mean for delivery: which lines can only be
// delivered locally, which only go out on some weekdays, and whose order-by
// times count. The website works the same things out in
// snippets/delivery-card.liquid.

import { numericId } from '@/shopify/storefront';
import type { Cart, CartLine } from '@/shopify/types';
import { tagWeekdays } from './days';
import type { CutoffMode, DayLimit, DeliveryChoice, DeliveryDay, TimeWindow } from './types';

/** The tag the Blis Delivery app reads for "can't be shipped". */
export const LOCAL_ONLY_TAG = 'local-delivery-only';

interface LocalOnlyProduct {
  tags: string[];
  localDeliveryOnly?: { value: string | null } | null;
}

/** Fresh and chilled products that our drivers deliver and that can't be shipped. */
export function isLocalOnly(product: LocalOnlyProduct | null | undefined): boolean {
  if (!product) return false;
  if (product.localDeliveryOnly?.value === 'true') return true;
  return product.tags.some((tag) => tag.toLowerCase().trim() === LOCAL_ONLY_TAG);
}

// (A line of quantity 0 is what a sold-out product leaves behind; it is not in the basket.)
const lines = (cart: Cart | null) => (cart?.lines.nodes ?? []).filter((line) => line.quantity > 0);

export const localOnlyLines = (cart: Cart | null): CartLine[] =>
  lines(cart).filter((line) => isLocalOnly(line.merchandise.product));

/** "productId:variantId:quantity,…": the basket as the delivery app wants it. */
export function lineRefs(cart: Cart | null): string {
  return lines(cart)
    .slice(0, 100)
    .map((line) => `${numericId(line.merchandise.product.id)}:${numericId(line.merchandise.id)}:${line.quantity}`)
    .join(',');
}

/** Products tagged delivery-day:<weekday>, each with the weekdays it allows. */
export function dayLimits(cart: Cart | null, prefix = 'delivery-day:'): DayLimit[] {
  const seen = new Set<string>();
  const limits: DayLimit[] = [];
  for (const line of lines(cart)) {
    const days = tagWeekdays(line.merchandise.product.tags, prefix);
    if (!days.length) continue;
    const name = line.merchandise.product.title;
    const key = `${name}|${days.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    limits.push({ name, days });
  }
  return limits;
}

/** Does this product have its own order-by times (a product type or tag: "Beef")? */
export function hasOwnCutoff(product: { productType: string; tags: string[] }, match: string | undefined): boolean {
  const wanted = (match ?? '').trim().toLowerCase();
  if (!wanted) return false;
  if (product.productType.trim().toLowerCase() === wanted) return true;
  return product.tags.some((tag) => tag.trim().toLowerCase() === wanted);
}

/** The shop's order-by times, the products' own (only those products), or the earlier of the two (a mix). */
export function cutoffMode(cart: Cart | null, match: string | undefined): CutoffMode {
  const all = lines(cart);
  const own = all.filter((line) => hasOwnCutoff(line.merchandise.product, match)).length;
  if (!own) return 'general';
  return own === all.length ? 'own' : 'both';
}

// ─── Cart attributes ────────────────────────────────────────────────────────

/**
 * Every attribute the delivery choice owns. The readable ones show on the
 * order in the Shopify admin; the _blis_ ones are read by the Blis Delivery
 * app to schedule the order.
 */
export const DELIVERY_ATTRIBUTES = [
  'Delivery date',
  'Delivery day',
  'Delivery time',
  'Delivery method',
  'Delivery area',
  'Delivery ZIP',
  'Pickup location',
  'Next delivery',
  'Next pickup',
  '_blis_method',
  '_blis_date',
  '_blis_zip',
  '_blis_location',
  '_blis_slot',
  '_blis_hold',
] as const;

/** The attributes for a choice; an empty value means "not set". */
export function deliveryAttributes(
  day: DeliveryDay | null,
  choice: Pick<DeliveryChoice, 'area' | 'zip'>,
  slot: TimeWindow | null,
  hold: string | null,
): Record<string, string> {
  const pickup = !!day && day.pickup;
  return {
    'Delivery date': day ? day.iso : '',
    'Delivery day': day ? day.label : '',
    'Delivery time': day && slot ? slot.label : '',
    'Delivery method': day ? (pickup ? `Pickup${day.location ? ` at ${day.location}` : ''}` : 'Local delivery') : '',
    'Delivery area': day && !pickup ? (choice.area ?? '') : '',
    'Delivery ZIP': day && !pickup ? (choice.zip ?? '') : '',
    'Pickup location': pickup ? [day.location, day.details].filter(Boolean).join(' · ') : '',
    'Next delivery': '',
    'Next pickup': '',
    _blis_method: day ? (pickup ? 'PICKUP' : 'DELIVERY') : '',
    _blis_date: day ? day.iso : '',
    _blis_zip: day && !pickup ? (choice.zip ?? '') : '',
    _blis_location: pickup ? day.locationId || day.location : '',
    _blis_slot: day && slot ? slot.key : '',
    _blis_hold: day ? (hold ?? '') : '',
  };
}

/**
 * The cart's attributes with the delivery ones replaced. Shopify replaces
 * the whole list on every write and refuses empty values, so what isn't the
 * delivery choice's is kept and what is empty is left out.
 */
export function mergeAttributes(
  existing: { key: string; value: string | null }[],
  delivery: Record<string, string>,
): { key: string; value: string }[] {
  const owned = new Set<string>(DELIVERY_ATTRIBUTES);
  const kept = existing
    .filter((a) => !owned.has(a.key) && a.value)
    .map((a) => ({ key: a.key, value: a.value as string }));
  const set = DELIVERY_ATTRIBUTES.filter((key) => delivery[key]).map((key) => ({ key, value: delivery[key] }));
  return [...kept, ...set];
}

/** Do the cart's delivery attributes already say this? */
export function attributesMatch(existing: { key: string; value: string | null }[], delivery: Record<string, string>) {
  const current = new Map(existing.map((a) => [a.key, a.value ?? '']));
  return DELIVERY_ATTRIBUTES.every((key) => (current.get(key) ?? '') === (delivery[key] ?? ''));
}
