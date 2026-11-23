// The basket lives in Shopify (Storefront API cart): the app keeps only its
// id. Every change returns the whole cart, so the screen always shows what
// Shopify has.

import * as q from './queries';
import { storefront, StorefrontError } from './storefront';
import type { Cart, UserError } from './types';

export interface LineInput {
  merchandiseId: string;
  quantity: number;
  attributes?: { key: string; value: string }[];
}

export interface AttributeInput {
  key: string;
  value: string;
}

/**
 * Shopify's remark on a change that went through differently than asked:
 * MERCHANDISE_OUT_OF_STOCK (nothing went in), MERCHANDISE_NOT_ENOUGH_STOCK
 * (fewer went in). `target` is the cart line it is about.
 */
export interface CartWarning {
  code: string;
  message: string;
  target: string | null;
}

type Payload = { cart: Cart | null; userErrors: UserError[]; warnings?: CartWarning[] | null };

const warnings = new WeakMap<Cart, CartWarning[]>();

/** The remarks that came with this cart (none for a cart that was only read). */
export const warningsFor = (cart: Cart | null | undefined): CartWarning[] => (cart && warnings.get(cart)) || [];

function unwrap(payload: Payload | null | undefined): Cart {
  const error = payload?.userErrors?.[0];
  if (error) throw new StorefrontError(error.message, 200, error.code ?? 'USER_ERROR');
  if (!payload?.cart) throw new StorefrontError("The basket couldn't be updated. Please try again.");
  if (payload.warnings?.length) warnings.set(payload.cart, payload.warnings);
  return payload.cart;
}

/** The cart, or null when it no longer exists (checked out, or expired). */
export async function fetchCart(id: string): Promise<Cart | null> {
  const data = await storefront<{ cart: Cart | null }>(q.CART_QUERY, { id });
  return data.cart;
}

export async function createCart(lines: LineInput[] = [], attributes: AttributeInput[] = []): Promise<Cart> {
  const data = await storefront<{ cartCreate: Payload }>(q.CART_CREATE, {
    input: { lines, attributes, buyerIdentity: { countryCode: 'US' } },
  });
  return unwrap(data.cartCreate);
}

export async function addLines(cartId: string, lines: LineInput[]): Promise<Cart> {
  const data = await storefront<{ cartLinesAdd: Payload }>(q.CART_LINES_ADD, { cartId, lines });
  return unwrap(data.cartLinesAdd);
}

export async function updateLines(cartId: string, lines: { id: string; quantity: number }[]): Promise<Cart> {
  const data = await storefront<{ cartLinesUpdate: Payload }>(q.CART_LINES_UPDATE, { cartId, lines });
  return unwrap(data.cartLinesUpdate);
}

export async function removeLines(cartId: string, lineIds: string[]): Promise<Cart> {
  const data = await storefront<{ cartLinesRemove: Payload }>(q.CART_LINES_REMOVE, { cartId, lineIds });
  return unwrap(data.cartLinesRemove);
}

/** Replaces all of the cart's attributes (Shopify has no "set one"). */
export async function setAttributes(cartId: string, attributes: AttributeInput[]): Promise<Cart> {
  const data = await storefront<{ cartAttributesUpdate: Payload }>(q.CART_ATTRIBUTES_UPDATE, { cartId, attributes });
  return unwrap(data.cartAttributesUpdate);
}

export async function setNote(cartId: string, note: string): Promise<Cart> {
  const data = await storefront<{ cartNoteUpdate: Payload }>(q.CART_NOTE_UPDATE, { cartId, note });
  return unwrap(data.cartNoteUpdate);
}

export async function setDiscountCodes(cartId: string, discountCodes: string[]): Promise<Cart> {
  const data = await storefront<{ cartDiscountCodesUpdate: Payload }>(q.CART_DISCOUNT_CODES_UPDATE, {
    cartId,
    discountCodes,
  });
  return unwrap(data.cartDiscountCodesUpdate);
}

/** Signs the cart's checkout in as this customer (or out, with null). */
export async function setBuyer(cartId: string, customerAccessToken: string | null): Promise<Cart> {
  const data = await storefront<{ cartBuyerIdentityUpdate: Payload }>(q.CART_BUYER_IDENTITY_UPDATE, {
    cartId,
    buyerIdentity: { countryCode: 'US', customerAccessToken },
  });
  return unwrap(data.cartBuyerIdentityUpdate);
}
