// A short note over the screen: "Added to basket", or what went wrong with
// the basket.

import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/state/cart';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

import { Text } from './Text';

export function Toast() {
  const { added, error, store } = useCart();
  const insets = useSafeAreaInsets();
  /** The note that has had its time on screen. */
  const [done, setDone] = useState<string | null>(null);

  const note = error
    ? { key: `error:${error}`, text: error, bad: true }
    : added
      ? { key: `added:${added.at}`, text: 'Added to basket', bad: false }
      : null;
  const key = note?.key ?? null;
  const bad = !!note?.bad;

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(
      () => {
        setDone(key);
        if (bad) store.dismissError();
      },
      bad ? 4000 : 1800,
    );
    return () => clearTimeout(timer);
  }, [key, bad, store]);

  if (!note || note.key === done) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 74 }]}>
      <View style={[styles.pill, note.bad ? styles.bad : null]} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Feather name={note.bad ? 'alert-circle' : 'check'} size={14} color={colors.white} />
        <Text style={styles.text} numberOfLines={2}>
          {note.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 420,
    minHeight: 34,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink900,
    ...shadow.float,
  },
  bad: { backgroundColor: colors.red, borderRadius: radius.md },
  text: { flexShrink: 1, fontFamily: fonts.label, fontSize: 11.5, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.white },
});
