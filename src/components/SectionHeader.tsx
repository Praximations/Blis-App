// The start of a part of a page: small capitals, a serif title and,
// sometimes, a link to more.

import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, gutter } from '@/theme/tokens';

import { Text } from './Text';

export function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.box}>
      <View style={styles.words}>
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link" style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Feather name="arrow-right" size={14} color={colors.gold700} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: gutter, marginBottom: 14 },
  words: { flex: 1, gap: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 5 },
  actionText: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold700 },
});
