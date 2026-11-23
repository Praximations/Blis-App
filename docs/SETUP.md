# Setting up the Blis Farms app

From nothing to the app in the App Store and Google Play. Do the parts in
order; each says what it needs and how to tell it worked.

| Part | What you get | Needs | Time |
|---|---|---|---|
| [1. Try it](#1-try-it) | The app on your own phone, against the live shop | A computer | 10 min |
| [2. Connect it to Shopify](#2-connect-it-to-shopify) | "Local delivery only" and the delivery card, nutrition labels, sign-in | Shopify admin | 20 min |
| [3. Build it](#3-build-it) | An app you can install and send to testers | Free Expo account | 30 min, mostly waiting |
| [4. Release it](#4-release-it) | The app in both stores | Apple ($99 a year) and Google ($25 once) accounts | A few days, mostly review |

Two commands do most of the work:

```bash
npm run setup
```

asks for the two values that come from the Shopify admin, checks each one
against the shop as you paste it, and saves them.

```bash
npm run doctor
```

says where things stand at any time: what is on, what is missing, what to do
next. It only reads.

## 1. Try it

You need [Node.js](https://nodejs.org) (the LTS version) on a computer, and
the free **Expo Go** app on your phone (App Store or Google Play).

In a terminal, in the folder where you want the project:

```bash
git clone https://github.com/Praximations/Blis-App.git
```

```bash
cd Blis-App
```

```bash
npm install
```

```bash
npx expo start
```

A QR code appears. Scan it with the iPhone camera, or from inside Expo Go on
Android (phone and computer on the same Wi-Fi). The app opens against the
live shop: you can browse, search, fill a basket and reach Shopify's
checkout. Nothing needs setting up for this.

To see it in a browser instead, press `w` in that terminal.

**A link anyone can open, without a computer:** import the repository at
[vercel.com/new](https://vercel.com/new). It reads `vercel.json`, builds the
web version and gives you a link that works on any phone.

## 2. Connect it to Shopify

Two things live in the Shopify admin and can't be set up from here. Have the
admin open in a browser, then run:

```bash
npm run setup
```

It walks you through both, in this order.

### The Storefront token (needed before release)

Without it the app can't tell which products can't be shipped, so a basket
of fresh food would go to checkout without a delivery day.

1. Add the **Headless** sales channel (free, made by Shopify):
   [apps.shopify.com/headless](https://apps.shopify.com/headless).
2. Open Headless → **Create storefront** → name it "Blis Farms app".
3. **Storefront API** → copy the **public access token**. (Never the private
   one: that must not go in an app.)
4. Make the products visible to it: **Products** → tick the box that selects
   all → **Include in sales channels** → tick the Headless storefront.
5. Paste the token when `npm run setup` asks.

It answers at once, e.g. *"Sees 97 products: 40 'Local delivery only', 33
with a nutrition label."* If it says the token sees no products, step 4
isn't done yet; if it says it may not read metafields, allow product
listings and metafields in the storefront's Storefront API permissions.
Press Enter there and it checks again.

### Signing in

The shop uses Shopify's new customer accounts (a one-time code by email).

1. In the same Headless storefront open **Customer Account API**.
2. In its application setup choose a **Public** client (the mobile kind, if
   it asks which).
3. **Callback URI** and **Logout URI**: the address `npm run setup` prints,
   `shop.95581405551.app://callback`.
4. Copy the **Client ID** and paste it when asked.

Signing in can't be tried in Expo Go (it can't answer to the `shop.…app`
address). It works in a build, which is the next part.

### What it saved

Both values go into a file called `.env`. Everything in it is public by
design (the token is made to ship inside an app, and Shopify limits it per
shopper), so commit it with the project: the builds in part 3 read it.

```bash
git add .env && git commit -m "App settings" && git push
```

Write the admin changes down in `Blis/shopify-setup/STORE-CHANGES.md`, like
every other change to the store.

### When the Blis Delivery app is live (nothing to do, one thing optional)

The app starts using the Blis Delivery app by itself as soon as it is
installed on the shop: days, time windows and holds then come from it.

Optional, to make that complete: the Blis Delivery app writes its rules to
the shop for the website; to let the app read them too (for the ZIP check
and the Delivery & pickup page), give them a definition with Storefront
access: **Settings** → **Custom data** → **Shop** → **Add definition** →
namespace and key `blis_delivery.rules`, type **JSON**, Storefront access
**Read**. Until then the app uses the copy in
`src/delivery/bundled-rules.ts` (the website theme's defaults); if the
delivery days, order-by times or ZIP codes change before that, change that
file too.

## 3. Build it

Builds run on Expo's servers, so no Mac is needed for the iPhone app.
Create a free account at [expo.dev](https://expo.dev), then:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

A build to install on your own phones and send to testers:

```bash
npx eas-cli@latest build --profile preview --platform all
```

It asks a few questions the first time (let it create the signing keys) and
ends with a link and QR code to install from. For iPhones the first run asks
you to sign in with your Apple Developer account and register the test
phones.

If the built app behaves as if it has no token (no "Local delivery only"
on fresh products), the build didn't read `.env`. Set the values on Expo's
side instead and build again:

```bash
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN --value <token> --visibility plaintext
```

(the same for `EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID`, and for the
`production` environment).

**Try these once on a real phone before releasing.** They can only be tried
in a build, with a real account:

1. Sign in, see your orders, open one, "Order again".
2. A basket with a fresh product: ZIP check, day, checkout. Place a test
   order and check that the order in the Shopify admin shows the delivery
   details, and `_source: Blis Farms app` under Additional details.
3. After paying, come back to the app: the basket is empty and says thank
   you.
4. Apple Pay or Shop Pay in the checkout sheet.

## 4. Release it

```bash
npx eas-cli@latest build --profile production --platform all
```

**Apple.** Join the [Apple Developer Program](https://developer.apple.com/programs/)
($99 a year), then:

```bash
npx eas-cli@latest submit --platform ios
```

In App Store Connect you fill in the listing (name, description,
screenshots from the preview build, the privacy policy link
`https://blisfarms.com/policies/privacy-policy`) and send it for review.
Three things reviewers ask of a shop app:

- **A way in.** Sign-in is a code by email, so give them a test account's
  email address and tell them the code arrives there (or arrange to forward
  it).
- **Account deletion.** It is in the app: Account → Delete my account, which
  sends you the request by email. Erase the customer in the Shopify admin
  when one arrives (Customers → the customer → More actions → Erase personal
  data). If a reviewer wants deletion without an email, the screen
  (`src/app/delete-account.tsx`) can post to a form instead.
- **Privacy answers.** The app itself collects nothing; Shopify handles
  name, email, address and payment at sign-in and checkout. Answer the
  privacy questions for those.

**Google.** Create a [Play Console](https://play.google.com/console)
account ($25 once), create the app there, then:

```bash
npx eas-cli@latest submit --platform android
```

A new personal Play account has to run a closed test with a group of
testers before it may publish to everyone; Play Console says how many and
for how long. A company account doesn't.

**The app's identifier** is `com.blisfarms.app` for both stores (in
`app.json`). Change it before the first upload if you want another; it can't
change afterwards.

## Later

- **A new version**: change `version` in `app.json`, build with the
  production profile, submit.
- **Shopify's API moves on every quarter**: once or twice a year set
  `EXPO_PUBLIC_SHOPIFY_API_VERSION` in `.env` to the current one, then run
  `npm run doctor`.
- **Delivery days or ZIP codes change**: nothing to do once the Blis
  Delivery app's rules are readable (part 2); otherwise update
  `src/delivery/bundled-rules.ts` and release a new version.
- **Something looks wrong**: `npm run doctor` first.
