// The website's buttons: solid gold, outlined, or plain text ("ghost").

import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, type } from '@/theme/tokens';

import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'md' | 'sm';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Take the full width of the parent. */
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityHint?: string;
}

export function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
}

export function Button({
  label,
  onPress,
  variant = 'solid',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  wide = false,
  style,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const off = disabled || loading;
  const ink = variant === 'solid' ? colors.white : variant === 'outline' ? colors.gold600 : colors.gold700;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.small : null,
        variant === 'solid' ? styles.solid : variant === 'outline' ? styles.outline : styles.ghost,
        pressed && variant === 'solid' ? styles.solidPressed : null,
        pressed && variant !== 'solid' ? styles.quietPressed : null,
        wide ? styles.wide : null,
        off ? styles.off : null,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <View style={styles.row}>
          {icon ? <Feather name={icon} size={size === 'sm' ? 14 : 17} color={ink} /> : null}
          <Text style={[type.button, size === 'sm' ? styles.smallText : null, { color: ink }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: 25,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  small: { minHeight: 40, paddingHorizontal: 18 },
  smallText: { fontSize: 12, letterSpacing: 1.5 },
  wide: { alignSelf: 'stretch' },
  solid: { backgroundColor: colors.gold500 },
  solidPressed: { backgroundColor: colors.gold600 },
  outline: { borderWidth: 2, borderColor: colors.gold500 },
  ghost: { paddingHorizontal: 8 },
  quietPressed: { backgroundColor: colors.linen200 },
  off: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
