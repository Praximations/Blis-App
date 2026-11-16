// Where the delivery rules come from, best first:
//   1. the shop metafield blis_delivery.rules, which the Blis Delivery app
//      rewrites after every change (needs a Storefront token and the
//      metafield opened to the Storefront API);
//   2. the last copy of it the phone saw;
//   3. the rules shipped in the app (bundled-rules.ts).

import { config } from '@/config';
import { keys, readJSON, writeJSON } from '@/lib/storage';
import { DELIVERY_RULES } from '@/shopify/queries';
import { storefront } from '@/shopify/storefront';
import { BUNDLED_RULES } from './bundled-rules';
import { dayIndex } from './days';
import type { Blackout, Rules, Slot } from './types';

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

/** Rules from JSON someone else wrote: only what is well formed is kept. */
export function parseRules(raw: unknown): Rules | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.slots)) return null;

  const slots: Slot[] = [];
  for (const item of r.slots) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (dayIndex(text(s.day)) === null || dayIndex(text(s.cutoffDay)) === null) continue;
    const before = s.cutoffDaysBefore;
    slots.push({
      day: text(s.day).toLowerCase(),
      type: s.type === 'pickup' ? 'pickup' : 'delivery',
      location: text(s.location),
      locationId: text(s.locationId),
      details: text(s.details),
      cutoffDay: text(s.cutoffDay).toLowerCase(),
      cutoffHour: Number(s.cutoffHour) || 0,
      cutoffMinute: Number(s.cutoffMinute) || 0,
      cutoffDaysBefore: before == null || before === '' || !Number.isFinite(Number(before)) ? null : Number(before),
      ownCutoffDay: dayIndex(text(s.ownCutoffDay)) === null ? undefined : text(s.ownCutoffDay).toLowerCase(),
      ownCutoffHour: Number(s.ownCutoffHour) || 0,
      areas: list(s.areas),
      times: list(s.times),
      windows: list(s.windows),
    });
  }
  if (!slots.length) return null;

  const zips: Record<string, string> = {};
  if (r.zips && typeof r.zips === 'object') {
    for (const [zip, area] of Object.entries(r.zips as Record<string, unknown>)) {
      if (/^\d{5}$/.test(zip) && typeof area === 'string' && area) zips[zip] = area;
    }
  }

  const blackouts: Blackout[] = [];
  if (Array.isArray(r.blackouts)) {
    for (const item of r.blackouts) {
      const b = (item ?? {}) as Record<string, unknown>;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text(b.start)) || !/^\d{4}-\d{2}-\d{2}$/.test(text(b.end))) continue;
      const method = b.method === 'DELIVERY' || b.method === 'PICKUP' || b.method === 'SHIPPING' ? b.method : null;
      blackouts.push({ start: text(b.start), end: text(b.end), method });
    }
  }

  return {
    source: text(r.source) || 'unknown',
    updatedAt: text(r.updatedAt) || undefined,
    timezone: text(r.timezone) || config.timeZone,
    slots,
    zips,
    blackouts,
    dayTagPrefix: text(r.dayTagPrefix) || 'delivery-day:',
    ownCutoffMatch: text(r.ownCutoffMatch) || undefined,
  };
}

/** The rules to start with, without waiting for the network. */
export async function cachedRules(): Promise<Rules> {
  return parseRules(await readJSON<unknown>(keys.rules)) ?? BUNDLED_RULES;
}

/** The published rules, or null when they can't be read (no token, no app, offline). */
export async function fetchPublishedRules(): Promise<Rules | null> {
  if (!config.storefrontToken) return null;
  try {
    const data = await storefront<{ shop: { metafield: { value: string } | null } }>(DELIVERY_RULES);
    const value = data.shop.metafield?.value;
    if (!value) return null;
    const rules = parseRules(JSON.parse(value));
    if (rules) await writeJSON(keys.rules, rules);
    return rules;
  } catch {
    return null;
  }
}
