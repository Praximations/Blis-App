// Search: suggestions while typing, then the results as product cards.

import Feather from '@expo/vector-icons/Feather';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/Field';
import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { formatMoney } from '@/lib/money';
import { getSuggestions, searchProducts } from '@/shopify/catalog';
import { getSections } from '@/shopify/sections';
import { imageUrl } from '@/shopify/storefront';
import { useShelf } from '@/state/shelf';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

/** The text after the typing has paused. */
function usePaused(value: string, ms: number) {
  const [paused, setPaused] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setPaused(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return paused;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const shelf = useShelf();
  const [text, setText] = useState('');
  /** The search that was asked for (Return, or a suggestion). */
  const [query, setQuery] = useState('');
  const typed = usePaused(text.trim(), 250);

  const sections = useQuery({ queryKey: ['sections'], queryFn: getSections });
  const suggestions = useQuery({
    queryKey: ['suggest', typed],
    queryFn: ({ signal }) => getSuggestions(typed, signal),
    enabled: typed.length >= 2 && typed !== query,
  });
  const results = useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => searchProducts(query, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined),
    enabled: query.length > 0,
  });

  const search = (value: string) => {
    const q = value.trim();
    if (!q) return;
    Keyboard.dismiss();
    setText(q);
    setQuery(q);
    shelf.store.searched(q);
  };
  const clear = () => {
    setText('');
    setQuery('');
  };

  const showingResults = query.length > 0 && text.trim() === query;
  const products = results.data?.pages.flatMap((p) => p.nodes) ?? [];
  const total = results.data?.pages[0]?.totalCount ?? 0;
  const categories = sections.data?.filter((s) => !s.empty) ?? [];

  const bar = (
    <View style={styles.bar}>
      <Text variant="title" accessibilityRole="header">
        Search
      </Text>
      <View style={styles.fieldRow}>
        <Field
          pill
          icon="search"
          label="Search products"
          placeholder="Search"
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => search(text)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.field}
        />
        {text ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear the search" style={styles.clear}>
            <Feather name="x" size={18} color={colors.ink600} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const browse = (
    <View style={styles.browse}>
      <Text variant="eyebrow">Browse our categories instead</Text>
      <View style={styles.chips}>
        {categories.map((section) => (
          <Pressable
            key={section.handle}
            onPress={() => router.push({ pathname: '/collections/[handle]', params: { handle: section.handle } })}
            accessibilityRole="link"
            style={styles.chip}>
            <Text style={styles.chipText}>{section.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (showingResults) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 18 }]}>
        {results.isPending ? (
          <>
            {bar}
            <Loading label="Searching…" />
          </>
        ) : results.isError ? (
          <>
            {bar}
            <ErrorState onRetry={() => void results.refetch()} />
          </>
        ) : (
          <ProductGrid
            products={products}
            header={
              <View>
                {bar}
                <Text variant="hint" style={styles.summary}>
                  {total ? `${total} ${total === 1 ? 'result' : 'results'} found for “${query}”` : `No results found for “${query}”`}
                </Text>
              </View>
            }
            empty={browse}
            onEndReached={() => {
              if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
            }}
            loadingMore={results.isFetchingNextPage}
          />
        )}
      </View>
    );
  }

  const found = suggestions.data;
  const nothing = found && !found.products.length && !found.collections.length && !found.queries.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {bar}
      <View style={styles.column}>
        {typed.length >= 2 ? (
          suggestions.isPending ? (
            <Text variant="hint">Searching…</Text>
          ) : nothing || !found ? (
            <>
              <Text variant="hint">No products match</Text>
              {browse}
            </>
          ) : (
            <>
              {found.queries.map((item) => (
                <Row key={`q-${item.text}`} icon="search" title={item.text} onPress={() => search(item.text)} />
              ))}
              {found.collections.map((item) => (
                <Row
                  key={item.id}
                  icon="grid"
                  title={item.title}
                  onPress={() => router.push({ pathname: '/collections/[handle]', params: { handle: item.handle } })}
                />
              ))}
              {found.products.map((item) => (
                <Row
                  key={item.id}
                  image={item.featuredImage?.url}
                  title={item.title}
                  detail={formatMoney(item.priceRange.minVariantPrice)}
                  onPress={() => router.push({ pathname: '/products/[handle]', params: { handle: item.handle } })}
                />
              ))}
              <Pressable onPress={() => search(text)} accessibilityRole="button" style={styles.seeAll}>
                <Text style={styles.seeAllText}>See all results for “{text.trim()}”</Text>
                <Feather name="arrow-right" size={14} color={colors.gold700} />
              </Pressable>
            </>
          )
        ) : (
          <>
            {shelf.searches.length ? (
              <View style={styles.browse}>
                <View style={styles.recentHead}>
                  <Text variant="eyebrow">Recent searches</Text>
                  <Pressable onPress={() => shelf.store.clearSearches()} hitSlop={10} accessibilityRole="button">
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {shelf.searches.map((item) => (
                    <Pressable key={item} onPress={() => search(item)} accessibilityRole="button" style={styles.chip}>
                      <Text style={styles.chipText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.browse}>
              <Text variant="eyebrow">Popular categories</Text>
              <View style={styles.chips}>
                {categories.map((section) => (
                  <Pressable
                    key={section.handle}
                    onPress={() => router.push({ pathname: '/collections/[handle]', params: { handle: section.handle } })}
                    accessibilityRole="link"
                    style={styles.chip}>
                    <Text style={styles.chipText}>{section.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {!shelf.searches.length && !categories.length ? (
              <EmptyState icon="search" title="What are you looking for?" text="Olive oil, honey, raw milk, steaks…" />
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  image,
  title,
  detail,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap;
  image?: string;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}>
      <View style={styles.rowIcon}>
        {image ? (
          <Image source={{ uri: imageUrl(image, 120) }} alt="" contentFit="contain" style={styles.rowImage} />
        ) : (
          <Feather name={icon ?? 'search'} size={16} color={colors.gold500} />
        )}
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {detail ? <Text variant="price">{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 36 },
  bar: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 12, marginBottom: 14 },
  fieldRow: { justifyContent: 'center' },
  field: { minHeight: 50, paddingRight: 44, backgroundColor: colors.fieldPaper, borderColor: 'rgba(214,201,179,0.75)' },
  clear: { position: 'absolute', right: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 4 },
  summary: { paddingHorizontal: gutter, marginBottom: 14 },
  browse: { gap: 10, marginTop: 14, paddingHorizontal: 0 },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.ink600 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.linen100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.linen400,
  },
  rowPressed: { backgroundColor: colors.linen100 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.linen100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowImage: { width: 32, height: 32 },
  rowTitle: { flex: 1, fontFamily: fonts.textMedium, fontSize: 15, color: colors.ink900 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16 },
  seeAllText: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold700 },
});
