// Checkout is Shopify's own, opened in the phone's browser sheet (Apple Pay,
// Shop Pay and saved cards work there as on the website). When the customer
// comes back, the basket tells whether the order was placed: a cart that
// was checked out no longer exists.

import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { colors } from '@/theme/tokens';

/** Opens the checkout. Resolves when the sheet closes (iOS) or has opened (Android, web). */
export async function openCheckout(checkoutUrl: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.location.assign(checkoutUrl);
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      controlsColor: colors.gold700,
      toolbarColor: colors.white,
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      // Keep the checkout page out of the browser's history on Android.
      showInRecents: false,
    });
  } catch {
    await Linking.openURL(checkoutUrl);
  }
}
