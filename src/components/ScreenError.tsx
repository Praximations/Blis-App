// What a customer sees if a screen fails: an apology and a way to carry on,
// never a blank page.

import type { ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

import { EmptyState } from './States';

export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  // For whoever is developing; customers see the message below.
  if (__DEV__) console.error(error);
  return (
    <View style={{ flex: 1, backgroundColor: colors.white, justifyContent: 'center' }}>
      <EmptyState
        icon="alert-triangle"
        title="Something went wrong"
        text="Sorry about that. Your basket is safe. Please try again."
        action="Try again"
        onAction={() => void retry()}
      />
    </View>
  );
}
