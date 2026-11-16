// Opening the website: content pages (Our Roots, FAQ, policies) and the
// checkout are Shopify's and open in the phone's browser sheet.

import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { config } from '@/config';
import { colors } from '@/theme/tokens';

/** A path on the shop ("/pages/about") or a full address. */
export const shopUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${config.storeUrl}${path.startsWith('/') ? '' : '/'}${path}`);

export async function openWeb(pathOrUrl: string): Promise<void> {
  const url = shopUrl(pathOrUrl);
  if (/^(mailto:|tel:|sms:)/i.test(pathOrUrl)) {
    await Linking.openURL(pathOrUrl).catch(() => undefined);
    return;
  }
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await WebBrowser.openBrowserAsync(url, {
    controlsColor: colors.gold700,
    toolbarColor: colors.white,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => Linking.openURL(url).catch(() => undefined));
}

/**
 * Where a link on the shop leads inside the app, if anywhere:
 * /products/x → the product, /collections/x → the section.
 */
export function appRoute(pathOrUrl: string): { pathname: '/products/[handle]' | '/collections/[handle]'; params: { handle: string } } | null {
  const path = pathOrUrl.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
  const product = /^\/(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/.exec(path);
  if (product) return { pathname: '/products/[handle]', params: { handle: decodeURIComponent(product[1]) } };
  const collection = /^\/collections\/([^/]+)\/?$/.exec(path);
  if (collection) return { pathname: '/collections/[handle]', params: { handle: decodeURIComponent(collection[1]) } };
  return null;
}
