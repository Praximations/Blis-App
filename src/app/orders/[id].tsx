// One order: what was in it, where it stands, and "Order again".

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { orderDate } from '@/lib/dates';
import { openWeb } from '@/lib/links';
import { formatMoney } from '@/lib/money';
import { getOrder, orderStatus } from '@/shopify/customer';
import { imageUrl } from '@/shopify/storefront';
import type { Money } from '@/shopify/types';
import { useAuth } from '@/state/auth';
import { useCartStore } from '@/state/cart';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';


export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const cart = useCartStore();
  const [again, setAgain] = useState<'idle' | 'adding' | 'failed'>('idle');

  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => auth.store.request((session) => getOrder(session, id)),
    enabled: auth.signedIn,
  });
  const order = query.data;
  const tracking = order?.metafields?.find((m) => m?.key === 'tracking_url')?.value;

  const orderAgain = async () => {
    if (!order || again === 'adding') return;
    const lines = order.lineItems.nodes
      .filter((line) => line.variantId)
      .map((line) => ({ merchandiseId: line.variantId as string, quantity: line.quantity }));
    if (!lines.length) return;
    setAgain('adding');
    try {
      await cart.addMany(lines);
      router.navigate('/basket');
      setAgain('idle');
    } catch {
      // Something in the order is no longer sold: say so rather than half-fill the basket silently.
      setAgain('failed');
    }
  };

  return (
    <View style={styles.screen}>
      <TopBar title={order?.name ?? 'Order'} />
      {!auth.signedIn ? (
        <EmptyState icon="user" title="Sign in to see your orders" action="Account" onAction={() => router.navigate('/account')} />
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !order ? (
        <EmptyState icon="compass" title="We couldn't find that order" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.column}>
            <View style={styles.intro}>
              <Text variant="eyebrow">{orderStatus(order)}</Text>
              <Text variant="title" accessibilityRole="header">
                Order {order.name}
              </Text>
              <Text variant="lede">Placed {orderDate(order.processedAt)}</Text>
            </View>

            <View style={styles.actions}>
              {tracking ? <Button label="Follow your driver" icon="navigation" wide onPress={() => void openWeb(tracking)} /> : null}
              <Button label="View order status" variant={tracking ? 'outline' : 'solid'} wide onPress={() => void openWeb(order.statusPageUrl)} />
              <Button label="Order again" variant="outline" wide loading={again === 'adding'} onPress={orderAgain} />
              {again === 'failed' ? (
                <Text style={styles.error}>Some of these are no longer in the shop, so nothing was added. Add what you&apos;d like from the Shop tab.</Text>
              ) : null}
            </View>

            <View style={styles.lines}>
              {order.lineItems.nodes.map((line) => (
                <View key={line.id} style={styles.line}>
                  <View style={styles.photoBox}>
                    {line.image ? <Image source={{ uri: imageUrl(line.image.url, 160) }} alt="" contentFit="contain" style={styles.photo} /> : null}
                  </View>
                  <View style={styles.lineWords}>
                    <Text style={styles.lineTitle} numberOfLines={2}>
                      {line.title || line.name}
                    </Text>
                    <Text variant="hint">
                      {[line.variantTitle && line.variantTitle !== 'Default Title' ? line.variantTitle : '', `Qty ${line.quantity}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.linePrice}>{formatMoney(line.totalPrice, { trailingZeros: true })}</Text>
                </View>
              ))}
            </View>

            <View style={styles.totals}>
              <Total label="Subtotal" amount={order.subtotal} />
              <Total label="Delivery" amount={order.totalShipping} />
              <Total label="Tax" amount={order.totalTax} />
              <Total label="Total" amount={order.totalPrice} strong />
            </View>

            {order.shippingAddress?.formatted.length ? (
              <View style={styles.address}>
                <Text variant="eyebrow">Delivery address</Text>
                <Text>{order.shippingAddress.formatted.join('\n')}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Total({ label, amount, strong }: { label: string; amount?: Money | null; strong?: boolean }) {
  if (!amount) return null;
  return (
    <View style={styles.total}>
      <Text style={strong ? styles.totalStrong : styles.totalLabel}>{label}</Text>
      <Text style={strong ? styles.totalStrong : styles.totalLabel}>{formatMoney(amount, { trailingZeros: true })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingTop: 20, paddingBottom: 40 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 22 },
  intro: { gap: 4 },
  actions: { gap: 10 },
  error: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.red },
  lines: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.linen400 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.linen400,
  },
  photoBox: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.linen100, padding: 5 },
  photo: { flex: 1 },
  lineWords: { flex: 1, gap: 2 },
  lineTitle: { fontFamily: fonts.label, fontSize: 14.5, lineHeight: 19, color: colors.ink900 },
  linePrice: { fontFamily: fonts.textMedium, fontSize: 14.5, color: colors.ink900, fontVariant: ['tabular-nums'] },
  totals: { backgroundColor: colors.linen100, borderRadius: radius.lg, padding: 16, gap: 8 },
  total: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.text, fontSize: 14.5, color: colors.textWarm, fontVariant: ['tabular-nums'] },
  totalStrong: { fontFamily: fonts.label, fontSize: 16, color: colors.ink900, fontVariant: ['tabular-nums'] },
  address: { gap: 6 },
});
