# Setting up the Blis Farms app

From nothing to the app in the App Store and Google Play. Do the parts in
order; each says how long it takes and how to tell it worked.

At any point, this tells you where you are:

```bash
npm run doctor
```

It asks the shop what the app would ask it and lists what is on, what is
missing and what to do next. It only reads.

| Part | What you get | Needs | Time |
|---|---|---|---|
| [1. Try it](#1-try-it) | The app on your own phone, against the live shop | A computer | 10 min |
| [2. Storefront token](#2-storefront-token-needed-before-release) | "Local delivery only", the delivery card, nutrition labels | Shopify admin | 10 min |
| [3. Sign-in](#3-sign-in) | Customers sign in and see their orders in the app | Shopify admin | 10 min |
| [4. Build it](#4-build-it) | An app file you can install and send to testers | Free Expo account | 30 min, mostly waiting |
| [5. Release it](#5-release-it) | The app in both stores | Apple ($99 a year) and Google ($25 once) accounts | A few days, mostly review |

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
web version and gives you a link that works on any phone. Useful for showing
people; it is the same app in a browser.

## 2. Storefront token (needed before release)

Without it the app can't tell which products can't be shipped, so a basket
of fresh food would go to checkout without a delivery day.

1. Shopify admin → **Sales channels** → add the **Headless** channel (free,
   made by Shopify). If you can't see "add", search the Shopify App Store
   for "Headless".
2. Open Headless → **Create storefront**. Name it "Blis Farms app".
3. In that storefront open **Storefront API** → copy the **public access
   token**. (Not the private one: that one must never go in an app.)
4. Make the products visible to it: **Products** → tick the box that selects
   all → **More actions** (or "…") → **Include in sales channels** → tick the
   Headless storefront.
5. In the project folder, copy the file `.env.example` to a new file called
   `.env` and put the token after
   `EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=`.
6. Check:

```bash
npm run doctor
```

It should now say something like *"Sees 78 products: 40 'Local delivery
only', 30 with a nutrition label."* If it says the token may not read
metafields, open the storefront's Storefront API permissions and allow
product listings and metafields.

The token is public by design: it is meant to ship inside an app, and
Shopify limits it per shopper. That is why `.env` can be committed with the
rest of the project (and should be, so the builds in part 4 get it).

What the token turns on in the app: the "Local delivery only" badge and the
basket's delivery card, the tinted photo panels and extra photos on product
pages, and "Nutrition and ingredients".

## 3. Sign-in

The shop uses Shopify's new customer accounts (a one-time code by email).

1. In the same Headless storefront open **Customer Account API**.
2. In its application setup choose a **Public** client (the mobile kind,
   if it asks which).
3. **Callback URI**: `shop.95581405551.app://callback`
4. **Logout URI**: `shop.95581405551.app://callback`
5. Copy the **Client ID** into `.env` after
   `EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID=`.
6. Run `npm run doctor` again; "Sign-in" should have a tick.

`95581405551` is the shop's own number. If the doctor says the shop's id is
different, it tells you the right one: put it in `.env` as
`EXPO_PUBLIC_SHOPIFY_SHOP_ID` and use it in the two addresses above.

Signing in can't be tried in Expo Go (it can't answer to the `shop.…app`
address). It works in a build, which is the next part.

For the web version (the Vercel link), also add
`https://<your link>/account` as a callback URI and `https://<your link>` as
a JavaScript origin.

### When the Blis Delivery app is live (optional)

The app starts using the Blis Delivery app by itself as soon as it is
installed on the shop: days, time windows and holds then come from it.

One thing makes that complete. The Blis Delivery app writes its rules to the
shop for the website; to let the app read them too (for the ZIP check and
the Delivery & pickup page), give them a definition with Storefront access:
**Settings** → **Custom data** → **Shop** → **Add definition** → namespace
and key `blis_delivery.rules`, type **JSON**, Storefront access **Read**.

Until then the app uses the copy in `src/delivery/bundled-rules.ts` (the
website theme's defaults). If the delivery days, order-by times or ZIP codes
change before that, change that file too.

Write the admin changes from parts 2 and 3 down in
`Blis/shopify-setup/STORE-CHANGES.md`, like every other change to the store.

## 4. Build it

Builds run on Expo's servers, so no Mac is needed for the iPhone app.
Create a free account at [expo.dev](https://expo.dev), then:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

Commit the `.env` file from parts 2 and 3 (the builds read it):

```bash
git add .env && git commit -m "App settings" && git push
```

A build to install on your own phones and send to testers:

```bash
npx eas-cli@latest build --profile preview --platform all
```

It asks a few questions the first time (let it create the signing keys) and
ends with a link and QR code to install from. For iPhones the first run asks
you to sign in with your Apple Developer account and register the test
phones.

**Try these once on a real phone before releasing.** They can only be tried
in a build, with a real account:

1. Sign in, see your orders, open one, "Order again".
2. A basket with a fresh product: ZIP check, day, checkout. Place a test
   order and check that the order in the Shopify admin shows the delivery
   details, and `_source: Blis Farms app` under Additional details.
3. After paying, come back to the app: the basket is empty and says thank
   you.
4. Apple Pay or Shop Pay in the checkout sheet.

## 5. Release it

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
  `EXPO_PUBLIC_SHOPIFY_API_VERSION` to the current one (the doctor uses the
  same value, so run it after changing).
- **Delivery days or ZIP codes change**: nothing to do once the Blis
  Delivery app's rules are readable (part 3); otherwise update
  `src/delivery/bundled-rules.ts` and release a new version.
- **Something looks wrong**: `npm run doctor` first.
