// Who is signed in. The session lives in the phone's keychain; the basket
// is told, so checkout starts signed in.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { config } from '@/config';
import { keys, readJSON, readSecret, writeJSON, writeSecret } from '@/lib/storage';
import * as api from '@/shopify/customer';
import type { Customer, Session } from '@/shopify/customer';

import type { CartStore } from './cart';

export interface AuthState {
  /** false until the saved session has been looked up. */
  ready: boolean;
  session: Session | null;
  customer: Customer | null;
  busy: boolean;
  error: string | null;
  /** Came into the app without signing in ("Look around first"). */
  guest: boolean;
  /** Who signed in on this phone last, so the page can say "Welcome back". */
  known: Known | null;
}

export interface Known {
  name: string;
  email: string;
}

type Listener = () => void;

// The keychain holds small values best, so each token gets its own entry.
const ACCESS = `${keys.session}.access`;
const REFRESH = `${keys.session}.refresh`;
const ID = `${keys.session}.id`;

export class AuthStore {
  private state: AuthState = { ready: false, session: null, customer: null, busy: false, error: null, guest: false, known: null };
  private listeners = new Set<Listener>();
  private started = false;
  private refreshing: Promise<Session> | null = null;

  constructor(private readonly cart: CartStore) {}

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<AuthState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private async save(session: Session | null) {
    await Promise.all([
      writeSecret(ACCESS, session ? { accessToken: session.accessToken, expiresAt: session.expiresAt } : null),
      writeSecret(REFRESH, session?.refreshToken ?? null),
      writeSecret(ID, session?.idToken ?? null),
    ]);
  }

  start() {
    if (this.started) return;
    this.started = true;
    void (async () => {
      const [access, refreshToken, idToken, known, guest] = await Promise.all([
        readSecret<{ accessToken: string; expiresAt: number }>(ACCESS),
        readSecret<string>(REFRESH),
        readSecret<string>(ID),
        readJSON<Known>(keys.known),
        readJSON<boolean>(keys.guest),
      ]);
      // "Came in without signing in" only still counts where that is a real choice.
      const mayBeGuest = config.signInFirst !== 'required' || !api.signInAvailable;
      const before = { known: known && typeof known.email === 'string' ? known : null, guest: guest === true && mayBeGuest };
      if (!api.signInAvailable || !access?.accessToken) {
        this.set({ ready: true, ...before });
        return;
      }
      this.set({ ready: true, ...before, session: { ...access, refreshToken: refreshToken ?? null, idToken: idToken ?? null } });
      await this.loadCustomer();
    })();
  }

  /** Runs a request as the customer, with a fresh token; forgets a session Shopify no longer accepts. */
  async request<T>(run: (session: Session) => Promise<T>): Promise<T> {
    let session = this.state.session;
    if (!session) throw new api.CustomerError('Please sign in.', { expired: true });
    try {
      if (session.expiresAt - Date.now() < 60_000) session = await this.renew(session);
      return await run(session);
    } catch (error) {
      if (!(error instanceof api.CustomerError) || !error.expired) throw error;
      // One more try with a new token, in case it only just ran out.
      try {
        session = await this.renew(session);
        return await run(session);
      } catch (again) {
        if (again instanceof api.CustomerError && again.expired) await this.forget();
        throw again;
      }
    }
  }

  private renew(session: Session): Promise<Session> {
    this.refreshing ??= api
      .refresh(session)
      .then(async (next) => {
        this.set({ session: next });
        await this.save(next);
        void this.cart.setBuyer(next.accessToken);
        return next;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  private async loadCustomer() {
    try {
      const customer = await this.request((session) => api.getCustomer(session));
      this.set({ customer });
      const email = customer.emailAddress?.emailAddress;
      if (email) {
        const known = { name: customer.firstName ?? '', email };
        this.set({ known });
        void writeJSON(keys.known, known);
      }
      const token = this.state.session?.accessToken;
      if (token) void this.cart.setBuyer(token);
    } catch {
      // Offline, or signed out by request(): the Account tab says which.
    }
  }

  /** Opens Shopify's sign-in, with the email already filled in when one was typed. */
  async signIn(email?: string): Promise<boolean> {
    if (this.state.busy) return false;
    this.set({ busy: true, error: null });
    try {
      const session = await api.signIn(email);
      if (!session) return false;
      this.set({ session });
      await this.save(session);
      await this.loadCustomer();
      return true;
    } catch (error) {
      this.set({ error: error instanceof Error ? error.message : "We couldn't sign you in. Please try again." });
      return false;
    } finally {
      this.set({ busy: false });
    }
  }

  private async forget() {
    this.set({ session: null, customer: null });
    await this.save(null);
    void this.cart.setBuyer(null);
  }

  async signOut() {
    const session = this.state.session;
    // Where signing in is a choice, signing out leaves you in the shop.
    if (config.signInFirst !== 'required') this.enterAsGuest();
    await this.forget();
    if (session) await api.signOut(session);
  }

  /**
   * Comes into the app without signing in. Remembered where that is a real
   * choice (sign-in optional, or not set up yet); where sign-in is required
   * it only lasts until the app is closed (a way in while developing).
   */
  enterAsGuest() {
    this.set({ guest: true, error: null });
    if (config.signInFirst === 'optional' || !api.signInAvailable) void writeJSON(keys.guest, true);
  }

  dismissError() {
    if (this.state.error) this.set({ error: null });
  }
}

const AuthContext = createContext<AuthStore | null>(null);

export function AuthProvider({ store, children }: { store: AuthStore; children: ReactNode }) {
  useEffect(() => {
    store.start();
  }, [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const store = useContext(AuthContext);
  if (!store) throw new Error('useAuth needs an AuthProvider above it');
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return useMemo(
    () => ({ ...state, store, signedIn: !!state.session, available: api.signInAvailable }),
    [state, store],
  );
}
