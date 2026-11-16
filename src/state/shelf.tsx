// Things the phone remembers about a shopper: favourites (the heart on a
// product), the products looked at lately (for "Recommended for you") and
// recent searches. Kept on the phone only.

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { keys, readJSON, writeJSON } from '@/lib/storage';
import type { Image, Money } from '@/shopify/types';

/** Enough of a product to show it in a list without asking Shopify. */
export interface SavedProduct {
  id: string;
  handle: string;
  title: string;
  productType: string;
  image: Image | null;
  price: Money;
}

export interface ShelfState {
  ready: boolean;
  favourites: SavedProduct[];
  /** Handles, most recent first. */
  recent: string[];
  searches: string[];
}

type Listener = () => void;

export class ShelfStore {
  private state: ShelfState = { ready: false, favourites: [], recent: [], searches: [] };
  private listeners = new Set<Listener>();
  private started = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<ShelfState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  start() {
    if (this.started) return;
    this.started = true;
    void (async () => {
      const [favourites, recent, searches] = await Promise.all([
        readJSON<SavedProduct[]>(keys.favourites),
        readJSON<string[]>(keys.recent),
        readJSON<string[]>(keys.searches),
      ]);
      this.set({
        ready: true,
        favourites: Array.isArray(favourites) ? favourites.filter((p) => p && typeof p.handle === 'string') : [],
        recent: Array.isArray(recent) ? recent.filter((h) => typeof h === 'string') : [],
        searches: Array.isArray(searches) ? searches.filter((q) => typeof q === 'string') : [],
      });
    })();
  }

  isFavourite(handle: string) {
    return this.state.favourites.some((p) => p.handle === handle);
  }

  /** Saves or un-saves; answers whether it is now a favourite. */
  toggleFavourite(product: SavedProduct): boolean {
    const saved = this.isFavourite(product.handle);
    const favourites = saved
      ? this.state.favourites.filter((p) => p.handle !== product.handle)
      : [product, ...this.state.favourites].slice(0, 200);
    this.set({ favourites });
    void writeJSON(keys.favourites, favourites);
    return !saved;
  }

  viewed(handle: string) {
    const recent = [handle, ...this.state.recent.filter((h) => h !== handle)].slice(0, 20);
    this.set({ recent });
    void writeJSON(keys.recent, recent);
  }

  searched(query: string) {
    const q = query.trim();
    if (q.length < 2) return;
    const searches = [q, ...this.state.searches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    this.set({ searches });
    void writeJSON(keys.searches, searches);
  }

  clearSearches() {
    this.set({ searches: [] });
    void writeJSON(keys.searches, null);
  }
}

const ShelfContext = createContext<ShelfStore | null>(null);

export function ShelfProvider({ store, children }: { store: ShelfStore; children: ReactNode }) {
  useEffect(() => {
    store.start();
  }, [store]);
  return <ShelfContext.Provider value={store}>{children}</ShelfContext.Provider>;
}

export function useShelf() {
  const store = useContext(ShelfContext);
  if (!store) throw new Error('useShelf needs a ShelfProvider above it');
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return useMemo(() => ({ ...state, store }), [state, store]);
}
