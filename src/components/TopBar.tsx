// The bar at the top of a screen that was opened from another: back, a
// title and the basket.

import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/state/cart';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

import { Text } from './Text';

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BasketButton() {
  const { count } = useCart();
  return (
    <Pressable
      onPress={() => router.navigate('/basket')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count ? `Basket, ${count} ${count === 1 ? 'item' : 'items'}` : 'Basket'}
      style={({ pressed }) => [styles.icon, pressed ? styles.pressed : null]}>
      <Feather name="shopping-bag" size={21} color={colors.gold600} />
      {count ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function TopBar({ title, right, back = true }: { title?: string; right?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.icon, pressed ? styles.pressed : null]}>
            <Feather name="chevron-left" size={25} color={colors.gold600} />
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title ?? ''}
        </Text>
        {right === undefined ? <BasketButton /> : right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.linen400 },
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: gutter - 10,
    width: '100%',
    maxWidth,
    alignSelf: 'center',
  },
  icon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.linen200 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 20, color: colors.ink900 },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.labelBold, fontSize: 10.5, lineHeight: 14, color: colors.white },
});
