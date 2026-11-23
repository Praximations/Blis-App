// The signed-in session, with a stand-in for Shopify's customer API.

import * as api from '@/shopify/customer';
import { AuthStore } from '@/state/auth';
import type { CartStore } from '@/state/cart';

jest.mock('@/lib/storage', () => ({
  keys: { session: 'session' },
  readSecret: jest.fn(),
  writeSecret: jest.fn(),
}));
jest.mock('@/shopify/customer', () => {
  // The real error class, so `instanceof` works; everything that talks to Shopify is a stand-in.
  class CustomerError extends Error {
    expired: boolean;
    invalid: boolean;
    constructor(message: string, flags: { expired?: boolean; invalid?: boolean } = {}) {
      super(message);
      this.expired = !!flags.expired;
      this.invalid = !!flags.invalid;
    }
  }
  return {
    CustomerError,
    signInAvailable: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
    refresh: jest.fn(),
    getCustomer: jest.fn(),
  };
});

const shopify = jest.mocked(api);
const storage = jest.requireMock('@/lib/storage') as { readSecret: jest.Mock; writeSecret: jest.Mock };

/** What the phone's keychain holds. */
const keychain = new Map<string, unknown>();
const basket = { setBuyer: jest.fn(async () => undefined) };
const customer = { id: 'gid://shopify/Customer/1', firstName: 'Dana', lastName: null, displayName: 'Dana', emailAddress: { emailAddress: 'dana@example.com' }, phoneNumber: null, defaultAddress: null };

const session = (accessToken: string, minutes: number) => ({ accessToken, refreshToken: 'refresh-1', idToken: 'id-1', expiresAt: Date.now() + minutes * 60_000 });
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => setImmediate(() => resolve()));
};

function saveSession(s: ReturnType<typeof session> | null) {
  keychain.clear();
  if (!s) return;
  keychain.set('session.access', { accessToken: s.accessToken, expiresAt: s.expiresAt });
  keychain.set('session.refresh', s.refreshToken);
  keychain.set('session.id', s.idToken);
}

async function start() {
  const store = new AuthStore(basket as unknown as CartStore);
  store.start();
  await settle();
  return store;
}

beforeEach(() => {
  jest.resetAllMocks();
  keychain.clear();
  storage.readSecret.mockImplementation(async (key: string) => keychain.get(key) ?? null);
  storage.writeSecret.mockImplementation(async (key: string, value: unknown) => {
    if (value == null) keychain.delete(key);
    else keychain.set(key, value);
  });
  shopify.getCustomer.mockResolvedValue(customer);
});

describe('starting', () => {
  it('is signed out on a phone that has never signed in', async () => {
    const store = await start();
    expect(store.getState()).toMatchObject({ ready: true, session: null, customer: null });
    expect(shopify.getCustomer).not.toHaveBeenCalled();
  });

  it('picks the session up from the keychain and tells the basket who is ordering', async () => {
    saveSession(session('access-1', 30));
    const store = await start();
    expect(store.getState()).toMatchObject({ ready: true, session: { accessToken: 'access-1', refreshToken: 'refresh-1' }, customer: { firstName: 'Dana' } });
    expect(basket.setBuyer).toHaveBeenCalledWith('access-1');
  });

  it('stays signed in when the shop cannot be reached', async () => {
    saveSession(session('access-1', 30));
    shopify.getCustomer.mockRejectedValue(new api.CustomerError("Can't reach the shop."));
    const store = await start();
    expect(store.getState().session?.accessToken).toBe('access-1');
    expect(store.getState().customer).toBeNull();
    expect(keychain.has('session.access')).toBe(true);
  });
});

