// Favourites: the products saved with the heart.

import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { ProductGrid } from '@/components/ProductGrid';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { getProductsById } from '@/shopify/catalog';
import { useShelf } from '@/state/shelf';
import { colors, gutter } from '@/theme/tokens';

export default function FavouritesScreen() {
  const shelf = useShelf();
  const ids = shelf.favourites.map((p) => p.id);
  // Read fresh from the shop, so prices and "sold out" are today's.
  const products = useQuery({
    queryKey: ['favourites', ids.join(',')],
    queryFn: () => getProductsById(ids),
    enabled: shelf.ready && ids.length > 0,
    placeholderData: (previous) => previous,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <TopBar title="Favourites" />
      {!shelf.ready || (ids.length > 0 && products.isPending) ? (
        <Loading />
      ) : !ids.length ? (
        <EmptyState
          icon="heart"
          title="Nothing saved yet"
          text="Tap the heart on a product to keep it here and find it again anytime."
          action="Explore products"
          onAction={() => router.navigate('/shop')}
        />
      ) : products.isError ? (
        <ErrorState onRetry={() => void products.refetch()} />
      ) : (
        <ProductGrid
          // Still saved, in the order they were saved.
          products={(products.data ?? [])
            .filter((p) => ids.includes(p.id))
            .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))}
          header={
            <Text variant="lede" style={{ paddingHorizontal: gutter, paddingVertical: 16 }}>
              {ids.length} {ids.length === 1 ? 'favourite' : 'favourites'}, kept on this phone.
            </Text>
          }
          empty={<EmptyState icon="heart" title="These are no longer in the shop" />}
        />
      )}
    </View>
  );
}
