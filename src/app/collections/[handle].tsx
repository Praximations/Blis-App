// A part of the shop: its products, two across, with a way to sort them.

import Feather from '@expo/vector-icons/Feather';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { getCollection, SORTS, type SortId } from '@/shopify/catalog';
import { findSection, getSections } from '@/shopify/sections';
import { colors, fonts, gutter, radius, toneFor } from '@/theme/tokens';

/** Shopify's own filter for "in stock". */
const IN_STOCK = JSON.stringify({ available: true });

export default function CollectionScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [sort, setSort] = useState<SortId>('featured');
  const [inStock, setInStock] = useState(false);
  const [sorting, setSorting] = useState(false);

  const sections = useQuery({ queryKey: ['sections'], queryFn: getSections });
  const section = sections.data ? findSection(sections.data, handle) : null;
  const tone = toneFor(section?.handle ?? handle);

  const page = useInfiniteQuery({
    queryKey: ['collection', handle, sort, inStock],
    queryFn: ({ pageParam }) => getCollection({ handle, after: pageParam, sort, filters: inStock ? [IN_STOCK] : [] }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last?.products.pageInfo.hasNextPage ? last.products.pageInfo.endCursor : undefined),
  });

  const first = page.data?.pages[0] ?? null;
  const products = page.data?.pages.flatMap((p) => p?.products.nodes ?? []) ?? [];
  // The name as the shop's menu has it ("Breads & Bakery"), else the collection's own.
  const menuName =
    section?.handle === handle ? section.title : section?.categories.find((c) => c.handle === handle)?.title;
  const title = menuName ?? first?.title ?? '';
  const siblings = section?.categories ?? [];

  const header = (
    <View style={styles.header}>
      <View style={[styles.intro, { backgroundColor: tone.paper }]}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {first?.description ? <Text variant="lede">{first.description}</Text> : null}
      </View>

      {siblings.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ handle: section!.handle, title: 'All' }, ...siblings].map((item) => {
            const on = item.handle === handle;
            return (
              <Pressable
                key={item.handle}
                onPress={() => (on ? undefined : router.replace({ pathname: '/collections/[handle]', params: { handle: item.handle } }))}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on ? styles.chipOn : null]}>
                <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{item.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.tools}>
        <Pressable onPress={() => setSorting(true)} accessibilityRole="button" accessibilityLabel="Sort products" style={styles.tool}>
          <Feather name="sliders" size={14} color={colors.gold700} />
          <Text style={styles.toolText}>{SORTS.find((s) => s.id === sort)?.label}</Text>
        </Pressable>
        {handle === 'all' ? null : (
          <Pressable
            onPress={() => setInStock((on) => !on)}
            accessibilityRole="switch"
            accessibilityLabel="In stock only"
            accessibilityState={{ checked: inStock }}
            style={[styles.tool, inStock ? styles.toolOn : null]}>
            <Feather name={inStock ? 'check-circle' : 'circle'} size={14} color={colors.gold700} />
            <Text style={styles.toolText}>In stock</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <TopBar />
      {page.isPending ? (
        <Loading />
      ) : page.isError ? (
        <ErrorState onRetry={() => void page.refetch()} />
      ) : !first ? (
        <EmptyState
          icon="compass"
          title="We couldn't find that"
          text="This part of the shop may have moved."
          action="See all products"
          onAction={() => router.replace({ pathname: '/collections/[handle]', params: { handle: 'all' } })}
        />
      ) : (
        <ProductGrid
          products={products}
          header={header}
          empty={
            inStock ? (
              <EmptyState icon="clock" title="Nothing in stock right now" text="Have a look at everything in this part of the shop." action="Show all" onAction={() => setInStock(false)} />
            ) : (
              <EmptyState
                icon="clock"
                title="Coming soon"
                text={`We're getting ${title} ready for the shop. In the meantime, have a look around the rest of it.`}
                action="See all products"
                onAction={() => router.replace({ pathname: '/collections/[handle]', params: { handle: 'all' } })}
              />
            )
          }
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage();
          }}
          loadingMore={page.isFetchingNextPage}
          refreshing={page.isRefetching && !page.isFetchingNextPage}
          onRefresh={() => void page.refetch()}
        />
      )}

      <Modal visible={sorting} transparent animationType="fade" onRequestClose={() => setSorting(false)}>
        <Pressable style={styles.scrim} onPress={() => setSorting(false)} accessibilityLabel="Close">
          <View style={styles.sheet} accessibilityRole="menu">
            <Text variant="subheading" style={styles.sheetTitle}>
              Sort by
            </Text>
            {SORTS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setSort(option.id);
                  setSorting(false);
                }}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.id === sort }}
                style={({ pressed }) => [styles.sortRow, pressed ? styles.sortPressed : null]}>
                <Text style={[styles.sortText, option.id === sort ? styles.sortTextOn : null]}>{option.label}</Text>
                {option.id === sort ? <Feather name="check" size={17} color={colors.gold700} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: { gap: 14, paddingTop: 14, paddingBottom: 16 },
  intro: { marginHorizontal: gutter, borderRadius: radius.xl, padding: 20, gap: 8 },
  chips: { paddingHorizontal: gutter, gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.linen400,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  chipText: { fontFamily: fonts.label, fontSize: 13, color: colors.ink900 },
  chipTextOn: { color: colors.white },
  tools: { flexDirection: 'row', gap: 8, paddingHorizontal: gutter },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.linen100,
  },
  toolOn: { backgroundColor: colors.pickPaper },
  toolText: { fontFamily: fonts.label, fontSize: 12.5, color: colors.ink900 },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter,
    paddingTop: 18,
    paddingBottom: 34,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  sheetTitle: { marginBottom: 8 },
  sortRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.linen400,
  },
  sortPressed: { backgroundColor: colors.linen100 },
  sortText: { fontFamily: fonts.text, fontSize: 16, color: colors.ink900 },
  sortTextOn: { fontFamily: fonts.label, color: colors.gold700 },
});
