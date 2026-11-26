# Blis Farms app

The Blis Farms shop as an app for iPhone and Android (and the web), built
with Expo (React Native). It is the website in your pocket: the same
products, the same basket rules for delivery and pickup, the same checkout.

- **Shopify** holds everything: products, sections, the basket, checkout,
  customers and orders. The app reads and writes through Shopify's
  Storefront API and Customer Account API. It has no server of its own.
- **The Blis Delivery app** (`blis-delivery-platform`) decides delivery days,
  time windows and capacity. The app asks it the same way the website does
  (Shopify's app proxy) and falls back to the rules on the phone when it
  can't be reached.
- **The website theme** (`Blis`) is the reference for looks and wording.

## What's in it

| Screen | What it does |
|---|---|
| Sign-in page (`/welcome`) | The first thing the app shows: "Create your free account" or, for someone who has signed in on this phone before, "Welcome back". An email address and one button; Shopify emails a 6-digit code. Nobody gets into the shop without it (see [Sign-in first](#sign-in-first)). |
| Home | The website's home page: hero, sections, "Recommended for you", "Recently viewed", olive oil, beef, our story. |
| Shop | Every part of the shop, from the store's own `shop-sections` menu, with "Coming soon" for the empty ones. |
| Section (`/collections/…`) | Products two across, categories as chips, sort, "In stock". |
| Product (`/products/…`) | Photos (tap for full screen), sizes, price, add to basket, description, "Nutrition and ingredients" (the label's Nutrition Facts panel, ingredients, allergens), "You may also like". Fresh food shows where and when we deliver. |
| Search | Suggestions while typing, results, recent searches. |
| Basket | Lines, quantities, discount code, the delivery card (Delivery / Pickup, ZIP check, day, time window), checkout. Says so when something sold out or the shop has fewer than asked for. |
| Account | Who is signed in, orders, "Order again", "Buy again", "Follow your driver", favourites, help and policies, "Delete my account". |
| Delivery & pickup | The week's days, order-by times, areas and ZIP codes, from the same rules the basket uses; directions to the pickup place. |

Checkout is Shopify's own, opened in the phone's browser sheet, so Apple
Pay, Shop Pay and saved cards work as on the website. When the customer
comes back, the app sees that the order went through and empties the basket.

## Run it

```bash
npm install
```

```bash
npx expo start
```

Then press `w` for the web, `i` for the iOS simulator or `a` for Android, or
scan the code with Expo Go on a phone. It opens on the sign-in page; while
developing, "Continue without signing in (development only)" at its foot
lets you in. Behind it the app works against the live shop as it is,
without any setup: browsing, search and the basket need no key.

**Setting it up for real** (Shopify admin, building, the app stores) is in
[docs/SETUP.md](docs/SETUP.md), step by step. Two commands do most of it:

```bash
npm run setup
```

asks for the two values from the Shopify admin, checks each against the shop
as you paste it and saves them to `.env`;

```bash
npm run doctor
```

says what is on and what is still missing, at any time. The two values:

| Variable | What it turns on |
|---|---|
| `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | "Local delivery only" (the basket then asks for a delivery day), nutrition labels, the product photo tints and mood photos, and the delivery rules the Blis Delivery app publishes. |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID` | Signing in inside the app, and with it the sign-in page that comes first. Without it the app opens on Home and the Account tab opens the website. |

**The Storefront token is needed before release.** Without it the app can't
tell which products can't be shipped, so a basket of fresh food would go to
checkout without a delivery day (unless the Blis Delivery app is live, which
also tells it).

## Sign-in first

Once the client id is set, the app opens on the sign-in page and the shop
stays closed until the customer has signed in or created an account (the
same step: an email address, then a 6-digit code from Shopify). After that
the app opens straight on Home; signing out leads back to the page, which
then says "Welcome back" with the email address filled in.

One setting, `EXPO_PUBLIC_SIGN_IN_FIRST` in `.env`, decides how firm that is:

| Value | What happens |
|---|---|
| `required` | Nobody gets in without signing in or creating an account. |
| `optional` | The page still comes first, with a "Look around first" button. Account leads back to it; signing out leaves you in the shop. |
| `off` | The app opens on Home; "Sign in or create account" waits under Account. |
| *(empty)* | `required` on phones, `optional` on the web link (sign-in in a browser needs its own addresses in Shopify; see [docs/SETUP.md](docs/SETUP.md)). |

Two things it never does: lock customers out of a build that has no client
id (there would be no way in), and lock you out while developing (Expo Go
can't finish Shopify's sign-in, so the page there has a "Continue without
signing in (development only)" button that customers never see).

Apple sometimes turns down shop apps that demand an account before
browsing; if that happens, `optional` is the answer and needs no other
change. More in [docs/SETUP.md](docs/SETUP.md), part 4.

## Check it

```bash
npm run check
```

That runs the typecheck, the linter and the tests (`tests/`):

- **unit**: delivery days and cut-offs, ZIP and town matching, the cart
  attributes, the delivery choice with and without the Blis Delivery app,
  the basket (sold out, short stock, order of changes), the sign-in session
  (renewal, expiry, who was here before), when the sign-in page comes first,
  nutrition labels and the small helpers;
- **iphone** and **android** (`tests/native/`): the real screens, rendered
  as a phone renders them, against a stand-in for Shopify (`fake-shop.ts`):
  the sign-in page first, signing in and out, "Look around first", then
  from Home to a product, the basket and a delivery day. They catch what a
  browser forgives.

The web version builds with `npm run build:web` into `dist/`; `vercel.json`
lets Vercel do that from the repository for a link to share.

## How it's put together

```
src/
  app/           screens (Expo Router: a file is a screen)
    (tabs)/        Home, Shop, Search, Basket, Account
    products/      /products/<handle>     same paths as the website
    collections/   /collections/<handle>
    orders/        /orders/<id>
    welcome.tsx    the sign-in page
    delivery.tsx, favourites.tsx
  components/    product card, delivery card, buttons, fields…
  shopify/       Storefront API (catalog, cart), Customer Account API (sign-in, orders)
  delivery/      rules, days and cut-offs, the Blis Delivery app, cart attributes
  state/         the basket, the delivery choice, the session, favourites;
                 gate.ts decides whether the sign-in page comes first
  theme/         colours, type and radii from the website's theme
  lib/           money, HTML, links, storage
  config.ts      which store (EXPO_PUBLIC_* variables)
tests/
scripts/setup.mjs    guided setup (npm run setup)
scripts/doctor.mjs   "is it set up?" (npm run doctor)
app.json, app.config.js   name, icon, identifiers; the sign-in address from the shop id
docs/SETUP.md    Shopify admin, building and releasing
```

### Delivery, in short

1. A product is "local delivery only" when its `custom.local_delivery_only`
   metafield is true (or it is tagged `local-delivery-only`, or the Blis
   Delivery app says so). A basket with one needs a day before checkout.
2. The customer checks a ZIP code or town, or chooses Pickup, then a day.
   The days come from the Blis Delivery app when it answers
   (`/apps/blis-delivery/availability`), with time windows and a 15-minute
   hold; otherwise from the rules: the shop metafield `blis_delivery.rules`,
   the last copy the phone saw, or the copy shipped in the app
   (`src/delivery/bundled-rules.ts`, the theme's defaults).
3. The choice is written to the cart as attributes, exactly as the website
   writes them (`Delivery date`, `Delivery method`, `_blis_date`, `_blis_hold`
   …, see `src/delivery/basket.ts`). They travel with the order, where the
   Blis Delivery app reads them.

### Not in this version

- "My week" (the weekly plan), the inbox, restaurant accounts and quick
  order, and subscriptions: on the website only.
- Lab results (the store has none yet) and driver tips in the basket.
- Push notifications (delivery texts still come by SMS).
- Favourites are kept on the phone; they don't sync with the website's.
- Our Roots, Find Us, Help, the FAQ and the policies open the website.
- Stories: the shop's blogs are empty, so there is nothing to show yet.

### Good to know

- Orders placed in the app carry `_source: Blis Farms app (ios|android|web)`
  in the order's Additional details in the Shopify admin.
- If Shopify ever refuses the Storefront token (deleted in the admin, say),
  the app carries on without it rather than going dark; `npm run doctor`
  says so.
- A screen that fails shows "Something went wrong" with a way to try again,
  not a blank page.
- When a product sells out between the page and the basket, Shopify leaves
  a line of quantity 0 and keeps remarking on it. The app takes that line
  out and says, once, what happened ("Raw Milk is sold out.", "Only 3 of
  Raw Milk are available.").

## Fonts and pictures

EB Garamond (titles) and Google Sans (text), both openly licensed, come from
`@expo-google-fonts`. The website's Greycliff (menus and buttons) is a
commercial font and is not in the app; Google Sans stands in for it. The
logo, app icon and section photos are the theme's own (`Blis/assets`).
