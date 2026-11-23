// The delivery choice in the basket, as on the website: Delivery or Pickup,
// a ZIP check, then the next days as pills. Checkout stays closed until a
// day (and a time, when the delivery app books windows) is chosen.

import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useFollowing } from '@/lib/hooks';
import { openMaps, pickupAddress } from '@/lib/links';
import { useDelivery } from '@/state/delivery';
import { colors, fonts, radius } from '@/theme/tokens';

import { tap } from './Button';
import { Field } from './Field';
import { Text } from './Text';

/** How many day pills before "More days". */
const FIRST_DAYS = 3;

export function DeliveryCard() {
  const d = useDelivery();
  const { choice, store } = d;
  const pickup = choice.method === 'pickup';
  const [query, setQuery] = useFollowing(choice.query);
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState(false);

  // A chosen day beyond the first three stays in view.
  const chosenIndex = d.days.findIndex((day) => day.iso === choice.date);
  const shown = more || chosenIndex >= FIRST_DAYS ? d.days : d.days.slice(0, FIRST_DAYS);

  const check = async () => {
    if (!query.trim() || d.checking) return;
    tap();
    const served = await store.check(query);
    if (served) setEditing(false);
  };

  const served = choice.eligible === true && !editing;

  return (
    <View style={styles.card}>
      {d.hasPickup ? (
        <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="How would you like your order?">
          {(['delivery', 'pickup'] as const).map((method) => {
            const on = choice.method === method;
            return (
              <Pressable
                key={method}
                onPress={() => {
                  tap();
                  setMore(false);
                  store.chooseMethod(method);
                }}
                accessibilityRole="radio"
                accessibilityLabel={method === 'delivery' ? 'Delivery' : 'Pickup'}
                accessibilityState={{ selected: on }}
                style={[styles.option, on ? styles.optionOn : null]}>
                <Feather name={method === 'delivery' ? 'truck' : 'map-pin'} size={15} color={on ? colors.gold500 : colors.ink600} />
                <Text style={[styles.optionText, on ? styles.optionTextOn : null]}>
                  {method === 'delivery' ? 'Delivery' : 'Pickup'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {pickup ? (
        <View style={styles.summary}>
          <View style={styles.tile}>
            <Feather name="map-pin" size={18} color={colors.gold500} />
          </View>
          <View style={styles.summaryWords}>
            <Text style={styles.title}>{d.pickupPlace?.name ?? 'Pickup'}</Text>
            <Text style={styles.sub}>{[d.pickupDays, d.pickupPlace?.details].filter(Boolean).join(', ')}</Text>
          </View>
          {d.pickupPlace && pickupAddress(d.pickupPlace.name, d.pickupPlace.details) ? (
            <Pressable
              onPress={() => void openMaps(pickupAddress(d.pickupPlace!.name, d.pickupPlace!.details))}
              hitSlop={10}
              accessibilityRole="link"
              accessibilityLabel={`Directions to ${d.pickupPlace.name}`}>
              <Text style={styles.change}>Directions</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.tile}>
              <Feather name="truck" size={18} color={colors.gold500} />
            </View>
            <View style={styles.summaryWords}>
              <Text style={styles.title}>Delivery</Text>
              <Text style={styles.sub}>
                {served
                  ? `To ${[choice.area, choice.zip].filter(Boolean).join(' ')}`
                  : d.deliveryDays
                    ? `We deliver ${d.deliveryDays}.`
                    : 'By our own drivers.'}
              </Text>
            </View>
            {served ? (
              <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change the delivery address">
                <Text style={styles.change}>Change</Text>
              </Pressable>
            ) : null}
          </View>

          {served ? null : (
            <>
              <View style={styles.form}>
                <Field
                  pill
                  icon="map-pin"
                  label="ZIP code or city"
                  placeholder="ZIP code or city"
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={check}
                  returnKeyType="search"
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={styles.zip}
                />
                <Pressable
                  onPress={check}
                  disabled={!query.trim() || d.checking}
                  accessibilityRole="button"
                  accessibilityLabel="Check this ZIP code or city"
                  style={({ pressed }) => [styles.check, pressed ? styles.checkPressed : null, !query.trim() ? styles.off : null]}>
                  {d.checking ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.checkText}>Check</Text>}
                </Pressable>
              </View>
              {choice.eligible === false ? (
                <View style={styles.notServed}>
                  <Text style={styles.error}>Home delivery is not available for {choice.query} yet.</Text>
                  {d.hasPickup ? (
                    <Pressable onPress={() => store.chooseMethod('pickup')} hitSlop={8} accessibilityRole="button">
                      <Text style={styles.change}>Pick up instead</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : choice.eligible === null ? (
                <Text style={styles.hint}>
                  Your basket has items we deliver locally. Check your ZIP code, then pick a day to check out.
                </Text>
              ) : null}
            </>
          )}
        </>
      )}

      {d.limitNote ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{d.limitNote}</Text>
        </View>
      ) : null}

      {(pickup || served) && d.days.length ? (
        <>
          <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={pickup ? 'Pickup day' : 'Delivery day'}>
            {shown.map((day) => {
              const on = day.iso === choice.date;
              return (
                <Pressable
                  key={`${day.iso}-${day.locationId}`}
                  onPress={() => {
                    tap();
                    store.chooseDate(day.iso);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={day.label}
                  style={({ pressed }) => [styles.pill, on ? styles.pillOn : null, pressed ? styles.pillPressed : null]}>
                  <Text style={[styles.pillDay, on ? styles.pillDayOn : null]}>{day.weekdayShort}</Text>
                  <Text style={styles.pillDate}>{day.monthDay}</Text>
                </Pressable>
              );
            })}
          </View>
          {!more && d.days.length > shown.length ? (
            <Pressable onPress={() => setMore(true)} hitSlop={8} accessibilityRole="button" style={styles.more}>
              <Text style={styles.change}>More days</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {d.day?.windows.length ? (
        <View style={styles.windows} accessibilityRole="radiogroup" accessibilityLabel="Time">
          {d.day.windows.map((slot) => {
            const on = slot.key === choice.window;
            return (
              <Pressable
                key={slot.key}
                onPress={() => {
                  tap();
                  store.chooseWindow(slot.key);
                }}
                accessibilityRole="radio"
                accessibilityLabel={slot.label}
                accessibilityState={{ selected: on }}
                style={[styles.window, on ? styles.windowOn : null]}>
                <Text style={[styles.windowText, on ? styles.windowTextOn : null]}>{slot.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {pickup || served ? <Text style={styles.hint}>{statusLine(d)}</Text> : null}
      {d.error ? <Text style={styles.error}>{d.error}</Text> : null}
    </View>
  );
}

function statusLine(d: ReturnType<typeof useDelivery>): string {
  const pickup = d.choice.method === 'pickup';
  switch (d.needs) {
    case 'none':
      if (!pickup) return "We don't deliver to your area on the days your basket needs.";
      return d.limits.length
        ? 'Pickup days don’t work for everything in your basket.'
        : 'No pickup days are open right now. Please check back soon.';
    case 'day':
      return pickup ? 'Choose your pickup day to check out.' : 'Choose your delivery day to check out.';
    case 'time':
      return 'Choose a time to check out.';
    case '':
      return d.day?.cutoffLabel ? `Order by ${d.day.cutoffLabel} for ${d.day.weekday}.` : '';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.linen400,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  switch: { flexDirection: 'row', backgroundColor: colors.linen200, borderRadius: radius.pill, padding: 3 },
  option: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.pill,
  },
  optionOn: { backgroundColor: colors.white, boxShadow: '0 1px 4px rgba(42,42,42,0.1)' } as never,
  optionText: { fontFamily: fonts.label, fontSize: 13.5, color: colors.ink600 },
  optionTextOn: { color: colors.ink900 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(186,149,97,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryWords: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.textMedium, fontSize: 16, lineHeight: 21, color: colors.ink900 },
  sub: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 17, color: colors.ink900, opacity: 0.7 },
  change: { fontFamily: fonts.label, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.gold700 },
  form: { flexDirection: 'row', gap: 8 },
  zip: { flex: 1, minHeight: 44 },
  check: {
    height: 44,
    minWidth: 84,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPressed: { backgroundColor: colors.gold600 },
  off: { opacity: 0.45 },
  checkText: { fontFamily: fonts.labelBold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.white },
  notServed: { gap: 8, alignItems: 'flex-start' },
  hint: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 18, color: colors.ink600 },
  error: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: colors.red },
  note: { backgroundColor: colors.gold100, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12 },
  noteText: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 18, color: colors.gold900 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.linen200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  pillOn: { borderColor: colors.gold500, backgroundColor: colors.white },
  pillPressed: { transform: [{ scale: 0.97 }] },
  pillDay: { fontFamily: fonts.textMedium, fontSize: 15, lineHeight: 19, color: colors.ink900 },
  pillDayOn: { fontFamily: fonts.label, color: colors.gold700 },
  pillDate: { fontFamily: fonts.text, fontSize: 11, lineHeight: 14, color: colors.ink600 },
  more: { alignSelf: 'center', paddingVertical: 2 },
  windows: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  window: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.linen400,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowOn: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  windowText: { fontFamily: fonts.label, fontSize: 13, color: colors.ink900 },
  windowTextOn: { color: colors.white },
});
