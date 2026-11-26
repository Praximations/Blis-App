// Shared by `npm run doctor` and `npm run setup`: reading the settings and
// asking the shop the things the app asks it. Reads only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readEnvFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/** The settings: the environment first, then .env.local, then .env. */
export function readSettings(overrides = {}) {
  const files = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
  const env = (name, fallback = '') => (overrides[name] ?? process.env[name] ?? files[name] ?? '').trim() || fallback;
  const domain = env('EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN', 'blisfarms.com').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return {
    domain,
    store: `https://${domain}`,
    version: env('EXPO_PUBLIC_SHOPIFY_API_VERSION', '2026-10'),
    token: env('EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN'),
    clientId: env('EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID'),
    /** required | optional | off; empty means required on phones, optional on the web. */
    signInFirst: env('EXPO_PUBLIC_SIGN_IN_FIRST').toLowerCase(),
    shopId: env('EXPO_PUBLIC_SHOPIFY_SHOP_ID', '95581405551'),
    proxyPath: env('EXPO_PUBLIC_DELIVERY_PROXY_PATH', '/apps/blis-delivery'),
  };
}

export async function request(url, init = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    return { ok: false, status: 0, error, headers: new Headers(), json: async () => null, text: async () => '' };
  } finally {
    clearTimeout(timer);
  }
}

export async function storefront(settings, query, token = settings.token) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers['X-Shopify-Storefront-Access-Token'] = token;
  const response = await request(`${settings.store}/api/${settings.version}/graphql.json`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const body = response.ok ? await response.json().catch(() => null) : null;
  return { status: response.status, data: body?.data ?? null, errors: body?.errors ?? [] };
}

/** Is the shop there? → { name, products, forSale } or { problem }. */
export async function checkShop(settings) {
  const shop = await storefront(settings, '{ shop { name } products(first: 250) { nodes { availableForSale } } }', '');
  if (!shop.data?.shop) {
    return { problem: shop.status ? `${settings.store} answered ${shop.status}.` : `${settings.store} can't be reached from here.` };
  }
  const products = shop.data.products.nodes;
  return { name: shop.data.shop.name, products: products.length, forSale: products.filter((p) => p.availableForSale).length };
}

/**
 * What a Storefront token can see.
 * → { state: 'refused' | 'no-metafields' | 'no-products' | 'no-local' | 'ok', detail, products, local, labels }
 */
export async function checkToken(settings, token) {
  const check = await storefront(
    settings,
    '{ products(first: 250) { nodes { local: metafield(namespace: "custom", key: "local_delivery_only") { value } label: metafield(namespace: "custom", key: "nutrition_label") { id } } } }',
    token,
  );
  const denied = check.errors.find((e) => e.extensions?.code === 'ACCESS_DENIED');
  if (!check.data && !check.errors.length) return { state: 'refused', detail: `Shopify refused it (${check.status || 'no answer'}).` };
  if (denied) return { state: 'no-metafields', detail: `It works, but may not read metafields: ${denied.message}` };
  if (check.errors.length) return { state: 'refused', detail: check.errors[0].message };
  const nodes = check.data.products.nodes;
  const local = nodes.filter((p) => p.local?.value === 'true').length;
  const labels = nodes.filter((p) => p.label).length;
  if (!nodes.length) return { state: 'no-products', detail: 'It works, but sees no products.', products: 0, local, labels };
  if (!local) return { state: 'no-local', detail: `It works and sees ${nodes.length} products, but none is marked "Local delivery only".`, products: nodes.length, local, labels };
  return { state: 'ok', detail: `Sees ${nodes.length} products: ${local} "Local delivery only", ${labels} with a nutrition label.`, products: nodes.length, local, labels };
}

/** The shop's sign-in addresses and its own number. */
export async function discoverSignIn(settings) {
  const openid = await request(`${settings.store}/.well-known/openid-configuration`);
  const discovery = openid.ok ? await openid.json().catch(() => null) : null;
  if (!discovery?.authorization_endpoint) return null;
  return {
    authorization: discovery.authorization_endpoint,
    shopId: /\/authentication\/(\d+)/.exec(discovery.issuer ?? '')?.[1] ?? null,
  };
}

export const looksLikeClientId = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^shp_[0-9a-f-]{20,}$/i.test(value);

/** Writes settings into .env, keeping whatever else is there (starting from .env.example). */
export function writeEnv(values) {
  const file = path.join(root, '.env');
  const template = path.join(root, '.env.example');
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fs.existsSync(template) ? fs.readFileSync(template, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\n*$/, '\n')}${line}\n`;
  }
  fs.writeFileSync(file, text);
  return file;
}
