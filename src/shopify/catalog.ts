// Reading the catalog: collections, products, search, pages.

import * as q from './queries';
import { storefront } from './storefront';
import type {
  CollectionPage,
  CollectionSummary,
  ContentPage,
  Image,
  MenuItem,
  Money,
  PageInfo,
  Product,
  ProductSummary,
  ShopInfo,
} from './types';

export const PAGE_SIZE = 24;

export type SortId = 'featured' | 'best-selling' | 'title-asc' | 'title-desc' | 'price-asc' | 'price-desc' | 'newest';

export const SORTS: { id: SortId; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'best-selling', label: 'Best selling' },
  { id: 'title-asc', label: 'Alphabetically, A–Z' },
  { id: 'title-desc', label: 'Alphabetically, Z–A' },
  { id: 'price-asc', label: 'Price, low to high' },
  { id: 'price-desc', label: 'Price, high to low' },
  { id: 'newest', label: 'Date, new to old' },
];

const COLLECTION_SORT: Record<SortId, { sortKey: string; reverse: boolean }> = {
  featured: { sortKey: 'COLLECTION_DEFAULT', reverse: false },
  'best-selling': { sortKey: 'BEST_SELLING', reverse: false },
  'title-asc': { sortKey: 'TITLE', reverse: false },
  'title-desc': { sortKey: 'TITLE', reverse: true },
  'price-asc': { sortKey: 'PRICE', reverse: false },
  'price-desc': { sortKey: 'PRICE', reverse: true },
  newest: { sortKey: 'CREATED', reverse: true },
};

// "All products" has no manual order and sorts by different keys.
const PRODUCT_SORT: Record<SortId, { sortKey: string; reverse: boolean }> = {
  ...COLLECTION_SORT,
  featured: { sortKey: 'BEST_SELLING', reverse: false },
  newest: { sortKey: 'CREATED_AT', reverse: true },
};

/** Collections that exist for the shop's plumbing, not for shoppers. */
const HIDDEN_COLLECTIONS = new Set(['frontpage', 'all']);

export async function getCollections(): Promise<CollectionSummary[]> {
  const data = await storefront<{ collections: { nodes: CollectionSummary[] } }>(q.COLLECTIONS, { first: 100 });
  return data.collections.nodes.filter((c) => !HIDDEN_COLLECTIONS.has(c.handle));
}

export interface CollectionRequest {
  handle: string;
  after?: string | null;
  sort?: SortId;
  /** Filter inputs as Shopify hands them out (JSON strings from Filter.values[].input). */
  filters?: string[];
  first?: number;
}

/** A page of a collection, or of everything when the handle is "all". */
export async function getCollection(request: CollectionRequest): Promise<CollectionPage | null> {
  const { handle, after = null, sort = 'featured', filters = [], first = PAGE_SIZE } = request;

  if (handle === 'all') {
    const data = await storefront<{ products: { nodes: ProductSummary[]; pageInfo: PageInfo } }>(q.ALL_PRODUCTS, {
      first,
      after,
      ...PRODUCT_SORT[sort],
    });
    return {
      id: 'all',
      handle: 'all',
      title: 'All products',
      description: '',
      image: null,
      products: { filters: [], ...data.products },
    };
  }

  const data = await storefront<{ collection: CollectionPage | null }>(q.COLLECTION, {
    handle,
    first,
    after,
    ...COLLECTION_SORT[sort],
    filters: filters.map((input) => JSON.parse(input) as unknown),
  });
  return data.collection;
}

export async function getProduct(handle: string): Promise<Product | null> {
  const data = await storefront<{ product: Product | null }>(q.PRODUCT, { handle });
  return data.product;
}

export async function getRecommendations(handle: string): Promise<ProductSummary[]> {
  const data = await storefront<{ productRecommendations: ProductSummary[] | null }>(q.RECOMMENDATIONS, { handle });
  return data.productRecommendations ?? [];
}

export async function getProductsById(ids: string[]): Promise<ProductSummary[]> {
  if (!ids.length) return [];
  const data = await storefront<{ nodes: (ProductSummary | null)[] }>(q.PRODUCTS_BY_ID, { ids: ids.slice(0, 50) });
  return data.nodes.filter((n): n is ProductSummary => !!n && 'handle' in n);
}

export interface SearchPage {
  totalCount: number;
  nodes: ProductSummary[];
  pageInfo: PageInfo;
}

export async function searchProducts(query: string, after: string | null = null): Promise<SearchPage> {
  const data = await storefront<{ search: SearchPage }>(q.SEARCH, { query, first: PAGE_SIZE, after });
  return data.search;
}

export interface Suggestions {
  queries: { text: string }[];
  collections: { id: string; handle: string; title: string }[];
  products: {
    id: string;
    handle: string;
    title: string;
    featuredImage: Image | null;
    priceRange: { minVariantPrice: Money };
  }[];
}

export async function getSuggestions(query: string, signal?: AbortSignal): Promise<Suggestions> {
  const data = await storefront<{ predictiveSearch: Suggestions | null }>(q.PREDICTIVE_SEARCH, { query }, { signal });
  return data.predictiveSearch ?? { queries: [], collections: [], products: [] };
}

export async function getShop(): Promise<ShopInfo> {
  const data = await storefront<{ shop: ShopInfo }>(q.SHOP);
  return data.shop;
}

export async function getMenu(handle: string): Promise<MenuItem[]> {
  const data = await storefront<{ menu: { items: MenuItem[] } | null }>(q.MENU, { handle });
  return data.menu?.items ?? [];
}

export async function getPage(handle: string): Promise<ContentPage | null> {
  const data = await storefront<{ page: ContentPage | null }>(q.PAGE, { handle });
  return data.page;
}
