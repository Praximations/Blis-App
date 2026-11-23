# Blis Farms app

The Blis Farms shopping app for iPhone, Android and the web: an Expo (React
Native) app on Shopify's Storefront API. Start with [README.md](README.md);
store and release setup is in [docs/SETUP.md](docs/SETUP.md).

## Project rules

- **The website is the reference.** Looks (colours, type, radii) come from
  `src/theme/tokens.ts`, which copies the theme's tokens (Blis repo,
  `assets/blis-base.css`). Change a look there, not in a screen. Copy on
  screen follows the website's wording ("basket", "favourites").
- **Shopify code lives in `src/shopify/`**, delivery rules in
  `src/delivery/`, what the app remembers in `src/state/`. Screens
  (`src/app/`) and components don't call `fetch` themselves.
- **`src/delivery/days.ts` and `select.ts` are pure**: no clock, no network,
  callers pass `now`. They mirror the website's basket script
  (`assets/blis-theme.js`: shopClock, slotCutoff, upcoming, matchArea) so
  both offer the same days. A change in one belongs in the other.
- **Stores are read through their state.** Components and hooks use the
  snapshot from `useCart()` / `useDelivery()` and the pure functions in
  `src/delivery/select.ts`; they never call a method on a store object while
  rendering (the React Compiler would cache the answer). Store methods are
  for event handlers.
- **Cart attributes are a contract** with the Blis Delivery app (names and
  formats in `src/delivery/basket.ts`, read by blis-delivery-platform on
  `orders/create`). Don't rename them.
- **Nothing secret in the app.** Every `EXPO_PUBLIC_*` value ships to
  phones. The Storefront token is Shopify's public one.
- A child of `<Link asChild>` takes one style object, not an array.
- A control with an icon and words gets an `accessibilityLabel` (otherwise
  a screen reader reads the icon's glyph).
- Shopify's cart warnings are handled in one place, `CartStore.settle`
  (`src/state/cart.tsx`): empty lines out, only the remark about the lines
  the change touched, in the basket's words.
- Before committing: `npm run check` (typecheck, lint, tests). The tests in
  `tests/native/` render the real screens as an iPhone and as an Android
  phone against `fake-shop.ts`; a new screen or flow belongs there too.
- `npm run doctor` checks the setup against the shop (token, delivery
  rules, the Blis Delivery app, sign-in). Keep it in step with what the app
  reads: a new token-only field belongs in its token check.
- Route types (`.expo/types`) are written by `npx expo start`; after adding
  a screen, start it once before `npm run typecheck`.

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npx expo start              # start the dev server
npm run check               # typecheck, lint and tests
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `npx eas-cli@latest <command>`.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries. Docs: https://docs.expo.dev/versions/latest/index.md
