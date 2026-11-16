// A page of product cards, two across on a phone, loading more as it is
// scrolled.

import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useLayout } from '@/lib/layout';
import type { ProductSummary } from '@/shopify/types';
import { colors, gutter, maxWidth } from '@/theme/tokens';

import { ProductCard } from './ProductCard';

export function ProductGrid({
  products,
  header,
  empty,
  onEndReached,
  loadingMore = false,
  refreshing = false,
  onRefresh,
}: {
  products: ProductSummary[];
  header?: ReactElement | null;
  /** Shown instead of cards when there are none. */
  empty?: ReactElement | null;
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { columns, card, gap } = useLayout();
  return (
    <FlatList
      // The number of columns can't change on a mounted list.
      key={columns}
      data={products}
      numColumns={columns}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => <ProductCard product={item} width={card} />}
      columnWrapperStyle={[styles.row, { gap }]}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={
        <View style={styles.footer}>{loadingMore ? <ActivityIndicator color={colors.gold500} /> : null}</View>
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold500} /> : undefined}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth, alignSelf: 'center', paddingBottom: 24, flexGrow: 1 },
  row: { paddingHorizontal: gutter },
  gap: { height: 10 },
  footer: { height: 56, alignItems: 'center', justifyContent: 'center' },
});
