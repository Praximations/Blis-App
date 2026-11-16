// The parts of the shop (Breads & Bakery, Olive Oil & Vinegar…) and the
// categories inside them. They come from the shop's own menu
// "shop-sections", the same one the website's Our Products page follows, so
// reordering it in the Shopify admin reorders the app too.

import { getCollections, getMenu } from './catalog';
import type { CollectionSummary, Image } from './types';

export interface Category {
  handle: string;
  title: string;
  /** Nothing to buy here yet: shown as "Coming soon". */
  empty: boolean;
}

export interface Section extends Category {
  description: string;
  image: Image | null;
  categories: Category[];
}

/** Used when the shop has no "shop-sections" menu. */
const FALLBACK = ['bakery', 'olive-oil-vinegar', 'meats-seafood', 'dairy-eggs', 'pantry', 'wellness', 'prepared-foods', 'catering'];

const handleOf = (url: string | null) => /\/collections\/([^/?#]+)/.exec(url ?? '')?.[1] ?? null;

export async function getSections(): Promise<Section[]> {
  const [menu, collections] = await Promise.all([getMenu('shop-sections').catch(() => []), getCollections()]);
  const byHandle = new Map<string, CollectionSummary>(collections.map((c) => [c.handle, c]));
  const isEmpty = (handle: string) => !byHandle.get(handle)?.products?.nodes.length;

  const fromMenu: Section[] = [];
  for (const item of menu) {
    const handle = handleOf(item.url);
    if (!handle || handle === 'all') continue;
    const collection = byHandle.get(handle);
    const categories: Category[] = [];
    for (const child of item.items ?? []) {
      const childHandle = handleOf(child.url);
      if (childHandle) categories.push({ handle: childHandle, title: child.title, empty: isEmpty(childHandle) });
    }
    fromMenu.push({
      handle,
      title: item.title,
      description: collection?.description ?? '',
      image: collection?.image ?? null,
      empty: isEmpty(handle),
      categories,
    });
  }
  if (fromMenu.length) return fromMenu;

  return FALLBACK.map((handle) => byHandle.get(handle))
    .filter((c): c is CollectionSummary => !!c)
    .map((c) => ({
      handle: c.handle,
      title: c.title,
      description: c.description,
      image: c.image,
      empty: isEmpty(c.handle),
      categories: [],
    }));
}

/** The section a collection is, or belongs to. */
export function findSection(sections: Section[], handle: string): Section | null {
  return sections.find((s) => s.handle === handle || s.categories.some((c) => c.handle === handle)) ?? null;
}
