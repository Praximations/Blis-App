# Setup: Shopify, building and releasing

The app runs against the live shop without any of this. The steps below
turn on what needs the Shopify admin, then get the app onto phones.

## 1. Shopify admin

### 1a. Storefront token (needed before release)

1. Shopify admin → Sales channels → add **Headless** (free, by Shopify).
2. Create a storefront, e.g. "Blis Farms app".
3. Storefront API → copy the **public access token**.
4. Put it in `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`.
5. Open a fresh product in the app: it should say "Local delivery only". If
   it doesn't, check the storefront's API permissions include product
   listings and metafields (Shopify names the missing one in its answer:
   `unauthenticated_read_metafields`).

The token is public by design: it ships inside the app and is rate-limited
per shopper, not per shop. Never use the *private* token here.

Products to sell in the app must be published to this channel as well:
Products → select all → More actions → Add to sales channels → the Headless
storefront. (Without a token the app reads what is published to the Online
Store.)

What the token turns on, all from metafields that are already open to the
Storefront API (`custom.local_delivery_only`, `custom.accent_color`,
`custom.mood_image_1…3`): the "Local delivery only" badge and the basket's
delivery card, the tinted photo panels and the mood photos.

### 1b. Signing in (Customer Account API)

The shop uses new customer accounts (a one-time code by email).

1. In the same Headless storefront → **Customer Account API**.
2. Client type: **Public** (mobile).
3. Callback URI: `shop.95581405551.app://callback`
4. Logout URI: `shop.95581405551.app://callback`
5. Copy the **Client ID** into `EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID`.

`95581405551` is the shop's id. It appears in three places that must agree:
the callback URI above, `scheme` in `app.json`, and
`EXPO_PUBLIC_SHOPIFY_SHOP_ID`. For the web build, also add the site's
address (`https://<where it is hosted>/account`) as a callback URI and its
origin as a JavaScript origin.

Sign-in needs a build of the app (step 2): Expo Go can't register the
`shop.…app` scheme.

### 1c. The delivery rules (when the Blis Delivery app is live)

The Blis Delivery app writes its rules to the shop metafield
`blis_delivery.rules` for the website. For the app to read them too, give
that metafield a definition with Storefront access:

Settings → Custom data → Shop → Add definition → namespace and key
`blis_delivery.rules`, type JSON, **Storefront access: Read**.

Until then the app uses the rules in `src/delivery/bundled-rules.ts` (the
theme's defaults) for the ZIP check, and, once the Blis Delivery app is
installed, asks it for the open days through `/apps/blis-delivery/…` either
way. If the delivery days, cut-offs or ZIP codes change before the metafield
is readable, change `bundled-rules.ts` too.

Write these admin changes down in `Blis/shopify-setup/STORE-CHANGES.md`,
like every other change to the store.

## 2. Build it

Builds run on Expo's servers (EAS); no Mac is needed for the iPhone build.

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

Set the variables for the builds (they are public values, so plain text is
fine):

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN --value <token> --visibility plaintext
```

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID --value <client id> --visibility plaintext
```

Repeat for `preview` and `development` if you use those profiles.

A build to try on your own phones:

```bash
npx eas-cli@latest build --profile preview --platform all
```

The store builds:

```bash
npx eas-cli@latest build --profile production --platform all
```

## 3. Release it

- **Identifiers**: `com.blisfarms.app` for both stores (`app.json`). Change
  it before the first upload if you want another; it can't change after.
- **Apple**: an Apple Developer account ($99 a year), then
  `npx eas-cli@latest submit --platform ios`. App Review will want a test
  account's email (sign-in is a code by email) and will look for the
  privacy policy link (Account → Privacy Policy).
- **Google**: a Play Console account ($25 once), then
  `npx eas-cli@latest submit --platform android`.
- **Store listing**: the icon is `assets/images/icon.png`; screenshots can
  be taken from the simulator or a preview build.

Small fixes after release can go out without the stores, as over-the-air
updates (`npx eas-cli@latest update`), once `expo-updates` is added.

## 4. Before the first release, on a real phone

These can't be tried without a build and a real account, so try them once:

1. Sign in, see your orders, open one, "Order again".
2. A basket with a fresh product: ZIP check, day, checkout. Place a test
   order and check the order in the Shopify admin shows the delivery
   attributes (and, with the Blis Delivery app, that it is scheduled).
3. After paying, come back to the app: the basket is empty and says thank
   you.
4. Apple Pay / Shop Pay in the checkout sheet.