describe('keeping the session fresh', () => {
  it('renews a token that is about to run out before using it', async () => {
    saveSession(session('old', 0.5));
    shopify.refresh.mockResolvedValue(session('new', 60));
    const store = await start();
    expect(shopify.refresh).toHaveBeenCalledTimes(1);
    expect(shopify.getCustomer).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new' }));
    expect(store.getState().session?.accessToken).toBe('new');
    expect(keychain.get('session.access')).toMatchObject({ accessToken: 'new' });
    expect(basket.setBuyer).toHaveBeenLastCalledWith('new');
  });

  it('renews once and tries again when Shopify says the token has run out', async () => {
    saveSession(session('stale', 30));
    const store = await start();
    shopify.refresh.mockResolvedValue(session('new', 60));
    const read = jest
      .fn()
      .mockRejectedValueOnce(new api.CustomerError('Please sign in again.', { expired: true }))
      .mockResolvedValueOnce('orders');
    await expect(store.request(read)).resolves.toBe('orders');
    expect(read).toHaveBeenNthCalledWith(1, expect.objectContaining({ accessToken: 'stale' }));
    expect(read).toHaveBeenNthCalledWith(2, expect.objectContaining({ accessToken: 'new' }));
    expect(shopify.refresh).toHaveBeenCalledTimes(1);
  });

  it('renews only once for requests made at the same moment', async () => {
    saveSession(session('old', 30));
    const store = await start();
    // The clock moves on: the token is now about to run out.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 29.8 * 60_000);
    shopify.refresh.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { accessToken: 'new', refreshToken: 'refresh-2', idToken: 'id-1', expiresAt: Date.now() + 3600_000 };
    });
    const read = jest.fn(async (s: { accessToken: string }) => s.accessToken);
    await expect(Promise.all([store.request(read), store.request(read), store.request(read)])).resolves.toEqual(['new', 'new', 'new']);
    expect(shopify.refresh).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it('signs out when the session can no longer be renewed', async () => {
    saveSession(session('stale', 30));
    const store = await start();
    shopify.refresh.mockRejectedValue(new api.CustomerError('Please sign in again.', { expired: true }));
    const read = jest.fn().mockRejectedValue(new api.CustomerError('Please sign in again.', { expired: true }));
    await expect(store.request(read)).rejects.toThrow('Please sign in again.');
    expect(store.getState()).toMatchObject({ session: null, customer: null });
    expect(keychain.size).toBe(0);
    expect(basket.setBuyer).toHaveBeenLastCalledWith(null);
  });

  it('keeps the session when a request fails for another reason', async () => {
    saveSession(session('access-1', 30));
    const store = await start();
    const read = jest.fn().mockRejectedValue(new api.CustomerError("The shop didn't answer (500)."));
    await expect(store.request(read)).rejects.toThrow("didn't answer");
    expect(store.getState().session?.accessToken).toBe('access-1');
    expect(shopify.refresh).not.toHaveBeenCalled();
  });
});

describe('signing in and out', () => {
  it('signs in, keeps the session and reads who it is', async () => {
    shopify.signIn.mockResolvedValue(session('access-1', 60));
    const store = await start();
    await expect(store.signIn()).resolves.toBe(true);
    expect(store.getState()).toMatchObject({ busy: false, error: null, session: { accessToken: 'access-1' }, customer: { firstName: 'Dana' } });
    expect(keychain.get('session.refresh')).toBe('refresh-1');
    expect(basket.setBuyer).toHaveBeenCalledWith('access-1');
  });

  it('stays signed out when the customer closes the sign-in sheet', async () => {
    shopify.signIn.mockResolvedValue(null);
    const store = await start();
    await expect(store.signIn()).resolves.toBe(false);
    expect(store.getState()).toMatchObject({ busy: false, error: null, session: null });
  });

  it('says so when sign-in fails', async () => {
    shopify.signIn.mockRejectedValue(new api.CustomerError("We couldn't sign you in. Please try again."));
    const store = await start();
    await expect(store.signIn()).resolves.toBe(false);
    expect(store.getState()).toMatchObject({ busy: false, error: "We couldn't sign you in. Please try again.", session: null });
  });

  it('signs out: forgets the session here, then ends it at Shopify', async () => {
    saveSession(session('access-1', 30));
    const store = await start();
    await store.signOut();
    expect(store.getState()).toMatchObject({ session: null, customer: null });
    expect(keychain.size).toBe(0);
    expect(basket.setBuyer).toHaveBeenLastCalledWith(null);
    expect(shopify.signOut).toHaveBeenCalledWith(expect.objectContaining({ idToken: 'id-1' }));
  });
});
