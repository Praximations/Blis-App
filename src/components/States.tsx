// What a screen shows while it waits, when something went wrong, and when
// there is nothing to show.

import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator color={colors.gold500} size="large" />
      {label ? <Text variant="hint">{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.box}>
      <Feather name="wifi-off" size={28} color={colors.gold500} />
      <Text variant="subheading" center>
        Something went wrong
      </Text>
      <Text variant="lede" center>
        {message || "We couldn't load this. Check your connection and try again."}
      </Text>
      {onRetry ? <Button label="Try again" variant="outline" onPress={onRetry} style={styles.action} /> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'shopping-bag',
  title,
  text,
  action,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.box}>
      <Feather name={icon} size={30} color={colors.gold500} />
      <Text variant="heading" center>
        {title}
      </Text>
      {text ? (
        <Text variant="lede" center>
          {text}
        </Text>
      ) : null}
      {action ? <Button label={action} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl, minHeight: 260 },
  action: { alignSelf: 'center', marginTop: space.sm },
});
