// The basket store, with a stand-in for Shopify.

import * as api from '@/shopify/cart';
import { StorefrontError } from '@/shopify/storefront';
import type { Cart } from '@/shopify/types';
import { CartStore } from '@/state/cart';

import { cartWith, line } from './helpers';

jest.mock('@/shopify/cart');
jest.mock('@/lib/storage', () => {
  const saved = new Map<string, unknown>();
  return {
    keys: { cartId: 'cart' },
    readJSON: jest.fn(async (key: string) => saved.get(key) ?? null),
    writeJSON: jest.fn(async (key: string, value: unknown) => {
      if (value == null) saved.delete(key);
      else saved.set(key, value);
    }),
  };
});

const shopify = jest.mocked(api);
const storage = jest.requireMock('@/lib/storage') as { readJSON: jest.Mock; writeJSON: jest.Mock };

const honey = line({ productId: '13', variantId: '23', title: 'Truffle Honey' });
const milk = line({ productId: '11', variantId: '21', title: 'Raw Milk' });
const withId = (cart: Cart, id: string): Cart => ({ ...cart, id });

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => setImmediate(() => resolve()));
};

beforeEach(async () => {
  jest.clearAllMocks();
  await storage.writeJSON('cart', null);
});

describe('starting', () => {
  it('picks up the basket saved on the phone', async () => {
    await storage.writeJSON('cart', 'cart-1');
    shopify.fetchCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    store.start();
    await settle();
    expect(shopify.fetchCart).toHaveBeenCalledWith('cart-1');
    expect(store.getState()).toMatchObject({ ready: true, cart: { id: 'cart-1', totalQuantity: 1 } });
  });

  it('forgets a basket Shopify no longer has (checked out, or expired)', async () => {
    await storage.writeJSON('cart', 'gone');
    shopify.fetchCart.mockResolvedValue(null);
    const store = new CartStore();
    store.start();
    await settle();
    expect(store.getState()).toMatchObject({ ready: true, cart: null });
    expect(await storage.readJSON('cart')).toBeNull();
  });

  it('is ready even when the shop cannot be reached', async () => {
    await storage.writeJSON('cart', 'cart-1');
    shopify.fetchCart.mockRejectedValue(new StorefrontError('offline'));
    const store = new CartStore();
    store.start();
    await settle();
    expect(store.getState().ready).toBe(true);
    // The id is kept for the next try.
    expect(await storage.readJSON('cart')).toBe('cart-1');
  });
});

describe('adding', () => {
  it('makes a basket for the first product, marked as coming from the app, then adds to it', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    shopify.addLines.mockResolvedValue(withId(cartWith([honey, milk]), 'cart-1'));
    const store = new CartStore();

    await store.add('gid://shopify/ProductVariant/23', 1, 'Truffle Honey');
    expect(shopify.createCart).toHaveBeenCalledWith(
      [{ merchandiseId: 'gid://shopify/ProductVariant/23', quantity: 1 }],
      [{ key: '_source', value: expect.stringMatching(/^Blis Farms app \(/) }],
    );
    expect(await storage.readJSON('cart')).toBe('cart-1');
    expect(store.getState().added?.title).toBe('Truffle Honey');

    await store.add('gid://shopify/ProductVariant/21', 2, 'Raw Milk');
    expect(shopify.addLines).toHaveBeenCalledWith('cart-1', [{ merchandiseId: 'gid://shopify/ProductVariant/21', quantity: 2 }]);
    expect(store.getState().cart?.lines.nodes).toHaveLength(2);
  });

  it('follows Shopify when it answers with a new basket (the old one had expired)', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'old'));
    shopify.addLines.mockResolvedValue(withId(cartWith([milk]), 'new'));
    const store = new CartStore();
    await store.add('v1');
    await store.add('v2');
    expect(store.getState().cart?.id).toBe('new');
    expect(await storage.readJSON('cart')).toBe('new');
  });

  it('signs the new basket in as the customer', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    shopify.setBuyer.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await store.setBuyer('customer-token');
    expect(shopify.setBuyer).not.toHaveBeenCalled(); // no basket yet
    await store.add('v1');
    expect(shopify.setBuyer).toHaveBeenCalledWith('cart-1', 'customer-token');
  });

  it('says what went wrong, and carries on afterwards', async () => {
    shopify.createCart.mockRejectedValueOnce(new StorefrontError('The product is sold out.'));
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await expect(store.add('v1')).rejects.toThrow('The product is sold out.');
    expect(store.getState()).toMatchObject({ error: 'The product is sold out.', pending: 0, cart: null });
    await store.add('v1');
    expect(store.getState()).toMatchObject({ error: null, cart: { id: 'cart-1' } });
  });

  it('sends changes one after another, in the order they were made', async () => {
    const order: string[] = [];
    shopify.createCart.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('create');
      return withId(cartWith([honey]), 'cart-1');
    });
    shopify.addLines.mockImplementation(async () => {
      order.push('add');
      return withId(cartWith([honey, milk]), 'cart-1');
    });
    const store = new CartStore();
    // The second starts before the first has answered: it must wait, and use the basket the first made.
    await Promise.all([store.add('v1'), store.add('v2')]);
    expect(order).toEqual(['create', 'add']);
    expect(shopify.createCart).toHaveBeenCalledTimes(1);
  });
});

