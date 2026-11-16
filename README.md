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
| Home | The website's home page: hero, sections, "Recommended for you", olive oil, beef, our story. |
| Shop | Every part of the shop, from the store's own `shop-sections` menu, with "Coming soon" for the empty ones. |
| Section (`/collections/…`) | Products two across, categories as chips, sort, "In stock". |
| Product (`/products/…`) | Photos, sizes, price, add to basket, description, "You may also like". Fresh food shows where and when we deliver. |
| Search | Suggestions while typing, results, recent searches. |
| Basket | Lines, quantities, discount code, the delivery card (Delivery / Pickup, ZIP check, day, time window), checkout. |
| Account | Sign in with a one-time code, orders, "Order again", "Follow your driver", favourites, help and policies. |
| Delivery & pickup | The week's days, order-by times, areas and ZIP codes, from the same rules the basket uses. |

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
scan the code with Expo Go on a phone. It works against the live shop as it
is, without any setup: browsing, search and the basket need no key.

Copy `.env.example` to `.env.local` to add the two things that do need the
Shopify admin (see [docs/SETUP.md](docs/SETUP.md)):

| Variable | What it turns on |
|---|---|
| `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | "Local delivery only" (the basket then asks for a delivery day), the product photo tints and mood photos, and the delivery rules the Blis Delivery app publishes. |
| `EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID` | Signing in inside the app. Without it the Account tab opens the website. |

**The Storefront token is needed before release.** Without it the app can't
tell which products can't be shipped, so a basket of fresh food would go to
checkout without a delivery day (unless the Blis Delivery app is live, which
also tells it).

## Check it

```bash
npm run check
```

That runs the typecheck, the linter and the tests (`tests/`): delivery days
and cut-offs, ZIP and town matching, the cart attributes, the delivery
choice with and without the Blis Delivery app, and the small helpers.

## How it's put together

```
src/
  app/           screens (Expo Router: a file is a screen)
    (tabs)/        Home, Shop, Search, Basket, Account
    products/      /products/<handle>     same paths as the website
    collections/   /collections/<handle>
    orders/        /orders/<id>
    delivery.tsx, favourites.tsx
  components/    product card, delivery card, buttons, fields…
  shopify/       Storefront API (catalog, cart), Customer Account API (sign-in, orders)
  delivery/      rules, days and cut-offs, the Blis Delivery app, cart attributes
  state/         the basket, the delivery choice, the session, favourites
  theme/         colours, type and radii from the website's theme
  lib/           money, HTML, links, storage
  config.ts      which store (EXPO_PUBLIC_* variables)
tests/
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
- Driver tips in the basket.
- Push notifications (delivery texts still come by SMS).
- Favourites are kept on the phone; they don't sync with the website's.
- Our Roots, Find Us, Help, the FAQ and the policies open the website.

## Fonts and pictures

EB Garamond (titles) and Google Sans (text), both openly licensed, come from
`@expo-google-fonts`. The website's Greycliff (menus and buttons) is a
commercial font and is not in the app; Google Sans stands in for it. The
logo, app icon and section photos are the theme's own (`Blis/assets`).
