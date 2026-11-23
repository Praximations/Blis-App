// The basket store, with a stand-in for Shopify.

import * as api from '@/shopify/cart';
import { StorefrontError } from '@/shopify/storefront';
import type { Cart } from '@/shopify/types';
import { CartStore } from '@/state/cart';

import { cartWith, line } from './helpers';

jest.mock('@/shopify/cart');
jest.mock('@/lib/storage', () => ({ keys: { cartId: 'cart' }, readJSON: jest.fn(), writeJSON: jest.fn() }));

/** What the phone has saved. */
const saved = new Map<string, unknown>();

const shopify = jest.mocked(api);
const storage = jest.requireMock('@/lib/storage') as { readJSON: jest.Mock; writeJSON: jest.Mock };

const honey = line({ productId: '13', variantId: '23', title: 'Truffle Honey' });
const milk = line({ productId: '11', variantId: '21', title: 'Raw Milk' });
const withId = (cart: Cart, id: string): Cart => ({ ...cart, id });
const HONEY = honey.merchandise.id;
const MILK = milk.merchandise.id;
// Shopify's remarks, as it sends them.
const soldOut = (l: typeof honey) => ({ code: 'MERCHANDISE_OUT_OF_STOCK', message: `The product '${l.merchandise.product.title}' is already sold out.`, target: l.id });
const notEnough = (l: typeof honey) => ({ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'Only 10 items were added to your cart due to availability.', target: l.id });

const settle = async () => {
  for (let i = 0; i < 8; i++) await new Promise<void>((resolve) => setImmediate(() => resolve()));
};

