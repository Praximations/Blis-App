#!/usr/bin/env node
// "Is the app set up?" Asks the shop the same things the app asks it and
// says, in plain words, what is on, what is missing and what to do next.
//
//   npm run doctor
//
// It only reads. Values come from the environment, then .env.local, then .env.

import { checkShop, checkToken, discoverSignIn, looksLikeClientId, readSettings, request, storefront } from './lib/shop.mjs';

const settings = readSettings();
const { domain, store, token, clientId, shopId, proxyPath } = settings;

const results = [];
const say = (mark, title, detail = '', todo = '') => results.push({ mark, title, detail, todo });
const ok = (title, detail) => say('ok', title, detail);
const warn = (title, detail, todo) => say('warn', title, detail, todo);
const fail = (title, detail, todo) => say('fail', title, detail, todo);

// ─── 1. The shop ────────────────────────────────────────────────────────────

const shop = await checkShop(settings);
if (shop.problem) {
  fail('The shop', shop.problem, 'Check EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN and EXPO_PUBLIC_SHOPIFY_API_VERSION, and your connection.');
} else {
  ok('The shop', `${shop.name} at ${domain}: ${shop.products} products, ${shop.forSale} for sale.`);
}
const reachable = !shop.problem;

// ─── 2. The Storefront token ────────────────────────────────────────────────

let tokenWorks = false;
if (!reachable) {
  // Nothing more can be said about the token.
} else if (!token) {
  warn(
    'Storefront token',
    "Not set. The app can't tell which products are \"Local delivery only\", so a basket of fresh food would reach checkout without a delivery day.",
    'Needed before release. The quickest way: npm run setup',
  );
} else {
  const check = await checkToken(settings, token);
  if (check.state === 'ok') {
    tokenWorks = true;
    ok('Storefront token', check.detail);
  } else if (check.state === 'refused') {
    fail('Storefront token', check.detail, 'Copy the public access token again from Sales channels > Headless > your storefront > Storefront API (npm run setup checks it as you paste).');
  } else if (check.state === 'no-metafields') {
    fail('Storefront token', check.detail, "In the Headless storefront's Storefront API permissions, allow product listings and metafields.");
  } else if (check.state === 'no-products') {
    tokenWorks = true;
    warn('Storefront token', check.detail, 'Publish the products to the Headless storefront: Products > select all > Include in sales channels.');
  } else {
    tokenWorks = true;
    warn('Storefront token', check.detail, 'If fresh products should be: check they are published to the Headless storefront and that custom.local_delivery_only has Storefront access.');
  }
}

// ─── 3. Delivery: the rules and the Blis Delivery app ───────────────────────

if (reachable) {
  let published = null;
  if (tokenWorks) {
    const rules = await storefront(settings, '{ shop { metafield(namespace: "blis_delivery", key: "rules") { value } } }');
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

if (reachable) {
  const signIn = await discoverSignIn(settings);
  if (!signIn) {
    warn('Sign-in', "The shop's sign-in address can't be read.", 'Check that the shop uses new customer accounts (Settings > Customer accounts).');
  } else if (signIn.shopId && signIn.shopId !== shopId) {
    fail('Sign-in', `EXPO_PUBLIC_SHOPIFY_SHOP_ID is ${shopId} but this shop's id is ${signIn.shopId}.`, `Set EXPO_PUBLIC_SHOPIFY_SHOP_ID=${signIn.shopId} (npm run setup does it).`);
  } else if (!clientId) {
    warn('Sign-in', 'No client id. The Account tab opens the website instead of signing in inside the app.', `npm run setup. The callback address to enter in Shopify is shop.${shopId}.app://callback`);
  } else if (!looksLikeClientId(clientId)) {
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
console.log(release ? 'Ready to build for the stores (docs/SETUP.md, part 3).' : 'Not ready for the stores yet: the Storefront token comes first (npm run setup).');
console.log('');
process.exit(failed ? 1 : 0);
