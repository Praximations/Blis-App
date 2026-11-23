// Account: sign in, your orders, favourites, and the rest of Blis (delivery
// days, the story, help and the small print).

import Feather from '@expo/vector-icons/Feather';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ProductRail } from '@/components/ProductRail';
import { Text } from '@/components/Text';
import { config } from '@/config';
import { orderDate } from '@/lib/dates';
import { openWeb } from '@/lib/links';
import { formatMoney } from '@/lib/money';
import { getProductsById } from '@/shopify/catalog';
import { boughtProductIds, getOrders, orderStatus, type Order } from '@/shopify/customer';
import { useAuth } from '@/state/auth';
import { useShelf } from '@/state/shelf';
import { logoStacked } from '@/theme/photos';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}${name ? `, ${name}` : ''}`;
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const shelf = useShelf();

  const orders = useInfiniteQuery({
    queryKey: ['orders', auth.customer?.id],
    queryFn: ({ pageParam }) => auth.store.request((session) => getOrders(session, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined),
    enabled: auth.signedIn,
  });
  const list = orders.data?.pages.flatMap((page) => page.nodes) ?? [];
  // "Buy again": what the last orders held, read fresh so prices and "sold out" are today's.
  const boughtIds = boughtProductIds(list);
  const bought = useQuery({
    queryKey: ['buy-again', boughtIds.join(',')],
    queryFn: () => getProductsById(boughtIds),
    enabled: auth.signedIn && boughtIds.length > 0,
    placeholderData: (previous) => previous,
  });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={
        auth.signedIn ? (
          <RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.gold500} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}>
      <View style={styles.column}>
        {auth.signedIn ? (
          <>
            <View style={styles.intro}>
              <Text variant="title" accessibilityRole="header">
                {greeting(auth.customer?.firstName)}
              </Text>
              {auth.customer?.emailAddress?.emailAddress ? (
                <Text variant="lede">{auth.customer.emailAddress.emailAddress}</Text>
              ) : null}
            </View>

            <View style={styles.group}>
              <Text variant="eyebrow">Orders</Text>
              {orders.isPending ? (
                <Text variant="hint">Loading your orders…</Text>
              ) : orders.isError ? (
                <View style={styles.inline}>
                  <Text variant="hint">We couldn&apos;t load your orders.</Text>
                  <Button label="Try again" size="sm" variant="ghost" onPress={() => void orders.refetch()} />
                </View>
              ) : list.length ? (
                <>
                  {list.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                  {orders.hasNextPage ? (
                    <Button
                      label="Earlier orders"
                      size="sm"
                      variant="ghost"
                      loading={orders.isFetchingNextPage}
                      onPress={() => void orders.fetchNextPage()}
                    />
                  ) : null}
                </>
              ) : (
                <View style={styles.card}>
                  <Text variant="subheading">Start your first order</Text>
                  <Text variant="bodySmall">
                    Fresh from the farm and our pantry, delivered by our own drivers. Add a few favourites or browse
                    everything.
                  </Text>
                  <Button label="Shop products" size="sm" onPress={() => router.navigate('/shop')} />
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.signIn}>
            <Image source={logoStacked} alt="Blis Farms" contentFit="contain" style={styles.logo} />
            <Text variant="title" center accessibilityRole="header">
              Your account
            </Text>
            <Text variant="lede" center>
              Sign in with your email address to see your orders and deliveries and to order your favourites again. We
              send you a one-time code, no password needed.
            </Text>
            {auth.available ? (
              <Button
                label="Sign in"
                onPress={() => void auth.store.signIn()}
                loading={auth.busy || !auth.ready}
                wide
                testID="sign-in"
              />
            ) : (
              <Button label="Sign in on the website" icon="external-link" onPress={() => void openWeb('/account')} wide />
            )}
            {auth.error ? <Text style={styles.error}>{auth.error}</Text> : null}
          </View>
        )}

        {auth.signedIn && bought.data?.length ? (
          <View style={styles.group}>
            <Text variant="eyebrow">Buy again</Text>
            <View style={styles.rail}>
              <ProductRail products={bought.data} />
            </View>
          </View>
        ) : null}

        <View style={styles.group}>
          <Text variant="eyebrow">Shopping</Text>
          <View style={styles.rows}>
            <Row icon="heart" title="Favourites" detail={shelf.favourites.length ? String(shelf.favourites.length) : ''} onPress={() => router.push('/favourites')} />
            <Row icon="truck" title="Delivery & pickup" onPress={() => router.push('/delivery')} />
            {auth.signedIn ? <Row icon="settings" title="Address and details" external onPress={() => void openWeb('/account/profile')} /> : null}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="eyebrow">Blis Farms</Text>
          <View style={styles.rows}>
            <Row icon="book-open" title="Our Roots" external onPress={() => void openWeb('/pages/about')} />
            <Row icon="map" title="Find Us" external onPress={() => void openWeb('/pages/find-us')} />
            <Row icon="help-circle" title="Help" external onPress={() => void openWeb('/pages/help')} />
            <Row icon="phone" title="Call us" detail={config.supportPhone} onPress={() => void openWeb(`tel:${config.supportPhone.replace(/[^\d+]/g, '')}`)} />
            <Row icon="mail" title="Email us" detail={config.supportEmail} onPress={() => void openWeb(`mailto:${config.supportEmail}`)} />
            <Row icon="instagram" title="Instagram" external onPress={() => void openWeb(config.instagramUrl)} />
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="eyebrow">The small print</Text>
          <View style={styles.rows}>
            <Row title="Returns Policy" external onPress={() => void openWeb('/pages/returns-policy')} />
            <Row title="Privacy Policy" external onPress={() => void openWeb('/policies/privacy-policy')} />
            <Row title="Your Privacy Choices" external onPress={() => void openWeb('/pages/data-sharing-opt-out')} />
            <Row title="Terms of Service" external onPress={() => void openWeb('/pages/terms-of-service')} />
          </View>
        </View>

        {auth.signedIn ? (
          <View style={styles.leave}>
            <Button label="Sign out" variant="outline" wide onPress={() => void auth.store.signOut()} />
            <Button label="Delete my account" variant="ghost" size="sm" onPress={() => router.push('/delete-account')} style={styles.delete} />
          </View>
        ) : null}

        <Text variant="hint" center>
          Blis Farms · Food with a story.{'\n'}Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
    </ScrollView>
  );
}

function OrderRow({ order }: { order: Order }) {
  const items = order.lineItems.nodes.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      accessibilityRole="link"
      accessibilityLabel={`Order ${order.name}, ${orderStatus(order)}`}
      style={({ pressed }) => [styles.order, pressed ? styles.pressed : null]}>
      <View style={styles.orderWords}>
        <Text style={styles.orderName}>{order.name}</Text>
        <Text variant="hint">
          {orderDate(order.processedAt)} · {items} {items === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <View style={styles.orderRight}>
        <Text variant="price">{formatMoney(order.totalPrice, { trailingZeros: true })}</Text>
        <Text variant="eyebrow">{orderStatus(order)}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.ink600} />
    </Pressable>
  );
}

function Row({
  icon,
  title,
  detail,
  external,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  detail?: string;
  /** Opens the website. */
  external?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
      accessibilityHint={external ? 'Opens the website' : undefined}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      {icon ? <Feather name={icon} size={18} color={colors.gold500} /> : null}
      <Text style={styles.rowTitle}>{title}</Text>
      {detail ? (
        <Text variant="hint" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
      <Feather name={external ? 'arrow-up-right' : 'chevron-right'} size={16} color={colors.ink600} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 36 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 26 },
  intro: { gap: 4 },
  signIn: { alignItems: 'center', gap: 14, backgroundColor: colors.fieldPaper, borderRadius: radius.xl, padding: 24 },
  logo: { width: 120, height: 136 },
  error: { fontFamily: fonts.text, fontSize: 13, color: colors.red, textAlign: 'center' },
  group: { gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { backgroundColor: colors.linen100, borderRadius: radius.lg, padding: 18, gap: 10 },
  rows: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.linen400, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.linen400,
    backgroundColor: colors.white,
  },
  rowTitle: { flex: 1, fontFamily: fonts.textMedium, fontSize: 15, color: colors.ink900 },
  pressed: { backgroundColor: colors.linen100 },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.linen400,
    backgroundColor: colors.white,
  },
  orderWords: { flex: 1, gap: 2 },
  orderName: { fontFamily: fonts.label, fontSize: 15, color: colors.ink900 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  leave: { gap: 6 },
  // The rail runs to the screen's edges; its own padding puts the first card back in line.
  rail: { marginHorizontal: -gutter },
  delete: { alignSelf: 'center' },
});
