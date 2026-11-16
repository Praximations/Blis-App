// One line of the basket.

import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { isLocalOnly } from '@/delivery/basket';
import { formatMoney, isMore } from '@/lib/money';
import { imageUrl } from '@/shopify/storefront';
import type { CartLine } from '@/shopify/types';
import { useCartStore } from '@/state/cart';
import { colors, fonts, radius } from '@/theme/tokens';

import { QuantityStepper } from './QuantityStepper';
import { Text } from './Text';

export function CartLineItem({ line }: { line: CartLine }) {
  const cart = useCartStore();
  const { merchandise } = line;
  const product = merchandise.product;
  const image = merchandise.image ?? product.featuredImage;
  const variant = merchandise.title && merchandise.title !== 'Default Title' ? merchandise.title : '';
  const reduced = isMore(line.cost.subtotalAmount, line.cost.totalAmount);
  // Shown properties: the ones whose name doesn't start with "_".
  const properties = line.attributes.filter((a) => a.value && !a.key.startsWith('_'));

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/products/[handle]', params: { handle: product.handle } }} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={product.title} style={styles.photoBox}>
          {image ? (
            <Image source={{ uri: imageUrl(image.url, 240) }} alt={image.altText ?? product.title} contentFit="contain" style={styles.photo} />
          ) : null}
        </Pressable>
      </Link>
      <View style={styles.words}>
        <View style={styles.head}>
          <View style={styles.names}>
            <Text style={styles.title} numberOfLines={2}>
              {product.title}
            </Text>
            {variant ? <Text variant="hint">{variant}</Text> : null}
            {isLocalOnly(product) ? <Text style={styles.badge}>Local delivery only</Text> : null}
            {properties.map((p) => (
              <Text key={p.key} variant="hint">
                {p.key}: {p.value}
              </Text>
            ))}
          </View>
          <View style={styles.prices}>
            <Text style={styles.price}>{formatMoney(line.cost.totalAmount, { trailingZeros: true })}</Text>
            {reduced ? <Text style={styles.was}>{formatMoney(line.cost.subtotalAmount, { trailingZeros: true })}</Text> : null}
          </View>
        </View>
        <View style={styles.actions}>
          <QuantityStepper
            value={line.quantity}
            label={`Quantity of ${product.title}`}
            onChange={(quantity) => void cart.setQuantity(line.id, quantity).catch(() => undefined)}
          />
          <Pressable
            onPress={() => void cart.remove(line.id).catch(() => undefined)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${product.title} from the basket`}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  photoBox: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: colors.linen100, padding: 6 },
  photo: { flex: 1 },
  words: { flex: 1, gap: 12, justifyContent: 'space-between' },
  head: { flexDirection: 'row', gap: 10 },
  names: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.label, fontSize: 15, lineHeight: 20, color: colors.ink900 },
  badge: { fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold700, marginTop: 2 },
  prices: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.textMedium, fontSize: 15, lineHeight: 20, color: colors.ink900, fontVariant: ['tabular-nums'] },
  was: { fontFamily: fonts.text, fontSize: 12.5, color: colors.ink600, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remove: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink600 },
});
