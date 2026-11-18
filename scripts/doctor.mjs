#!/usr/bin/env node
// "Is the app set up?" Asks the shop the same things the app asks it and
// says, in plain words, what is on, what is missing and what to do next.
//
//   npm run doctor
//
// It only reads. Values come from the environment, then .env.local, then .env.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const files = { ...readEnvFile('.env'), ...readEnvFile('.env.local') };
const env = (name, fallback = '') => (process.env[name] ?? files[name] ?? '').trim() || fallback;

const domain = env('EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN', 'blisfarms.com').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const version = env('EXPO_PUBLIC_SHOPIFY_API_VERSION', '2026-10');
const token = env('EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN');
const clientId = env('EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID');
const shopId = env('EXPO_PUBLIC_SHOPIFY_SHOP_ID', '95581405551');
const proxyPath = env('EXPO_PUBLIC_DELIVERY_PROXY_PATH', '/apps/blis-delivery');
const store = `https://${domain}`;

const results = [];
const say = (mark, title, detail = '', todo = '') => results.push({ mark, title, detail, todo });
const ok = (title, detail) => say('ok', title, detail);
const warn = (title, detail, todo) => say('warn', title, detail, todo);
const fail = (title, detail, todo) => say('fail', title, detail, todo);

async function request(url, init = {}, ms = 15000) {
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

async function storefront(query, withToken = !!token) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (withToken) headers['X-Shopify-Storefront-Access-Token'] = token;
  const response = await request(`${store}/api/${version}/graphql.json`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  const body = response.ok ? await response.json().catch(() => null) : null;
  return { status: response.status, data: body?.data ?? null, errors: body?.errors ?? [] };
}

// ─── 1. The shop ────────────────────────────────────────────────────────────

const shop = await storefront('{ shop { name } products(first: 250) { nodes { availableForSale } } }', false);
if (!shop.data?.shop) {
  fail(
    'The shop',
    shop.status ? `${store} answered ${shop.status}.` : `${store} can't be reached from here.`,
    'Check EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN and EXPO_PUBLIC_SHOPIFY_API_VERSION, and your connection.',
  );
} else {
  const products = shop.data.products.nodes;
  ok('The shop', `${shop.data.shop.name} at ${domain}: ${products.length} products, ${products.filter((p) => p.availableForSale).length} for sale.`);
}

// ─── 2. The Storefront token ────────────────────────────────────────────────

let tokenWorks = false;
if (!shop.data?.shop) {
  // Nothing more can be said about the token.
} else if (!token) {
  warn(
    'Storefront token',
    "Not set. The app can't tell which products are \"Local delivery only\", so a basket of fresh food would reach checkout without a delivery day.",
    'Needed before release: docs/SETUP.md, step 1. Then put it in .env.local as EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN.',
  );
} else {
  const check = await storefront(
    '{ products(first: 250) { nodes { local: metafield(namespace: "custom", key: "local_delivery_only") { value } label: metafield(namespace: "custom", key: "nutrition_label") { id } } } }',
  );
  const denied = check.errors.find((e) => e.extensions?.code === 'ACCESS_DENIED');
  if (!check.data && !check.errors.length) {
    fail('Storefront token', `Shopify refused it (${check.status || 'no answer'}).`, 'Copy the public access token again from Sales channels > Headless > your storefront > Storefront API.');
  } else if (denied) {
    fail('Storefront token', `It works, but may not read metafields: ${denied.message}`, "In the Headless storefront's Storefront API permissions, allow product listings and metafields.");
  } else if (check.errors.length) {
    fail('Storefront token', check.errors[0].message, 'Copy the public access token again from Sales channels > Headless > your storefront > Storefront API.');
  } else {
    tokenWorks = true;
    const nodes = check.data.products.nodes;
    const local = nodes.filter((p) => p.local?.value === 'true').length;
    const labels = nodes.filter((p) => p.label).length;
    if (!nodes.length) {
      warn('Storefront token', 'It works, but sees no products.', 'Publish the products to the Headless storefront: Products > select all > Add to sales channels.');
    } else if (!local) {
      warn(
        'Storefront token',
        `It works and sees ${nodes.length} products, but none is marked "Local delivery only".`,
        'If fresh products should be: check they are published to the Headless storefront and that custom.local_delivery_only has Storefront access.',
      );
    } else {
      ok('Storefront token', `Sees ${nodes.length} products: ${local} "Local delivery only", ${labels} with a nutrition label.`);
    }
  }
}

// ─── 3. Delivery: the rules and the Blis Delivery app ───────────────────────

if (shop.data?.shop) {
  let published = null;
  if (tokenWorks) {
    const rules = await storefront('{ shop { metafield(namespace: "blis_delivery", key: "rules") { value } } }');
    try {
      published = rules.data?.shop?.metafield?.value ? JSON.parse(rules.data.shop.metafield.value) : null;
    } catch {
      published = null;
    }
  }
  if (published?.slots?.length) {
    const days = [...new Set(published.slots.map((s) => `${s.day} (${s.type})`))].join(', ');
    ok('Delivery rules', `Published by the Blis Delivery app${published.updatedAt ? ` on ${String(published.updatedAt).slice(0, 10)}` : ''}: ${days}.`);
  } else {
    warn(
      'Delivery rules',
      'Using the copy shipped in the app (src/delivery/bundled-rules.ts): Wednesday, Friday and Sunday delivery, Saturday pickup.',
      tokenWorks
        ? 'Fine until the days or ZIP codes change. To follow the Blis Delivery app automatically: docs/SETUP.md, step 3.'
        : 'Fine until the days or ZIP codes change; then change that file too.',
    );
  }

  const proxy = await request(`${store}${proxyPath}/config`, { headers: { Accept: 'application/json' } });
  const isJson = (proxy.headers.get('content-type') ?? '').includes('json');
  const config = proxy.ok && isJson ? await proxy.json().catch(() => null) : null;
  if (config?.methods) {
    ok('Blis Delivery app', `Answering: ${config.methods.join(', ')}; ${config.pickupLocations?.length ?? 0} pickup place(s). Days, time windows and holds come from it.`);
  } else {
    warn(
      'Blis Delivery app',
      `Not answering at ${proxyPath} (${proxy.status || 'no answer'}). The app works out delivery days from the rules instead; no time windows, no capacity holds.`,
      'Nothing to do in this app: it starts using the Blis Delivery app by itself once that is installed on the shop.',
    );
  }
}

// ─── 4. Signing in ──────────────────────────────────────────────────────────

if (shop.data?.shop) {
  const openid = await request(`${store}/.well-known/openid-configuration`);
  const discovery = openid.ok ? await openid.json().catch(() => null) : null;
  const realId = /\/authentication\/(\d+)/.exec(discovery?.issuer ?? '')?.[1] ?? null;
  if (!discovery?.authorization_endpoint) {
    warn('Sign-in', "The shop's sign-in address can't be read.", 'Check that the shop uses new customer accounts (Settings > Customer accounts).');
  } else if (realId && realId !== shopId) {
    fail('Sign-in', `EXPO_PUBLIC_SHOPIFY_SHOP_ID is ${shopId} but this shop's id is ${realId}.`, `Set EXPO_PUBLIC_SHOPIFY_SHOP_ID=${realId}.`);
  } else if (!clientId) {
    warn(
      'Sign-in',
      'No client id. The Account tab opens the website instead of signing in inside the app.',
      `docs/SETUP.md, step 2. The callback address to enter in Shopify is shop.${shopId}.app://callback`,
    );
  } else if (!/^[0-9a-f-]{20,}$/i.test(clientId) && !clientId.startsWith('shp_')) {
    warn('Sign-in', "The client id doesn't look like one (Shopify's are long codes of letters, digits and dashes).", 'Copy it again from the Headless storefront > Customer Account API.');
  } else {
    ok('Sign-in', `Client id set. In Shopify the callback address must be shop.${shopId}.app://callback (sign-in itself can only be tried in a build on a phone).`);
  }
}

// ─── The answer ─────────────────────────────────────────────────────────────

const marks = { ok: '✓', warn: '!', fail: '✗' };
console.log(`\nBlis Farms app: setup check for ${domain}\n`);
for (const r of results) {
  console.log(` ${marks[r.mark]} ${r.title}`);
  if (r.detail) console.log(`     ${r.detail}`);
  if (r.todo) console.log(`     → ${r.todo}`);
}
const failed = results.some((r) => r.mark === 'fail');
const release = !failed && tokenWorks;
console.log('');
console.log(failed ? 'Something above needs fixing before the app will work properly.' : 'The app will run as it is: npx expo start');
console.log(release ? 'Ready to build for the stores (docs/SETUP.md, step 4).' : 'Not ready for the stores yet: the Storefront token comes first.');
console.log('');
process.exit(failed ? 1 : 0);
