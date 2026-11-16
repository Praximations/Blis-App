// Products side by side in a row that scrolls sideways.

import { FlatList, StyleSheet, View } from 'react-native';

import { useLayout } from '@/lib/layout';
import type { ProductSummary } from '@/shopify/types';
import { gutter } from '@/theme/tokens';

import { ProductCard } from './ProductCard';

export function ProductRail({ products }: { products: ProductSummary[] }) {
  const { railCard } = useLayout();
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => <ProductCard product={item} width={railCard} />}
      ItemSeparatorComponent={Separator}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      // Rails sit inside a page that scrolls the other way.
      nestedScrollEnabled
    />
  );
}

function Separator() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter },
  gap: { width: 10 },
});
