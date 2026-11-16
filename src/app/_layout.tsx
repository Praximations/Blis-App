import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond/400Regular_Italic';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond/500Medium';
import { GoogleSans_400Regular } from '@expo-google-fonts/google-sans/400Regular';
import { GoogleSans_500Medium } from '@expo-google-fonts/google-sans/500Medium';
import { GoogleSans_600SemiBold } from '@expo-google-fonts/google-sans/600SemiBold';
import { GoogleSans_700Bold } from '@expo-google-fonts/google-sans/700Bold';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Toast } from '@/components/Toast';
import { AuthProvider } from '@/state/auth';
import { CartProvider } from '@/state/cart';
import { DeliveryProvider } from '@/state/delivery';
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

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_400Regular_Italic,
    EBGaramond_500Medium,
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_600SemiBold,
    GoogleSans_700Bold,
  });
  // Without its fonts the app is still usable; never leave the splash up.
  const ready = loaded || !!failed;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider store={cartStore}>
        <DeliveryProvider store={deliveryStore}>
          <AuthProvider store={authStore}>
            <ShelfProvider store={shelfStore}>
              <ThemeProvider value={theme}>
                <View style={{ flex: 1, backgroundColor: colors.white }}>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }} />
                  <Toast />
                </View>
                <StatusBar style="dark" />
              </ThemeProvider>
            </ShelfProvider>
          </AuthProvider>
        </DeliveryProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}