beforeEach(async () => {
  jest.resetAllMocks();
  storage.readJSON.mockImplementation(async (key: string) => saved.get(key) ?? null);
  shopify.warningsFor.mockReturnValue([]);
  storage.writeJSON.mockImplementation(async (key: string, value: unknown) => {
    if (value == null) saved.delete(key);
    else saved.set(key, value);
  });
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

  it('clears an empty line left in the saved basket', async () => {
    await storage.writeJSON('cart', 'cart-1');
    shopify.fetchCart.mockResolvedValue(withId(cartWith([honey, { ...milk, quantity: 0 }]), 'cart-1'));
    shopify.removeLines.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    store.start();
    await settle();
    expect(shopify.removeLines).toHaveBeenCalledWith('cart-1', [milk.id]);
    expect(store.getState().cart?.lines.nodes.map((l) => l.id)).toEqual([honey.id]);
    expect(store.getState().error).toBeNull();
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
    await store.add(HONEY);
    await store.add(MILK);
    expect(store.getState().cart?.id).toBe('new');
    expect(await storage.readJSON('cart')).toBe('new');
  });

  it('signs the new basket in as the customer', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    shopify.setBuyer.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await store.setBuyer('customer-token');
    expect(shopify.setBuyer).not.toHaveBeenCalled(); // no basket yet
    await store.add(HONEY);
    expect(shopify.setBuyer).toHaveBeenCalledWith('cart-1', 'customer-token');
  });

  it('says what went wrong, and carries on afterwards', async () => {
    shopify.createCart.mockRejectedValueOnce(new StorefrontError('The product is sold out.'));
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await expect(store.add(HONEY)).rejects.toThrow('The product is sold out.');
    expect(store.getState()).toMatchObject({ error: 'The product is sold out.', pending: 0, cart: null });
    await store.add(HONEY);
    expect(store.getState()).toMatchObject({ error: null, cart: { id: 'cart-1' } });
  });

  it("doesn't say Added when the product sold out in the meantime", async () => {
    // Shopify answers with a new basket holding a line of quantity 0 and a remark, not an error.
    const answer = withId(cartWith([{ ...milk, quantity: 0 }]), 'new');
    shopify.createCart.mockResolvedValue(answer);
    shopify.warningsFor.mockImplementation((cart) => (cart === answer ? [soldOut(milk)] : []));
    shopify.removeLines.mockResolvedValue(withId(cartWith([]), 'new'));
    const store = new CartStore();
    await expect(store.add(MILK, 1, 'Raw Milk')).rejects.toThrow('Raw Milk is sold out.');
    expect(store.getState()).toMatchObject({ cart: null, added: null, error: 'Raw Milk is sold out.' });
    // The basket made just for it isn't kept.
    expect(await storage.readJSON('cart')).toBeNull();
  });

  it('takes the empty line a sold-out product leaves out of the basket', async () => {
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const answer = withId(cartWith([honey, { ...milk, quantity: 0 }]), 'cart-1');
    shopify.addLines.mockResolvedValue(answer);
    shopify.warningsFor.mockImplementation((cart) => (cart === answer ? [soldOut(milk)] : []));
    shopify.removeLines.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    await store.add(HONEY);
    await expect(store.add(MILK)).rejects.toThrow('Raw Milk is sold out.');
    expect(shopify.removeLines).toHaveBeenCalledWith('cart-1', [milk.id]);
    expect(store.getState().cart?.lines.nodes.map((l) => l.id)).toEqual([honey.id]);
  });

  it("doesn't repeat an old remark about something else", async () => {
    // Shopify repeats "sold out" for a line left from before on every later change.
    const butter = line({ productId: '15', variantId: '25', title: 'Raw Butter' });
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const answer = withId(cartWith([honey, milk, { ...butter, quantity: 0 }]), 'cart-1');
    shopify.addLines.mockResolvedValue(answer);
    shopify.warningsFor.mockImplementation((cart) => (cart === answer ? [soldOut(butter)] : []));
    shopify.removeLines.mockResolvedValue(withId(cartWith([honey, milk]), 'cart-1'));
    const store = new CartStore();
    await store.add(HONEY);
    await store.add(MILK, 1, 'Raw Milk');
    expect(store.getState()).toMatchObject({ error: null, added: { title: 'Raw Milk' } });
    expect(store.getState().cart?.lines.nodes).toHaveLength(2);
  });

  it('keeps the basket as it was when it already holds all there is', async () => {
    const unchanged = withId(cartWith([honey]), 'cart-1');
    shopify.createCart.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    shopify.addLines.mockResolvedValue(unchanged);
    shopify.warningsFor.mockImplementation((cart) => (cart === unchanged ? [notEnough(honey)] : []));
    const store = new CartStore();
    await store.add(HONEY);
    await expect(store.add(HONEY)).rejects.toThrow('Only 1 of Truffle Honey is available.');
    expect(store.getState().cart?.totalQuantity).toBe(1);
  });

  it('says so when fewer went in than were asked for', async () => {
    const capped = withId(cartWith([{ ...honey, quantity: 10 }]), 'cart-1');
    shopify.createCart.mockResolvedValue(capped);
    shopify.warningsFor.mockImplementation((cart) => (cart === capped ? [notEnough(honey)] : []));
    const store = new CartStore();
    await store.add(HONEY, 25, 'Truffle Honey');
    expect(store.getState()).toMatchObject({ cart: { id: 'cart-1', totalQuantity: 10 }, error: 'Only 10 of Truffle Honey are available.' });
    expect(store.getState().added?.title).toBe('Truffle Honey');
  });

  it('orders again what it can and names what is sold out', async () => {
    const answer = withId(cartWith([honey, { ...milk, quantity: 0 }]), 'cart-1');
    shopify.createCart.mockResolvedValue(answer);
    shopify.warningsFor.mockImplementation((cart) => (cart === answer ? [soldOut(milk)] : []));
    shopify.removeLines.mockResolvedValue(withId(cartWith([honey]), 'cart-1'));
    const store = new CartStore();
    const cart = await store.addMany([
      { merchandiseId: HONEY, quantity: 1 },
      { merchandiseId: MILK, quantity: 2 },
    ]);
    expect(cart?.lines.nodes.map((l) => l.id)).toEqual([honey.id]);
    expect(store.getState().error).toBe('Raw Milk is sold out.');
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
    await Promise.all([store.add(HONEY), store.add(MILK)]);
    expect(order).toEqual(['create', 'add']);
    expect(shopify.createCart).toHaveBeenCalledTimes(1);
  });
});

describe('changing', () => {
  async function started(cart = withId(cartWith([honey, milk]), 'cart-1')) {
    shopify.createCart.mockResolvedValue(cart);
    const store = new CartStore();
    await store.add(HONEY);
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

  it('says so when a quantity is more than the shop has', async () => {
    const store = await started();
    const capped = withId(cartWith([{ ...honey, quantity: 10 }, milk]), 'cart-1');
    shopify.updateLines.mockResolvedValue(capped);
    shopify.warningsFor.mockImplementation((cart) => (cart === capped ? [notEnough(honey)] : []));
    await store.setQuantity(honey.id, 40);
    expect(store.getState().cart?.lines.nodes[0].quantity).toBe(10);
    expect(store.getState().error).toBe('Only 10 of Truffle Honey are available.');
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
    await store.add(HONEY);
    // Shopify deletes a cart when its order is created.
    shopify.fetchCart.mockResolvedValue(null);
    expect(await store.refresh()).toBeNull();
    expect(store.getState().cart).toBeNull();
    expect(await storage.readJSON('cart')).toBeNull();

    await store.clear();
    shopify.createCart.mockResolvedValue(withId(cartWith([milk]), 'cart-2'));
    await store.add(MILK);
    expect(store.getState().cart?.id).toBe('cart-2');
  });
});
