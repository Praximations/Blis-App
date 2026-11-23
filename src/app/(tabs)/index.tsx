// Home: the website's home page, top to bottom, for a phone.

import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ProductRail } from '@/components/ProductRail';
import { SectionHeader } from '@/components/SectionHeader';
import { ErrorState } from '@/components/States';
import { Text } from '@/components/Text';
import { config } from '@/config';
import { shopClock } from '@/delivery/days';
import { openWeb } from '@/lib/links';
import { getCollection, getProductsById, getRecommendations } from '@/shopify/catalog';
import { getSections, type Section } from '@/shopify/sections';
import { imageUrl } from '@/shopify/storefront';
import { useShelf } from '@/state/shelf';
import { logoHorizontal, sectionPhoto } from '@/theme/photos';
import { colors, fonts, gutter, maxWidth, radius, toneFor } from '@/theme/tokens';

// The terrace photos the website's hero shows, one a day.
const HERO_SCENES = ['terrace-white-balsamic.webp', 'terrace-greek-pantry.webp', 'terrace-dark-balsamic.webp'];

function heroPhoto(): string {
  const day = Math.floor(shopClock(config.timeZone, new Date()).today / 86_400_000);
  return `${config.storeUrl}/cdn/shop/files/${HERO_SCENES[day % HERO_SCENES.length]}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const shelf = useShelf();
  const [refreshing, setRefreshing] = useState(false);

  const sections = useQuery({ queryKey: ['sections'], queryFn: getSections });
  // "Recommended for you": what goes with the last product looked at, or the best sellers.
  const lastSeen = shelf.recent[0]?.handle ?? null;
  const recommended = useQuery({
    queryKey: ['home-recommended', lastSeen],
    queryFn: async () => {
      const picks = lastSeen ? await getRecommendations(lastSeen).catch(() => []) : [];
      if (picks.length >= 4) return picks;
      return (await getCollection({ handle: 'all', sort: 'best-selling', first: 10 }))?.products.nodes ?? [];
    },
    enabled: shelf.ready,
  });
  // What was looked at lately, apart from the last one (it is the page just left).
  const viewedIds = shelf.recent.slice(0, 10).map((v) => v.id);
  const viewed = useQuery({
    queryKey: ['home-viewed', viewedIds.join(',')],
    queryFn: () => getProductsById(viewedIds),
    enabled: shelf.ready && viewedIds.length >= 2,
    placeholderData: (previous) => previous,
  });
  const meats = useQuery({
    queryKey: ['home-meats'],
    queryFn: async () => (await getCollection({ handle: 'meats-seafood', first: 10 }))?.products.nodes ?? [],
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([sections.refetch(), recommended.refetch(), meats.refetch()]);
    setRefreshing(false);
  }, [sections, recommended, meats]);

  const open = sections.data?.filter((s) => !s.empty) ?? [];
  const soon = sections.data?.filter((s) => s.empty) ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold500} />}
      showsVerticalScrollIndicator={false}>
      <View style={styles.column}>
        <Image source={logoHorizontal} alt="Blis Farms" contentFit="contain" style={styles.logo} />

        <View style={styles.hero}>
          <Image source={{ uri: imageUrl(heroPhoto(), 1200) }} alt="" contentFit="cover" transition={250} style={styles.heroPhoto} />
          <Text variant="display" accessibilityRole="header">
            Food with a story
          </Text>
          <Text variant="lede">
            Discover the stories of our food, created by farmers, artisans and nutritionists. Eat better, live better.
            Your sourcing of healthier food begins here.
          </Text>
          <Button label="Discover our range of foods" variant="outline" onPress={() => router.navigate('/shop')} />
        </View>

        <View style={styles.block}>
          <SectionHeader
            eyebrow="Shop by category"
            title="From our farms to your table"
            action="View all"
            onAction={() => router.navigate('/shop')}
          />
          {sections.isError ? (
            <ErrorState onRetry={() => void sections.refetch()} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
              {(sections.data ? open : PLACEHOLDERS).map((section) => (
                <CategoryTile key={section.handle} section={section} />
              ))}
            </ScrollView>
          )}
          {soon.length ? (
            <Text variant="hint" style={styles.soon}>
              Coming soon: {soon.map((s) => s.title).join(', ')}
            </Text>
          ) : null}
        </View>

        {recommended.data?.length ? (
          <View style={styles.block}>
            <SectionHeader title="Recommended for you" />
            <ProductRail products={recommended.data} />
          </View>
        ) : null}

        {viewedIds.length >= 2 && viewed.data?.length ? (
          <View style={styles.block}>
            <SectionHeader title="Recently viewed" />
            <ProductRail products={viewed.data} />
          </View>
        ) : null}

        <View style={[styles.story, { backgroundColor: toneFor('olive-oil').paper }]}>
          <Text variant="eyebrow" color={toneFor('olive-oil').deep}>
            Our olive oil
          </Text>
          <Text variant="heading">Exceptional in every way.</Text>
          <Text>
            Exquisitely fresh 2026 Harvest Olive Oil, 100% sourced from the Greek Achaia Peloponnese is now in stock.
          </Text>
          <View style={styles.storyActions}>
            <Button
              label="Shop olive oil"
              size="sm"
              onPress={() => router.push({ pathname: '/collections/[handle]', params: { handle: 'olive-oil' } })}
            />
            <Button label="Learn more about TruOlive" size="sm" variant="ghost" onPress={() => void openWeb('/pages/olive-oil')} />
          </View>
        </View>

        {meats.data?.length ? (
          <View style={styles.block}>
            <SectionHeader
              eyebrow="Ranch-direct beef"
              title="Exceptional cuts from farms we know."
              action="Browse"
              onAction={() => router.push({ pathname: '/collections/[handle]', params: { handle: 'meats-seafood' } })}
            />
            <Text style={styles.blockText}>
              Grass-fed Angus from two Florida ranches, citrus-fed Wagyu from Queensland and Creekstone Prime Black
              Angus, each cut to order.
            </Text>
            <ProductRail products={meats.data} />
          </View>
        ) : null}

        <View style={styles.nurtures}>
          <Text variant="heading" accessibilityRole="header">
            Food that nurtures
          </Text>
          <Text>
            Our focus is to bring real flavors and nutrients back into your life, so you can feel good about what you
            eat. Our mission is to change the food and farm industry one farm and one product at a time.
          </Text>
          <Text>
            Our co-op of farms and artisans in Greece and Florida is growing every day, making it easier for people to
            have access to better food.
          </Text>
          <View style={styles.storyActions}>
            <Button label="Our roots" size="sm" variant="outline" onPress={() => void openWeb('/pages/about')} />
            <Button label="Delivery & pickup" size="sm" variant="ghost" onPress={() => router.push('/delivery')} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Tiles to hold the row's place while the sections load.
const PLACEHOLDERS: Section[] = ['bakery', 'olive-oil-vinegar', 'meats-seafood', 'dairy-eggs', 'pantry'].map((handle) => ({
  handle,
  title: '',
  description: '',
  image: null,
  empty: false,
  categories: [],
}));

function CategoryTile({ section }: { section: Section }) {
  const tone = toneFor(section.handle);
  const photo = sectionPhoto(section.handle);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/collections/[handle]', params: { handle: section.handle } })}
      disabled={!section.title}
      accessibilityRole="link"
      accessibilityLabel={section.title}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}>
      <View style={[styles.arch, { backgroundColor: tone.paper }]}>
        {photo || section.image ? (
          <Image
            source={photo ?? { uri: imageUrl(section.image?.url, 400) }}
            alt=""
            contentFit="cover"
            transition={200}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {section.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 40 },
  column: { width: '100%', maxWidth, alignSelf: 'center', gap: 38 },
  logo: { height: 40, width: 130, alignSelf: 'center' },
  hero: { paddingHorizontal: gutter, gap: 14, marginTop: -22 },
  heroPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.xl, backgroundColor: colors.linen200, marginBottom: 6 },
  block: {},
  blockText: { paddingHorizontal: gutter, marginTop: -4, marginBottom: 16 },
  tiles: { paddingHorizontal: gutter, gap: 12 },
  tile: { width: 122, gap: 8 },
  pressed: { opacity: 0.8 },
  // The website's arched tiles: round at the top, square at the foot.
  arch: {
    height: 156,
    borderTopLeftRadius: 61,
    borderTopRightRadius: 61,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    overflow: 'hidden',
  },
  tileName: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 20, color: colors.ink900, textAlign: 'center' },
  soon: { paddingHorizontal: gutter, marginTop: 14 },
  story: { marginHorizontal: gutter, borderRadius: radius.xl, padding: 22, gap: 10 },
  storyActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  nurtures: { paddingHorizontal: gutter, gap: 12 },
});
