import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useCart } from '@/state/cart';
import { colors, fonts } from '@/theme/tokens';

type IconName = keyof typeof Feather.glyphMap;

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Feather name={name} size={21} color={color as string} />;
  };

export default function TabsLayout() {
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold700,
        tabBarInactiveTintColor: colors.ink600,
        tabBarLabelStyle: { fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 0.4 },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.linen400 },
        tabBarBadgeStyle: { backgroundColor: colors.gold500, color: colors.white, fontFamily: fonts.labelBold, fontSize: 10.5 },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.white },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      <Tabs.Screen
        name="basket"
        options={{ title: 'Basket', tabBarIcon: icon('shopping-bag'), tabBarBadge: count ? (count > 99 ? '99+' : count) : undefined }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
