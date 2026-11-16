// A product as the website's shop shows it: the photo on a linen panel with
// the price cut into its corner, a heart to save it and a "+" to put it in
// the basket.

import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { isLocalOnly } from '@/delivery/basket';
import { imageUrl } from '@/shopify/storefront';
import type { ProductSummary } from '@/shopify/types';
import { useCartStore } from '@/state/cart';
import { useShelf } from '@/state/shelf';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

import { tap } from './Button';
import { Price } from './Price';
import { Text } from './Text';

/** "A or B", "A, B or C" from the variants' names; '' when there is no choice. */
function sizes(product: ProductSummary): string {
  const titles = product.variants.nodes.map((v) => v.title).filter((t) => t && t !== 'Default Title');
  return titles.length === 2 ? `${titles[0]} or ${titles[1]}` : '';
}

function ProductCardInner({ product, width }: { product: ProductSummary; width: number }) {
  const cart = useCartStore();
  const shelf = useShelf();
  const [adding, setAdding] = useState<'idle' | 'adding' | 'added'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saved = shelf.favourites.some((p) => p.handle === product.handle);
  const variants = product.variants.nodes;
  const single = variants.length === 1 ? variants[0] : null;
  const soldOut = !product.availableForSale;
  // A product waiting for its price ($0, not for sale yet) shows none.
  const priced = Number(product.priceRange.maxVariantPrice.amount) > 0;
  const meta = [sizes(product), isLocalOnly(product) ? 'Local delivery only' : ''].filter(Boolean);

  const add = async () => {
    if (!single || adding !== 'idle') return;
    tap();
    setAdding('adding');
    try {
      await cart.add(single.id, 1, product.title);
      setAdding('added');
      timer.current = setTimeout(() => setAdding('idle'), 1600);
    } catch {
      setAdding('idle');
    }
  };

  return (
    <View style={[styles.card, { width }]}>
      <Link href={{ pathname: '/products/[handle]', params: { handle: product.handle } }} asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${product.title}${soldOut ? ', sold out' : ''}`}
          style={({ pressed }) => (pressed ? styles.pressed : null)}>
          <View style={styles.media}>
            {product.featuredImage ? (
              <Image
                source={{ uri: imageUrl(product.featuredImage.url, width * 2) }}
                alt={product.featuredImage.altText ?? product.title}
                contentFit="contain"
                transition={180}
                style={[styles.photo, soldOut ? styles.washed : null]}
              />
            ) : (
              <Feather name="image" size={26} color={colors.ink600} />
            )}
            {priced ? (
              <View style={styles.priceTab}>
                <Price
                  price={product.priceRange.minVariantPrice}
                  max={product.priceRange.maxVariantPrice}
                  compareAt={product.compareAtPriceRange.maxVariantPrice}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.words}>
            {product.productType ? (
              <Text variant="eyebrow" numberOfLines={1}>
                {product.productType}
              </Text>
            ) : null}
            <Text variant="cardTitle" numberOfLines={2}>
              {product.title}
            </Text>
            {meta.length ? (
              <Text style={styles.meta} numberOfLines={1}>
                {meta.join('  ·  ')}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>

      <Pressable
        onPress={() => {
          tap();
          shelf.store.toggleFavourite({
            id: product.id,
            handle: product.handle,
            title: product.title,
            productType: product.productType,
            image: product.featuredImage,
            price: product.priceRange.minVariantPrice,
          });
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: saved }}
        accessibilityLabel={saved ? `Remove ${product.title} from favourites` : `Save ${product.title} to favourites`}
        style={[styles.disc, styles.heart]}>
        <Feather name="heart" size={16} color={saved ? colors.red : colors.gold600} />
      </Pressable>

      {soldOut ? (
        <View style={styles.soldOut}>
          <Text style={styles.soldOutText}>Sold out</Text>
        </View>
      ) : single ? (
        <Pressable
          onPress={add}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.title} to basket`}
          style={[styles.disc, styles.add, adding !== 'idle' ? styles.discOn : null]}>
          {adding === 'adding' ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Feather name={adding === 'added' ? 'check' : 'plus'} size={17} color={adding === 'added' ? colors.white : colors.gold600} />
          )}
        </Pressable>
      ) : (
        // Several sizes: the product page is where one is chosen.
        <Link href={{ pathname: '/products/[handle]', params: { handle: product.handle } }} asChild>
          <Pressable hitSlop={8} accessibilityRole="link" accessibilityLabel={`Choose a size of ${product.title}`} style={styles.choose}>
            <Feather name="plus" size={17} color={colors.gold600} />
          </Pressable>
        </Link>
      )}
    </View>
  );
}

export const ProductCard = memo(ProductCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.lg,
    padding: 5,
  },
  pressed: { opacity: 0.85 },
  media: {
    aspectRatio: 6 / 5,
    borderRadius: radius.md,
    backgroundColor: colors.linen200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '70%', height: '78%' },
  washed: { opacity: 0.55 },
  priceTab: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopRightRadius: 12,
    paddingTop: 5,
    paddingRight: 12,
    paddingLeft: 8,
  },
  words: { paddingHorizontal: 7, paddingTop: 9, paddingBottom: 7, gap: 3 },
  meta: { fontFamily: fonts.text, fontSize: 12, lineHeight: 16, color: colors.textWarm, opacity: 0.85 },
  disc: {
    position: 'absolute',
    top: 13,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  discOn: { backgroundColor: colors.gold500 },
  heart: { left: 13 },
  add: { right: 13 },
  // A link's child takes one style, not a list.
  choose: {
    position: 'absolute',
    top: 13,
    right: 13,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  soldOut: {
    position: 'absolute',
    top: 15,
    right: 13,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  soldOutText: {
    fontFamily: fonts.label,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.ink900,
  },
});
