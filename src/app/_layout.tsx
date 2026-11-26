import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';
import { GoogleSans_400Regular } from '@expo-google-fonts/google-sans/400Regular';
import { GoogleSans_500Medium } from '@expo-google-fonts/google-sans/500Medium';
import { GoogleSans_600SemiBold } from '@expo-google-fonts/google-sans/600SemiBold';
import { GoogleSans_700Bold } from '@expo-google-fonts/google-sans/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { ScreenError } from '@/components/ScreenError';
import { Toast } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/state/auth';
import { CartProvider } from '@/state/cart';
import { DeliveryProvider } from '@/state/delivery';
import { gateFor } from '@/state/gate';
import { ShelfProvider } from '@/state/shelf';
import { authStore, cartStore, deliveryStore, shelfStore } from '@/state/stores';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    // The shop doesn't change by the minute: what was read stays good for five.
    queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.gold500,
    background: colors.white,
    card: colors.white,
    text: colors.ink900,
    border: colors.linen400,
  },
};

/** Shown in place of a screen that failed. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ScreenError {...props} />;
}

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    EBGaramond_400Regular,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_600SemiBold,
    GoogleSans_700Bold,
  });
  // Without its fonts the app is still usable; never leave the splash up.
  // In a browser the page shows at once and the fonts follow.
  const fontsReady = loaded || !!failed || Platform.OS === 'web';

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider store={cartStore}>
        <DeliveryProvider store={deliveryStore}>
          <AuthProvider store={authStore}>
            <ShelfProvider store={shelfStore}>
              <ThemeProvider value={theme}>
                <Screens fontsReady={fontsReady} />
                <StatusBar style="dark" />
              </ThemeProvider>
            </ShelfProvider>
          </AuthProvider>
        </DeliveryProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

/**
 * The app's screens, behind the sign-in page when that comes first (see
 * state/gate.ts): the shop's screens can only be reached once the gate is
 * open. Until then every path leads to the sign-in page, which sends
 * people on itself once they are in.
 */
function Screens({ fontsReady }: { fontsReady: boolean }) {
  const auth = useAuth();
  const gate = gateFor(auth);
  // The splash stays up until it is known which of the two to show.
  const ready = fontsReady && gate !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}>
        <Stack.Protected guard={gate === 'open'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="products/[handle]" />
          <Stack.Screen name="collections/[handle]" />
          <Stack.Screen name="orders/[id]" />
          <Stack.Screen name="delivery" />
          <Stack.Screen name="favourites" />
          <Stack.Screen name="delete-account" />
        </Stack.Protected>
        <Stack.Screen name="welcome" options={{ animation: 'fade', contentStyle: { backgroundColor: colors.signInPaper } }} />
      </Stack>
      <Toast />
    </View>
  );
}
