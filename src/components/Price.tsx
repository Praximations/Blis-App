// A price the way the website writes it: "$12", "from $12", with the old
// price struck through when it is reduced.

import { StyleSheet, View } from 'react-native';

import { formatMoney, isMore, sameAmount } from '@/lib/money';
import type { Money } from '@/shopify/types';
import { colors, fonts } from '@/theme/tokens';

import { Text } from './Text';

export function Price({
  price,
  max,
  compareAt,
  size = 'card',
}: {
  price: Money;
  /** The dearest variant: shows "from" when it differs. */
  max?: Money | null;
  compareAt?: Money | null;
  size?: 'card' | 'page';
}) {
  const varies = !!max && !sameAmount(price, max);
  const reduced = isMore(compareAt, price);
  return (
    <View style={styles.row} accessibilityLabel={`${varies ? 'from ' : ''}${formatMoney(price)}${reduced ? `, was ${formatMoney(compareAt)}` : ''}`}>
      {varies ? <Text style={styles.from}>from</Text> : null}
      <Text variant="price" style={size === 'page' ? styles.page : null}>
        {formatMoney(price)}
      </Text>
      {reduced ? <Text style={[styles.was, size === 'page' ? styles.wasPage : null]}>{formatMoney(compareAt)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  from: { fontFamily: fonts.text, fontSize: 11, color: colors.textWarm },
  page: { fontSize: 30, lineHeight: 34 },
  was: { fontFamily: fonts.text, fontSize: 12.5, color: colors.ink600, textDecorationLine: 'line-through' },
  wasPage: { fontSize: 17 },
});
