#!/usr/bin/env node
// Guided setup: asks for the two values that come from the Shopify admin,
// checks each one against the shop as it is pasted, and writes them to .env.
//
//   npm run setup
//
// Enter skips a step; it can be run again at any time.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

import { checkShop, checkToken, discoverSignIn, looksLikeClientId, readSettings, root, writeEnv } from './lib/shop.mjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// Answers are kept as they arrive, so one typed (or pasted) while a check is
// still running isn't lost.
const answers = [];
let waiting = null;
let closed = false;
rl.on('line', (line) => {
  if (waiting) {
    const resolve = waiting;
    waiting = null;
    resolve(line.trim());
  } else {
    answers.push(line.trim());
  }
});
rl.on('close', () => {
  closed = true;
  if (waiting) waiting('');
  waiting = null;
});
/** One answer; '' when Enter is pressed or there is nobody to ask. */
const ask = (question) =>
  new Promise((resolve) => {
    if (answers.length) {
      console.log(question);
      return resolve(answers.shift());
    }
    if (closed) {
      console.log(question);
      return resolve('');
    }
    waiting = resolve;
    rl.setPrompt(question);
    rl.prompt();
  });

const say = (text = '') => console.log(text);
const tail = (value) => (value.length > 6 ? `…${value.slice(-4)}` : 'set');

const settings = readSettings();
const values = {};

say('\nBlis Farms app: setup\n');
say('Two things come from the Shopify admin. Paste each one here and it is checked');
say('against the shop straight away, then saved to .env. Enter skips a step.\n');

const shop = await checkShop(settings);
if (shop.problem) {
  say(` ✗ ${shop.problem}`);
  say('   Check your connection (and EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN in .env), then run this again.\n');
  rl.close();
  process.exit(1);
}
say(` ✓ The shop: ${shop.name} at ${settings.domain}, ${shop.products} products.\n`);

// The shop's own number decides the sign-in address.
const signIn = await discoverSignIn(settings);
const shopId = signIn?.shopId ?? settings.shopId;
if (shopId !== settings.shopId) values.EXPO_PUBLIC_SHOPIFY_SHOP_ID = shopId;

// ─── 1. The Storefront token ────────────────────────────────────────────────

say('Step 1 of 2: the Storefront token (needed before release)\n');
say('  It is how the app knows which products are "Local delivery only".');
say('  In the Shopify admin:');
say('   1. Add the Headless sales channel (free, by Shopify): https://apps.shopify.com/headless');
say('   2. Open it > Create storefront > name it "Blis Farms app".');
say('   3. Storefront API > copy the PUBLIC access token (never the private one).');
say('   4. Products > select all > Include in sales channels > tick that storefront.\n');
if (settings.token) say(`  A token is already saved (${tail(settings.token)}). Enter keeps it.\n`);

let token = settings.token;
for (;;) {
  const pasted = await ask('  Paste the public access token: ');
  const candidate = pasted || token;
  if (!candidate) {
    say('  Skipped. The app runs without it, but must not be released without it.\n');
    break;
  }
  const check = await checkToken(settings, candidate);
  if (check.state === 'refused') {
    say(`   ✗ ${check.detail} Make sure it is the public token, copied whole.\n`);
    if (!pasted) break; // the saved one is bad and nothing new was given
    continue;
  }
  token = candidate;
  values.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN = token;
  if (check.state === 'ok') {
    say(`   ✓ ${check.detail}\n`);
    break;
  }
  say(`   ! ${check.detail}`);
  if (check.state === 'no-metafields') say("     In the storefront's Storefront API permissions, allow product listings and metafields.");
  else say('     Do step 4 above: the products have to be included in the Headless storefront.');
  const again = await ask('     Press Enter to check again when that is done, or type s to carry on: ');
  say();
  if (again.toLowerCase().startsWith('s') || closed) break;
}

// ─── 2. Signing in ──────────────────────────────────────────────────────────

say('Step 2 of 2: signing in (customers see their orders in the app)\n');
say('  In the same Headless storefront:');
say('   1. Customer Account API > application setup > a Public client (mobile).');
say(`   2. Callback URI:  shop.${shopId}.app://callback`);
say(`   3. Logout URI:    shop.${shopId}.app://callback`);
say('   4. Copy the Client ID.\n');
if (settings.clientId) say(`  A client id is already saved (${tail(settings.clientId)}). Enter keeps it.\n`);

for (;;) {
  const pasted = await ask('  Paste the Client ID: ');
  if (!pasted) {
    say(settings.clientId ? '  Kept.\n' : '  Skipped. The Account tab will open the website instead.\n');
    break;
  }
  if (!looksLikeClientId(pasted)) {
    say("   ✗ That doesn't look like a client id (they look like 1a2b3c4d-1234-5678-9abc-def012345678). Try again.\n");
    continue;
  }
  values.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID = pasted;
  say('   ✓ Saved. Signing in can only be tried in a build on a phone (docs/SETUP.md, part 3).\n');
  break;
}
rl.close();

// ─── Save and report ────────────────────────────────────────────────────────

if (Object.keys(values).length) {
  const file = writeEnv(values);
  say(`Saved to ${path.relative(process.cwd(), file) || '.env'}: ${Object.keys(values).map((k) => k.replace('EXPO_PUBLIC_SHOPIFY_', '').toLowerCase()).join(', ')}.`);
  say('Every value in it is public by design, so commit it with the project: the builds read it.');
} else {
  say('Nothing new to save.');
}

say('\nWhere things stand now:');
const doctor = spawnSync(process.execPath, [path.join(root, 'scripts', 'doctor.mjs')], { stdio: 'inherit' });
process.exit(doctor.status ?? 0);
