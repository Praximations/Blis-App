// "− 2 +": how many of something.

import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

import { tap } from './Button';
import { Text } from './Text';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: 'md' | 'lg';
  label?: string;
}) {
  const height = size === 'lg' ? 52 : 38;
  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, value + by));
    if (next !== value) {
      tap();
      onChange(next);
    }
  };
  return (
    <View
      style={[styles.box, { height }]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <Pressable
        onPress={() => step(-1)}
        disabled={value <= min}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Fewer: ${label}`}
        style={({ pressed }) => [styles.button, { width: height }, pressed ? styles.pressed : null]}>
        <Feather name="minus" size={15} color={value <= min ? colors.ink600 : colors.gold700} />
      </Pressable>
      <Text variant="label" style={[styles.value, size === 'lg' ? styles.valueLarge : null]}>
        {value}
      </Text>
      <Pressable
        onPress={() => step(1)}
        disabled={value >= max}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`More: ${label}`}
        style={({ pressed }) => [styles.button, { width: height }, pressed ? styles.pressed : null]}>
        <Feather name="plus" size={15} color={value >= max ? colors.ink600 : colors.gold700} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.linen400,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  button: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.linen100 },
  value: { minWidth: 30, textAlign: 'center', fontVariant: ['tabular-nums'] },
  valueLarge: { fontSize: 17, minWidth: 36 },
});
