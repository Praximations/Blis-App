// A product: photos, price, sizes, the delivery panel for fresh food, add
// to basket, the description and what goes with it.

import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Button, tap } from '@/components/Button';
import { Field } from '@/components/Field';
import { HtmlView } from '@/components/HtmlView';
import { NutritionSection } from '@/components/NutritionSection';
import { Price } from '@/components/Price';
import { ProductRail } from '@/components/ProductRail';
import { QuantityStepper } from '@/components/QuantityStepper';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { BasketButton, TopBar } from '@/components/TopBar';
import { hasOwnCutoff, isLocalOnly } from '@/delivery/basket';
import { sentenceList, tagWeekdays, upcoming } from '@/delivery/days';
import { useFollowing } from '@/lib/hooks';
import { useLayout } from '@/lib/layout';
import { shopUrl } from '@/lib/links';
import { getProduct, getRecommendations } from '@/shopify/catalog';
import { parseNutrition } from '@/shopify/nutrition';
import { imageUrl } from '@/shopify/storefront';
import type { Image as ShopImage, Product, Variant } from '@/shopify/types';
import { useCartStore } from '@/state/cart';
import { useDelivery } from '@/state/delivery';
import { useShelf } from '@/state/shelf';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** The website's photo panel: the product's accent colour, a third of it, over linen. */
function panelColor(accent: string | null | undefined): string {
  const from = /^#([0-9a-f]{6})$/i.exec(accent ?? '')?.[1] ?? 'd8c9ad';
  const to = 'eeece8';
  const mix = (i: number) => Math.round(parseInt(from.slice(i, i + 2), 16) * 0.34 + parseInt(to.slice(i, i + 2), 16) * 0.66);
  return `rgb(${mix(0)},${mix(2)},${mix(4)})`;
}

