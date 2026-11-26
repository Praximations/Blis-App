// Everything that ties the app to one Shopify store. Values come from
// EXPO_PUBLIC_* variables (see .env.example), which Expo inlines at build
// time; the defaults are the Blis Farms store. Nothing here is secret: the
// Storefront token is a public one, made to be shipped in an app.

import { Platform } from 'react-native';

const env = (value: string | undefined, fallback = '') => (value ?? '').trim() || fallback;

export type SignInFirst = 'required' | 'optional' | 'off';

/**
 * Does the app open on the sign-in page? (EXPO_PUBLIC_SIGN_IN_FIRST)
 *   required  nobody gets in without signing in or creating an account;
 *   optional  the page comes first, with "Look around first";
 *   off       the app opens on Home and sign-in waits under Account.
 * Left unset it is required on phones and optional in a browser: sign-in in
 * a browser needs the link's own addresses entered in Shopify (docs/SETUP.md),
 * and a link nobody can get past is no use to anyone.
 */
export function signInFirstFrom(value: string | undefined, web: boolean): SignInFirst {
  const asked = env(value).toLowerCase();
  if (asked === 'required' || asked === 'optional' || asked === 'off') return asked;
  return web ? 'optional' : 'required';
}

/** The storefront's domain, e.g. "blisfarms.com". */
const storeDomain = env(process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN, 'blisfarms.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

export const config = {
  storeDomain,
  storeUrl: `https://${storeDomain}`,
  /** Storefront API version (quarterly: 2026-10, 2027-01…). */
  apiVersion: env(process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION, '2026-10'),
  /**
   * Public Storefront access token. Optional: products, collections, search
   * and the cart work without one; metafields (the delivery rules the
   * delivery app publishes) need it.
   */
  storefrontToken: env(process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN),
  /**
   * Customer Account API client id (Shopify admin > Headless or Hydrogen >
   * Customer Account API). Without it the Account tab opens the website's
   * account page instead of signing in inside the app.
   */
  customerClientId: env(process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID),
  /**
   * Whether the app opens on the sign-in page (see signInFirstFrom). It only
   * applies once sign-in is set up (the client id above): the app never
   * locks people out of a shop they have no way to sign in to.
   */
  signInFirst: signInFirstFrom(process.env.EXPO_PUBLIC_SIGN_IN_FIRST, Platform.OS === 'web'),
  /** Numeric shop id: the app's sign-in callback is shop.<id>.app://callback. */
  shopId: env(process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID, '95581405551'),
  /** The delivery app's proxy path on the storefront. */
  deliveryProxyPath: env(process.env.EXPO_PUBLIC_DELIVERY_PROXY_PATH, '/apps/blis-delivery'),
  /** The shop's time zone: delivery cut-offs are in shop time, not phone time. */
  timeZone: env(process.env.EXPO_PUBLIC_SHOP_TIME_ZONE, 'America/New_York'),
  // Contact details, as on the website's Contact page.
  supportEmail: env(process.env.EXPO_PUBLIC_SUPPORT_EMAIL, 'hello@blismarket.com'),
  supportPhone: env(process.env.EXPO_PUBLIC_SUPPORT_PHONE, '(954) 399-1131'),
  instagramUrl: env(process.env.EXPO_PUBLIC_INSTAGRAM_URL, 'https://www.instagram.com/blismarket/'),
} as const;

export const storefrontEndpoint = `${config.storeUrl}/api/${config.apiVersion}/graphql.json`;
