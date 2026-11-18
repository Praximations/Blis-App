// "Nutrition and ingredients" on a product page: the Nutrition Facts panel,
// the ingredients and the allergens, folded away until asked for.

import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Nutrition, NutritionRow } from '@/shopify/nutrition';
import { colors, fonts, radius } from '@/theme/tokens';

import { tap } from './Button';
import { Text } from './Text';

export function NutritionSection({ nutrition }: { nutrition: Nutrition }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.box}>
      <Pressable
        onPress={() => {
          tap();
          setOpen((on) => !on);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.head, pressed ? styles.pressed : null]}>
        <Feather name="list" size={17} color={colors.gold500} />
        <Text style={styles.headText}>{nutrition.hasPanel ? 'Nutrition and ingredients' : 'Ingredients'}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.ink600} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {nutrition.hasPanel ? <Facts nutrition={nutrition} /> : null}
          {nutrition.ingredients ? (
            <View style={styles.part}>
              <Text variant="eyebrow" color={colors.ink600}>
                Ingredients
              </Text>
              <Text>{nutrition.ingredients}</Text>
            </View>
          ) : null}
          {nutrition.allergens.length ? (
            <View style={styles.part}>
              <Text variant="eyebrow" color={colors.ink600}>
                Allergens
              </Text>
              <View style={styles.chips}>
                {nutrition.allergens.map((allergen) => (
                  <View key={allergen} style={styles.chip}>
                    <Text style={styles.chipText}>{allergen}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The panel as it is printed on a pack. */
function Facts({ nutrition }: { nutrition: Nutrition }) {
  return (
    <View style={styles.facts} accessibilityLabel="Nutrition Facts">
      <Text style={styles.factsTitle}>Nutrition Facts</Text>
      {nutrition.servingsPerContainer ? (
        <Text style={styles.serving}>{nutrition.servingsPerContainer} servings per container</Text>
      ) : null}
      {nutrition.servingSize ? (
        <View style={styles.servingSize}>
          <Text style={styles.strong}>Serving size</Text>
          <Text style={styles.strong}>{nutrition.servingSize}</Text>
        </View>
      ) : null}
      <View style={styles.ruleHeavy} />
      {nutrition.calories ? (
        <>
          <View style={styles.calories}>
            <View>
              <Text style={styles.small}>Amount per serving</Text>
              <Text style={styles.caloriesName}>Calories</Text>
            </View>
            <Text style={styles.caloriesValue}>{nutrition.calories}</Text>
          </View>
          <View style={styles.ruleMedium} />
        </>
      ) : null}
      {nutrition.rows.length ? <Text style={styles.dvHead}>% Daily Value*</Text> : null}
      {nutrition.rows.map((row) => (
        <Row key={row.name} row={row} />
      ))}
      {nutrition.vitamins.length ? (
        <>
          <View style={styles.ruleHeavy} />
          {nutrition.vitamins.map((row) => (
            <Row key={row.name} row={row} plain />
          ))}
        </>
      ) : null}
      <View style={styles.ruleMedium} />
      <Text style={styles.note}>* {nutrition.footnote}</Text>
    </View>
  );
}

function Row({ row, plain }: { row: NutritionRow; plain?: boolean }) {
  return (
    <View style={[styles.row, { paddingLeft: row.indent * 14 }]}>
      <Text style={styles.rowText}>
        <Text style={row.indent === 0 && !plain ? styles.strong : styles.rowText}>{row.name}</Text>
        {row.amount ? ` ${row.amount}` : ''}
      </Text>
      {row.dailyValue ? <Text style={styles.strong}>{row.dailyValue}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.linen400 },
  head: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { backgroundColor: colors.linen100 },
  headText: { flex: 1, fontFamily: fonts.label, fontSize: 15, color: colors.ink900 },
  body: { gap: 18, paddingBottom: 18 },
  part: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: colors.linen100 },
  chipText: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.ink900 },
  facts: { borderWidth: 1.5, borderColor: colors.ink900, borderRadius: radius.xs, padding: 12, backgroundColor: colors.white },
  factsTitle: { fontFamily: fonts.labelBold, fontSize: 27, lineHeight: 31, color: colors.ink900 },
  serving: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.ink900 },
  servingSize: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  strong: { fontFamily: fonts.labelBold, fontSize: 14, lineHeight: 20, color: colors.ink900 },
  small: { fontFamily: fonts.labelBold, fontSize: 11.5, lineHeight: 15, color: colors.ink900 },
  ruleHeavy: { height: 8, backgroundColor: colors.ink900, marginVertical: 5 },
  ruleMedium: { height: 4, backgroundColor: colors.ink900, marginVertical: 4 },
  calories: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  caloriesName: { fontFamily: fonts.labelBold, fontSize: 22, lineHeight: 26, color: colors.ink900 },
  caloriesValue: { fontFamily: fonts.labelBold, fontSize: 32, lineHeight: 36, color: colors.ink900 },
  dvHead: { fontFamily: fonts.labelBold, fontSize: 12, lineHeight: 18, color: colors.ink900, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink900,
  },
  rowText: { flexShrink: 1, fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.ink900 },
  note: { fontFamily: fonts.text, fontSize: 11.5, lineHeight: 16, color: colors.ink900 },
});