export default function ProductScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const product = useQuery({ queryKey: ['product', handle], queryFn: () => getProduct(handle) });
  const related = useQuery({ queryKey: ['related', handle], queryFn: () => getRecommendations(handle) });
  const shelf = useShelf();

  useEffect(() => {
    if (product.data) shelf.store.viewed(product.data.handle);
  }, [product.data, shelf.store]);

  const saved = !!product.data && shelf.favourites.some((p) => p.handle === product.data!.handle);
  const p = product.data;

  return (
    <View style={styles.screen}>
      <TopBar
        right={
          <View style={styles.barRight}>
            {p ? (
              <>
                <Pressable
                  onPress={() => {
                    tap();
                    shelf.store.toggleFavourite({
                      id: p.id,
                      handle: p.handle,
                      title: p.title,
                      productType: p.productType,
                      image: p.featuredImage,
                      price: p.priceRange.minVariantPrice,
                    });
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: saved }}
                  accessibilityLabel={saved ? 'Remove from favourites' : 'Save to favourites'}
                  style={styles.barIcon}>
                  <Feather name="heart" size={20} color={saved ? colors.red : colors.gold600} />
                </Pressable>
                <Pressable
                  onPress={() => void Share.share({ message: `${p.title} — ${p.onlineStoreUrl ?? shopUrl(`/products/${p.handle}`)}` }).catch(() => undefined)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Share this product"
                  style={styles.barIcon}>
                  <Feather name="share" size={19} color={colors.gold600} />
                </Pressable>
              </>
            ) : null}
            <BasketButton />
          </View>
        }
      />
      {product.isPending ? (
        <Loading />
      ) : product.isError ? (
        <ErrorState onRetry={() => void product.refetch()} />
      ) : !p ? (
        <EmptyState
          icon="compass"
          title="We couldn't find that"
          text="This product may no longer be in the shop."
          action="See all products"
          onAction={() => router.replace({ pathname: '/collections/[handle]', params: { handle: 'all' } })}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>
            <Details product={p} />
            {related.data?.length ? (
              <View style={styles.related}>
                <SectionHeader title="You may also like" />
                <ProductRail products={related.data.slice(0, 8)} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Details({ product }: { product: Product }) {
  const cart = useCartStore();
  const delivery = useDelivery();
  const variants = product.variants.nodes;
  const firstChoice = variants.find((v) => v.availableForSale) ?? variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries((firstChoice?.selectedOptions ?? []).map((o) => [o.name, o.value])),
  );
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const variant: Variant | undefined =
    variants.find((v) => v.selectedOptions.every((o) => selected[o.name] === o.value)) ?? firstChoice;
  // Options worth showing: more than one value ("Title: Default Title" is Shopify's placeholder).
  const options = product.options.filter((o) => o.optionValues.length > 1);

  const local = isLocalOnly(product);
  const days = tagWeekdays(product.tags, delivery.rules.dayTagPrefix);
  const canOrder = !local || delivery.choice.eligible === true || delivery.hasPickup;
  const available = !!variant?.availableForSale;

  const images = useMemo(() => {
    const list: ShopImage[] = [...product.images.nodes];
    for (const mood of [product.moodImage1, product.moodImage2, product.moodImage3]) {
      const image = mood?.reference?.image;
      if (image?.url) list.push(image);
    }
    // The chosen size's own photo first.
    const own = variant?.image?.url;
    const index = own ? list.findIndex((i) => i.url === own) : -1;
    if (index > 0) list.unshift(...list.splice(index, 1));
    return list;
  }, [product, variant?.image?.url]);

  const nutrition = useMemo(() => parseNutrition(product.nutritionLabel?.reference?.fields), [product.nutritionLabel]);

  const add = async () => {
    if (!variant || adding) return;
    setAdding(true);
    try {
      await cart.add(variant.id, quantity, product.title);
      setAdded(true);
    } catch {
      // The toast says what went wrong.
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Gallery images={images} title={product.title} tint={panelColor(product.accentColor?.value)} />

      <View style={styles.buy}>
        {product.productType ? <Text variant="eyebrow">{product.productType}</Text> : null}
        <Text variant="title" accessibilityRole="header">
          {product.title}
        </Text>
        {variant ? <Price price={variant.price} compareAt={variant.compareAtPrice} size="page" /> : null}

        {local ? <DeliveryPanel product={product} days={days} /> : null}
        {days.length ? (
          <Text variant="hint">Delivered on {sentenceList(days.map((d) => WEEKDAYS[d]))} only.</Text>
        ) : null}

        {options.map((option) => (
          <View key={option.id} style={styles.option} accessibilityRole="radiogroup" accessibilityLabel={option.name}>
            <Text variant="eyebrow" color={colors.ink600}>
              {option.name}
            </Text>
            <View style={styles.pills}>
              {option.optionValues.map((value) => {
                const on = selected[option.name] === value.name;
                // Can this value be bought with the other choices as they are?
                const match = variants.find((v) =>
                  v.selectedOptions.every((o) => (o.name === option.name ? o.value === value.name : selected[o.name] === o.value)),
                );
                const soldOut = !match?.availableForSale;
                return (
                  <Pressable
                    key={value.id}
                    onPress={() => {
                      tap();
                      setAdded(false);
                      setSelected((current) => ({ ...current, [option.name]: value.name }));
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${value.name}${soldOut ? ', sold out' : ''}`}
                    style={[styles.pill, on ? styles.pillOn : null, soldOut ? styles.pillOut : null]}>
                    <Text style={[styles.pillText, soldOut ? styles.pillTextOut : null]}>{value.name}</Text>
                    {soldOut ? <Text style={styles.pillSold}>sold out</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.addRow}>
          <QuantityStepper value={quantity} onChange={setQuantity} size="lg" />
          <Button
            label={available ? (added ? 'Add another' : 'Add to basket') : 'Sold out'}
            onPress={add}
            loading={adding}
            disabled={!available || !canOrder}
            style={styles.addButton}
            testID="add-to-basket"
          />
        </View>
        {!available ? (
          <Text variant="hint">
            {product.availableForSale ? 'The selected variant is out of stock.' : 'This product is out of stock.'}
          </Text>
        ) : !canOrder ? (
          <Text variant="hint">Enter your ZIP code or city to add this to your basket.</Text>
        ) : null}
        {added ? <Button label="View basket" variant="outline" wide onPress={() => router.navigate('/basket')} /> : null}
      </View>

      {product.descriptionHtml ? (
        <View style={styles.details}>
          <HtmlView html={product.descriptionHtml} />
        </View>
      ) : null}

      {nutrition ? (
        <View style={styles.details}>
          <NutritionSection nutrition={nutrition} />
        </View>
      ) : null}

      {product.vendor ? (
        <View style={styles.facts}>
          <View style={styles.fact}>
            <Text variant="eyebrow" color={colors.ink600}>
              Brand
            </Text>
            <Text variant="label">{product.vendor}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

function Gallery({ images, title, tint }: { images: ShopImage[]; title: string; tint: string }) {
  const { content } = useLayout();
  const [index, setIndex] = useState(0);
  const size = content - gutter * 2;

  if (!images.length) {
    return (
      <View style={[styles.panel, styles.panelAlone, { width: size, height: size, backgroundColor: tint }]}>
        <Text variant="hint">Photo coming soon</Text>
      </View>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (size + 10));
    if (next !== index) setIndex(next);
  };

  return (
    <View>
      <FlatList
        horizontal
        data={images}
        keyExtractor={(image) => image.url}
        renderItem={({ item, index: i }) => (
          <View style={[styles.panel, { width: size, height: size, backgroundColor: tint }]}>
            <Image
              source={{ uri: imageUrl(item.url, size * 2) }}
              alt={item.altText ?? `${title}, photo ${i + 1} of ${images.length}`}
              contentFit="contain"
              transition={200}
              priority={i === 0 ? 'high' : 'normal'}
              style={styles.panelPhoto}
            />
          </View>
        )}
        ItemSeparatorComponent={GalleryGap}
        snapToInterval={size + 10}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.gallery}
      />
      {images.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Photo ${index + 1} of ${images.length}`}>
          {images.map((image, i) => (
            <View key={image.url} style={[styles.dot, i === index ? styles.dotOn : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function GalleryGap() {
  return <View style={styles.galleryGap} />;
}

/** "Local delivery only": where we deliver, and when the next delivery and pickup are. */
function DeliveryPanel({ product, days }: { product: Product; days: number[] }) {
  const d = useDelivery();
  const { choice, store, rules } = d;
  const [query, setQuery] = useFollowing(choice.query);
  const [editing, setEditing] = useState(false);

  const served = choice.eligible === true && !editing;
  const mode = hasOwnCutoff(product, rules.ownCutoffMatch) ? 'own' : 'general';
  const limits = days.length ? [{ name: product.title, days }] : [];
  const now = new Date();
  const nextDelivery = served ? upcoming(rules, { area: choice.area, pickup: false, limits, mode, now, limit: 1 })[0] : null;
  const nextPickup = d.hasPickup ? upcoming(rules, { pickup: true, limits, mode, now, limit: 1 })[0] : null;

  const check = async () => {
    if (!query.trim() || d.checking) return;
    const ok = await store.check(query);
    if (ok) setEditing(false);
  };

  return (
    <View style={styles.delivery}>
      <View style={styles.deliveryHead}>
        <Feather name="truck" size={17} color={colors.gold500} />
        <Text style={styles.deliveryTitle}>{d.hasPickup ? 'Local delivery or pickup' : 'Local delivery only'}</Text>
      </View>

      {served ? (
        <View style={styles.deliveryRow}>
          <Text style={styles.deliveryText}>
            Delivering to {[choice.area, choice.zip].filter(Boolean).join(' ')}
          </Text>
          <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change the delivery address">
            <Text style={styles.deliveryLink}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text variant="hint">
            {d.hasPickup
              ? 'Check your ZIP code for home delivery, or pick up on the day below.'
              : 'Enter your ZIP code or city to add this to your basket.'}
          </Text>
          <View style={styles.deliveryForm}>
            <Field
              pill
              icon="map-pin"
              label="ZIP code or city"
              placeholder="ZIP code or city"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={check}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.deliveryField}
            />
            <Button label="Check" size="sm" onPress={check} loading={d.checking} disabled={!query.trim()} style={styles.deliveryCheck} />
          </View>
          {choice.eligible === false ? (
            <Text style={styles.deliveryError}>Home delivery is not available for {choice.query} yet.</Text>
          ) : null}
        </>
      )}

      {nextDelivery ? (
        <Text style={styles.deliveryText}>
          <Text style={styles.deliveryStrong}>Next delivery </Text>
          {nextDelivery.label} · Order by {nextDelivery.cutoffLabel}
        </Text>
      ) : served ? (
        <Text variant="hint">We don&apos;t deliver this to your area right now.</Text>
      ) : null}
      {nextPickup ? (
        <Text style={styles.deliveryText}>
          <Text style={styles.deliveryStrong}>Next pickup </Text>
          {nextPickup.label}
          {nextPickup.location ? ` at ${nextPickup.location}` : ''} · Order by {nextPickup.cutoffLabel}
        </Text>
      ) : null}
      <Pressable onPress={() => router.push('/delivery')} hitSlop={8} accessibilityRole="link">
        <Text style={styles.deliveryLink}>Delivery days and areas</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  barRight: { flexDirection: 'row', alignItems: 'center' },
  barIcon: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 14, paddingBottom: 40 },
  column: { width: '100%', maxWidth, alignSelf: 'center', gap: 22 },
  gallery: { paddingHorizontal: gutter },
  galleryGap: { width: 10 },
  panel: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  panelAlone: { alignSelf: 'center' },
  panelPhoto: { width: '82%', height: '82%' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.linen400 },
  dotOn: { width: 18, backgroundColor: colors.gold600 },
  buy: { paddingHorizontal: gutter, gap: 12 },
  option: { gap: 8, marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.linen400,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { borderColor: colors.gold700, borderWidth: 2, backgroundColor: colors.pickPaper, paddingHorizontal: 17 },
  pillOut: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  pillText: { fontFamily: fonts.label, fontSize: 15, color: colors.ink900 },
  pillTextOut: { color: colors.ink600 },
  pillSold: { fontFamily: fonts.text, fontSize: 11, fontStyle: 'italic', color: colors.ink600, marginTop: -2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  addButton: { flex: 1, minHeight: 54, alignSelf: 'stretch' },
  details: { paddingHorizontal: gutter },
  facts: { paddingHorizontal: gutter },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.linen400,
  },
  related: { marginTop: 8 },
  delivery: {
    borderWidth: 1,
    borderColor: colors.linen400,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    backgroundColor: colors.fieldPaper,
  },
  deliveryHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  deliveryTitle: { fontFamily: fonts.textMedium, fontSize: 16, color: colors.ink900 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deliveryText: { flexShrink: 1, fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19, color: colors.textWarm },
  deliveryStrong: { fontFamily: fonts.label, color: colors.ink900 },
  deliveryLink: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold700 },
  deliveryForm: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deliveryField: { flex: 1, minHeight: 44 },
  deliveryCheck: { minHeight: 44, borderRadius: radius.pill, alignSelf: 'auto' },
  deliveryError: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.red },
});
