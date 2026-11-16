// The basket. Shopify holds it; the phone remembers its id. Changes go to
// Shopify one after another (so an older change can't overwrite a newer
// one) and the screen shows Shopify's answer.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { keys, readJSON, writeJSON } from '@/lib/storage';
import * as api from '@/shopify/cart';
import { StorefrontError } from '@/shopify/storefront';
import type { Cart } from '@/shopify/types';

export interface CartState {
  /** false until the saved basket has been looked up. */
  ready: boolean;
  cart: Cart | null;
  /** Changes on their way to Shopify. */
  pending: number;
  error: string | null;
  /** The last thing put in the basket, for the "Added to basket" note. */
  added: { title: string; at: number } | null;
}

type Listener = () => void;

export class CartStore {
  private state: CartState = { ready: false, cart: null, pending: 0, error: null, added: null };
  private listeners = new Set<Listener>();
  private queue: Promise<unknown> = Promise.resolve();
  private started = false;
  /** The signed-in customer's token, so checkout knows who is ordering. */
  private buyerToken: string | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<CartState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private async remember(cart: Cart | null) {
    await writeJSON(keys.cartId, cart ? cart.id : null);
  }

  /** Runs one change after the ones before it. */
  private run<T>(change: () => Promise<T>): Promise<T> {
    this.set({ pending: this.state.pending + 1, error: null });
    const result = this.queue.then(change);
    this.queue = result.catch(() => undefined);
    return result
      .catch((error: unknown) => {
        const message =
          error instanceof StorefrontError ? error.message : "The basket couldn't be updated. Please try again.";
        this.set({ error: message });
        throw error;
      })
      .finally(() => this.set({ pending: Math.max(0, this.state.pending - 1) }));
  }

  private async apply(cart: Cart) {
    this.set({ cart });
    await this.remember(cart);
    return cart;
  }

  /** Looks up the basket saved on the phone. */
  start() {
    if (this.started) return;
    this.started = true;
    this.queue = this.queue
      .then(async () => {
        const id = await readJSON<string>(keys.cartId);
        if (!id) return;
        const cart = await api.fetchCart(id);
        if (cart) this.set({ cart });
        else await this.remember(null);
      })
      .catch(() => undefined)
      .then(() => this.set({ ready: true }));
  }

  /** Reads the basket again. null means it is gone: the order was placed, or it expired. */
  refresh(): Promise<Cart | null> {
    return this.run(async () => {
      const id = this.state.cart?.id;
      if (!id) return null;
      const cart = await api.fetchCart(id);
      this.set({ cart });
      await this.remember(cart);
      return cart;
    });
  }

  add(merchandiseId: string, quantity = 1, title = ''): Promise<Cart> {
    return this.run(async () => {
      const line = { merchandiseId, quantity };
      const current = this.state.cart;
      let cart: Cart;
      if (current) {
        cart = await api.addLines(current.id, [line]);
      } else {
        cart = await api.createCart([line]);
        if (this.buyerToken) cart = await api.setBuyer(cart.id, this.buyerToken).catch(() => cart);
      }
      this.set({ added: { title, at: Date.now() } });
      return this.apply(cart);
    });
  }

  /** Puts several things in the basket at once ("Order again"). */
  addMany(lines: { merchandiseId: string; quantity: number }[]): Promise<Cart | null> {
    return this.run(async () => {
      if (!lines.length) return this.state.cart;
      const current = this.state.cart;
      const cart = current ? await api.addLines(current.id, lines) : await api.createCart(lines);
      return this.apply(cart);
    });
  }

  setQuantity(lineId: string, quantity: number): Promise<Cart | null> {
    // Shown at once; Shopify's answer follows.
    const current = this.state.cart;
    if (current) {
      const nodes = current.lines.nodes
        .map((line) => (line.id === lineId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0);
      this.set({
        cart: { ...current, lines: { nodes }, totalQuantity: nodes.reduce((sum, line) => sum + line.quantity, 0) },
      });
    }
    return this.run(async () => {
      const id = this.state.cart?.id;
      if (!id) return null;
      try {
        const cart =
          quantity > 0 ? await api.updateLines(id, [{ id: lineId, quantity }]) : await api.removeLines(id, [lineId]);
        return await this.apply(cart);
      } catch (error) {
        // Put back what Shopify has.
        const cart = await api.fetchCart(id).catch(() => null);
        if (cart) this.set({ cart });
        throw error;
      }
    });
  }

  remove(lineId: string) {
    return this.setQuantity(lineId, 0);
  }

  /** Replaces the cart's attributes (see delivery/basket.ts: mergeAttributes). */
  setAttributes(build: (cart: Cart) => { key: string; value: string }[] | null): Promise<Cart | null> {
    return this.run(async () => {
      const current = this.state.cart;
      if (!current) return null;
      const attributes = build(current);
      if (!attributes) return current;
      return this.apply(await api.setAttributes(current.id, attributes));
    });
  }

  setNote(note: string): Promise<Cart | null> {
    return this.run(async () => {
      const id = this.state.cart?.id;
      return id ? this.apply(await api.setNote(id, note)) : null;
    });
  }

  /** Applies a discount code; answers whether Shopify accepted it. */
  applyDiscount(code: string): Promise<boolean> {
    return this.run(async () => {
      const current = this.state.cart;
      const wanted = code.trim();
      if (!current || !wanted) return false;
      const codes = [...new Set([...current.discountCodes.map((d) => d.code), wanted])];
      const cart = await this.apply(await api.setDiscountCodes(current.id, codes));
      const applied = cart.discountCodes.some((d) => d.code.toLowerCase() === wanted.toLowerCase() && d.applicable);
      if (!applied) {
        // Leave no dead code on the basket.
        const kept = cart.discountCodes.filter((d) => d.applicable).map((d) => d.code);
        await this.apply(await api.setDiscountCodes(cart.id, kept));
      }
      return applied;
    });
  }

  removeDiscount(code: string): Promise<Cart | null> {
    return this.run(async () => {
      const current = this.state.cart;
      if (!current) return null;
      const codes = current.discountCodes.map((d) => d.code).filter((c) => c !== code);
      return this.apply(await api.setDiscountCodes(current.id, codes));
    });
  }

  /** Called on sign-in and sign-out, so checkout starts signed in (or not). */
  setBuyer(token: string | null): Promise<void> {
    this.buyerToken = token;
    return this.run(async () => {
      const id = this.state.cart?.id;
      if (!id) return;
      await this.apply(await api.setBuyer(id, token));
    }).catch(() => undefined);
  }

  /** Forgets the basket (after an order). */
  async clear() {
    this.set({ cart: null, error: null, added: null });
    await this.remember(null);
  }

  dismissError() {
    if (this.state.error) this.set({ error: null });
  }
}

const CartContext = createContext<CartStore | null>(null);

export function CartProvider({ store, children }: { store: CartStore; children: ReactNode }) {
  useEffect(() => {
    store.start();
  }, [store]);
  return <CartContext.Provider value={store}>{children}</CartContext.Provider>;
}

export function useCartStore(): CartStore {
  const store = useContext(CartContext);
  if (!store) throw new Error('useCartStore needs a CartProvider above it');
  return store;
}

/** The basket and what can be done with it. */
export function useCart() {
  const store = useCartStore();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return useMemo(() => ({ ...state, store, count: state.cart?.totalQuantity ?? 0 }), [state, store]);
}