describe('changing', () => {
  async function started(cart = withId(cartWith([honey, milk]), 'cart-1')) {
    shopify.createCart.mockResolvedValue(cart);
    const store = new CartStore();
    await store.add('v1');
    return store;
  }

  it('shows a new quantity at once and then what Shopify says', async () => {
    const store = await started();
    let release: (cart: Cart) => void = () => undefined;
    shopify.updateLines.mockReturnValue(new Promise<Cart>((resolve) => (release = resolve)));
    const change = store.setQuantity(honey.id, 3);
    // Before Shopify has answered:
    expect(store.getState().cart?.lines.nodes[0].quantity).toBe(3);
    expect(store.getState().cart?.totalQuantity).toBe(4);
    expect(store.getState().pending).toBe(1);
    release(withId(cartWith([{ ...honey, quantity: 3 }, milk]), 'cart-1'));
    await change;
    expect(shopify.updateLines).toHaveBeenCalledWith('cart-1', [{ id: honey.id, quantity: 3 }]);
    expect(store.getState().pending).toBe(0);
  });

  it('puts the basket back as Shopify has it when a change is refused', async () => {
    const store = await started();
    shopify.updateLines.mockRejectedValue(new StorefrontError('Only 2 left.'));
    shopify.fetchCart.mockResolvedValue(withId(cartWith([honey, milk]), 'cart-1'));
    await expect(store.setQuantity(honey.id, 9)).rejects.toThrow('Only 2 left.');
    expect(store.getState().cart?.lines.nodes[0].quantity).toBe(1);
    expect(store.getState().error).toBe('Only 2 left.');
  });

  it('removes a line', async () => {
    const store = await started();
    shopify.removeLines.mockResolvedValue(withId(cartWith([milk]), 'cart-1'));
    await store.remove(honey.id);
    expect(shopify.removeLines).toHaveBeenCalledWith('cart-1', [honey.id]);
    expect(store.getState().cart?.lines.nodes.map((l) => l.id)).toEqual([milk.id]);
  });

  it('keeps a discount code Shopify accepts and takes off one it refuses', async () => {
    const store = await started();
    const cart = store.getState().cart!;
    shopify.setDiscountCodes.mockResolvedValueOnce({ ...cart, discountCodes: [{ code: 'ENJOY15', applicable: true }] });
    expect(await store.applyDiscount(' enjoy15 ')).toBe(true);
    expect(shopify.setDiscountCodes).toHaveBeenLastCalledWith('cart-1', ['enjoy15']);

    shopify.setDiscountCodes
      .mockResolvedValueOnce({ ...cart, discountCodes: [{ code: 'ENJOY15', applicable: true }, { code: 'NOPE', applicable: false }] })
      .mockResolvedValueOnce({ ...cart, discountCodes: [{ code: 'ENJOY15', applicable: true }] });
    expect(await store.applyDiscount('NOPE')).toBe(false);
    expect(shopify.setDiscountCodes).toHaveBeenLastCalledWith('cart-1', ['ENJOY15']);
    expect(store.getState().cart?.discountCodes).toEqual([{ code: 'ENJOY15', applicable: true }]);
  });

  it('writes attributes only when there is something to write', async () => {
    const store = await started();
    await store.setAttributes(() => null);
    expect(shopify.setAttributes).not.toHaveBeenCalled();
    shopify.setAttributes.mockResolvedValue(withId(cartWith([honey], [{ key: 'Delivery date', value: '2026-11-20' }]), 'cart-1'));
    await store.setAttributes(() => [{ key: 'Delivery date', value: '2026-11-20' }]);
    expect(shopify.setAttributes).toHaveBeenCalledWith('cart-1', [{ key: 'Delivery date', value: '2026-11-20' }]);
  });
});

describe('after checkout', () => {
  it('finds the basket gone once the order is placed, and starts afresh', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await store.add('v1');
    // Shopify deletes a cart when its order is created.
    shopify.fetchCart.mockResolvedValue(null);
    expect(await store.refresh()).toBeNull();
    expect(store.getState().cart).toBeNull();
    expect(await storage.readJSON('cart')).toBeNull();

    await store.clear();
    shopify.createCart.mockResolvedValue(withId(cartWith([milk]), 'cart-2'));
    await store.add('v2');
    expect(store.getState().cart?.id).toBe('cart-2');
  });
});
