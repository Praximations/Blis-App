// The Blis Delivery app (blis-delivery-platform), reached the same way the
// website reaches it: through Shopify's app proxy on the shop's own domain.
// Shopify signs each request for the app, so nothing here needs a key. When
// the app isn't installed (or can't be reached) every call answers null and
// the basket falls back to the rules on the phone.

import { config } from '@/config';
import type { TimeWindow } from './types';

const base = `${config.storeUrl}${config.deliveryProxyPath.replace(/\/+$/, '')}`;

export interface AppPickupPlace {
  id: string;
  name: string;
  address?: string | null;
  hours?: string | null;
}

export interface AppConfig {
  methods: string[];
  /** "Wed", "Fri", "Sun" */
  days: string[];
  schedule: { day: string; method: string; cutoff: string; places: string[] }[];
  areas: string[];
  pickupLocations: AppPickupPlace[];
  requireSelection: boolean;
  showFor: 'local' | 'always';
  bookingMode?: string;
}

export interface AppDate {
  date: string;
  cutoff: string;
  cutoffLabel?: string;
  slots: TimeWindow[];
}

export interface AppAvailability {
  methods: string[];
  /** Line ids (product:variant) that can't be shipped. */
  localOnly: string[];
  delivery: {
    eligible: boolean;
    reason?: string | null;
    postalCode: string | null;
    zone: { id: string; name: string } | null;
    dates: AppDate[];
  } | null;
  pickup: { location: AppPickupPlace | null; dates: AppDate[] } | null;
  dayLimits?: { text: string }[];
  deadlines?: { DELIVERY?: { text: string }[]; PICKUP?: { text: string }[] };
}

async function request(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${base}/${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function json<T>(response: Response | null): Promise<T | null> {
  if (!response) return null;
  // Without the app Shopify answers with its own "not found" page.
  if (!(response.headers.get('content-type') ?? '').includes('json')) return null;
  return (await response.json().catch(() => null)) as T | null;
}

/** What the app offers at all; null when it isn't installed or can't be reached. */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const response = await request('config');
  if (!response?.ok) return null;
  const body = await json<Partial<AppConfig>>(response);
  if (!body || !Array.isArray(body.methods)) return null;
  return {
    methods: body.methods,
    days: Array.isArray(body.days) ? body.days : [],
    schedule: Array.isArray(body.schedule) ? body.schedule : [],
    areas: Array.isArray(body.areas) ? body.areas : [],
    pickupLocations: Array.isArray(body.pickupLocations) ? body.pickupLocations : [],
    requireSelection: body.requireSelection !== false,
    showFor: body.showFor === 'always' ? 'always' : 'local',
    bookingMode: body.bookingMode,
  };
}

/**
 * The open days (and time windows) for a ZIP code or a pickup place, for
 * this basket. With neither, the answer still says which lines can't be
 * shipped.
 */
export async function fetchAvailability(
  where: { zip?: string | null; location?: string | null },
  lines: string,
): Promise<AppAvailability | null> {
  const query = [
    where.zip ? `zip=${encodeURIComponent(where.zip)}` : '',
    where.location ? `location=${encodeURIComponent(where.location)}` : '',
    `lines=${encodeURIComponent(lines)}`,
  ]
    .filter(Boolean)
    .join('&');
  const response = await request(`availability?${query}`);
  if (!response?.ok) return null;
  const body = await json<AppAvailability>(response);
  if (!body || !Array.isArray(body.methods)) return null;
  return { ...body, localOnly: Array.isArray(body.localOnly) ? body.localOnly : [] };
}

export type HoldResult =
  | { ok: true; token: string | null }
  /**
   * full: the day (or window) filled up or closed since it was shown.
   * gone: the address or pickup place is no longer served.
   * unreachable: the app didn't answer; the order is checked when it arrives.
   */
  | { ok: false; reason: 'full' | 'gone' | 'unreachable' };

export interface HoldRequest {
  method: 'DELIVERY' | 'PICKUP';
  date: string;
  slot?: string | null;
  zip?: string | null;
  location?: string | null;
  lines: string;
  previous?: string | null;
}

/** Reserves the chosen day for 15 minutes; the order confirms it. */
export async function placeHold(hold: HoldRequest): Promise<HoldResult> {
  const body: Record<string, string> = { method: hold.method, date: hold.date, lines: hold.lines };
  if (hold.slot) body.slot = hold.slot;
  if (hold.previous) body.previous = hold.previous;
  if (hold.method === 'PICKUP' && hold.location) body.location = hold.location;
  if (hold.method === 'DELIVERY' && hold.zip) body.zip = hold.zip;
  const response = await request('hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response) return { ok: false, reason: 'unreachable' };
  if (response.ok) {
    const answer = await json<{ token?: string | null }>(response);
    return { ok: true, token: answer?.token ?? null };
  }
  return { ok: false, reason: response.status === 409 ? 'full' : response.status === 422 ? 'gone' : 'unreachable' };
}

export async function releaseHold(token: string): Promise<void> {
  await request('hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previous: token, release: '1' }),
  });
}
