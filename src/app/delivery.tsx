// Delivery & pickup: which days, order by when, and where. Written from the
// same rules the basket uses, so it can't say something the basket won't do.

import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Text } from '@/components/Text';
import { TopBar } from '@/components/TopBar';
import { capitalize, clockText, isPickup, sentenceList, upcoming } from '@/delivery/days';
import type { Slot } from '@/delivery/types';
import { openMaps, openWeb, pickupAddress } from '@/lib/links';
import { useDelivery } from '@/state/delivery';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

const orderBy = (slot: Slot) => `Order by ${capitalize(slot.cutoffDay)} at ${clockText(slot.cutoffHour, slot.cutoffMinute ?? 0)}.`;

export default function DeliveryScreen() {
  const d = useDelivery();
  const { rules, choice, store } = d;
  const [query, setQuery] = useState(choice.query);

  // ZIP codes by area, areas in the order the days list them.
  const byArea = new Map<string, string[]>();
  for (const [zip, area] of Object.entries(rules.zips)) byArea.set(area, [...(byArea.get(area) ?? []), zip]);

  const next =
    choice.eligible === true ? upcoming(rules, { area: choice.area, pickup: false, now: new Date(), limit: 1 })[0] : null;

  return (
    <View style={styles.screen}>
      <TopBar title="Delivery & pickup" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.intro}>
            <Text variant="title" accessibilityRole="header">
              Delivery &amp; pickup
            </Text>
            <Text variant="lede">
              Fresh and refrigerated products, such as cheese, charcuterie, smoked meats, dairy, eggs and fresh-baked
              bread, are delivered locally by our own drivers so they stay cold. Pantry products like olive oil, honey,
              salts and spices ship across the US.
            </Text>
          </View>

          <View style={styles.card}>
            <Text variant="subheading">Do we deliver to you?</Text>
            <View style={styles.form}>
              <Field
                pill
                icon="map-pin"
                label="ZIP code or city"
                placeholder="ZIP code or city"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void store.check(query)}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.field}
              />
              <Button label="Check" size="sm" loading={d.checking} disabled={!query.trim()} onPress={() => void store.check(query)} style={styles.check} />
            </View>
            {choice.eligible === true ? (
              <Text style={styles.good}>
                We deliver to {choice.area}.{next ? ` Next delivery ${next.label} (order by ${next.cutoffLabel}).` : ''}
              </Text>
            ) : choice.eligible === false ? (
              <Text style={styles.bad}>
                Home delivery is not available for {choice.query} yet.{d.hasPickup ? ' Pickup is open to everyone.' : ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.group}>
            <Text variant="heading">The week</Text>
            {rules.slots.map((slot, index) => (
              <View key={`${slot.day}-${slot.type}-${index}`} style={styles.day}>
                <View style={styles.dayIcon}>
                  <Feather name={isPickup(slot) ? 'map-pin' : 'truck'} size={17} color={colors.gold500} />
                </View>
                <View style={styles.dayWords}>
                  <Text style={styles.dayTitle}>
                    {capitalize(slot.day)} · {isPickup(slot) ? 'Pickup' : 'Delivery'}
                  </Text>
                  <Text variant="bodySmall">{orderBy(slot)}</Text>
                  {isPickup(slot) ? (
                    <>
                      <Text variant="bodySmall">
                        Pickup at {[slot.location, slot.details].filter(Boolean).join(', ')}. Open to everyone.
                      </Text>
                      {pickupAddress(slot.location, slot.details) ? (
                        <Button
                          label="Directions"
                          icon="navigation"
                          size="sm"
                          variant="ghost"
                          onPress={() => void openMaps(pickupAddress(slot.location, slot.details))}
                          style={styles.directions}
                        />
                      ) : null}
                    </>
                  ) : (
                    <Text variant="bodySmall">Delivery areas: {sentenceList(slot.areas)}.</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {byArea.size ? (
            <View style={styles.group}>
              <Text variant="heading">ZIP codes we deliver to</Text>
              {[...byArea.entries()].map(([area, zips]) => (
                <View key={area} style={styles.area}>
                  <Text style={styles.dayTitle}>{area}</Text>
                  <Text variant="bodySmall">{zips.sort().join(', ')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text variant="hint">
            We text the phone number on your order when your driver sets off and again when your order has been
            delivered.
          </Text>
          <Button label="More questions and answers" variant="outline" wide onPress={() => void openWeb('/pages/faq')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingTop: 20, paddingBottom: 40 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 24 },
  intro: { gap: 8 },
  card: { backgroundColor: colors.fieldPaper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.linen400, padding: 16, gap: 12 },
  form: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: { flex: 1, minHeight: 44 },
  check: { minHeight: 44, borderRadius: radius.pill, alignSelf: 'auto' },
  good: { fontFamily: fonts.textMedium, fontSize: 14, lineHeight: 20, color: colors.gold900 },
  bad: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.red },
  group: { gap: 12 },
  day: { flexDirection: 'row', gap: 12 },
  dayIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(186,149,97,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayWords: { flex: 1, gap: 2 },
  dayTitle: { fontFamily: fonts.label, fontSize: 15, lineHeight: 21, color: colors.ink900 },
  area: { gap: 2 },
  directions: { marginLeft: -8, minHeight: 34 },
});
