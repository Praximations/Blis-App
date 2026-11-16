import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/States';
import { TopBar } from '@/components/TopBar';
import { colors } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <TopBar />
      <EmptyState
        icon="compass"
        title="We couldn't find that"
        text="The page may have moved. The shop is still here."
        action="Explore products"
        onAction={() => router.replace('/shop')}
      />
    </View>
  );
}
