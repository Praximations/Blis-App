// The basket: lines, the delivery choice when the food needs one, a
// discount code, the subtotal and the way to checkout.

import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CartLineItem } from '@/components/CartLineItem';
import { DeliveryCard } from '@/components/DeliveryCard';
import { Field } from '@/components/Field';
import { EmptyState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { openCheckout } from '@/lib/checkout';
import { formatMoney } from '@/lib/money';
import { useCart } from '@/state/cart';
import { useDelivery } from '@/state/delivery';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme/tokens';

export default function BasketScreen() {
  const insets = useSafeAreaInsets();
  const { cart, ready, pending, store, count } = useCart();
  const delivery = useDelivery();
  const [checkingOut, setCheckingOut] = useState(false);
  const [placed, setPlaced] = useState(false);
  /** Checkout was opened: when the app is back in front, see what became of the basket. */
  const awaitingReturn = useRef(false);

  const afterCheckout = useCallback(async () => {
    if (!awaitingReturn.current) return;
    awaitingReturn.current = false;
    const basket = await store.refresh().catch(() => store.getState().cart);
    if (!basket) {
      // Shopify no longer has the cart: the order went through.
      await store.clear();
      delivery.store.afterOrder();
      setPlaced(true);
    }
  }, [store, delivery.store]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void afterCheckout();
    });
    return () => subscription.remove();
  }, [afterCheckout]);

  // Time passes between visits: a delivery day may have closed.
  useFocusEffect(
    useCallback(() => {
      delivery.store.refresh();
    }, [delivery.store]),
  );

  const checkout = async () => {
    if (!cart || checkingOut) return;
    setCheckingOut(true);
    setPlaced(false);
    try {
      if (!(await delivery.store.prepareCheckout())) return;
      const url = store.getState().cart?.checkoutUrl;
      if (!url) return;
      awaitingReturn.current = true;
      await openCheckout(url);
      // iOS: the sheet has closed. (Android comes back through AppState.)
      if (Platform.OS === 'ios') await afterCheckout();
    } finally {
      setCheckingOut(false);
    }
  };

  const top = { paddingTop: insets.top + 18 };

  if (!ready) {
    return (
      <View style={[styles.screen, top]}>
        <Loading />
      </View>
    );
  }

  // The thank-you stays until something new goes in the basket.
  if (placed && count === 0) {
    return (
      <View style={[styles.screen, top]}>
        <EmptyState
          icon="check-circle"
          title="Thank you!"
          text="Your order is in. We've emailed your confirmation, and you can follow it under Account."
          action="Continue shopping"
          onAction={() => {
            setPlaced(false);
            router.navigate('/shop');
          }}
        />
      </View>
    );
  }

  const lines = cart?.lines.nodes ?? [];
  if (!lines.length) {
    return (
      <View style={[styles.screen, top]}>
        <EmptyState
          title="Your basket is empty"
          text="Explore food with a story, chosen for the people and places behind it."
          action="Explore products"
          onAction={() => router.navigate('/shop')}
        />
      </View>
    );
  }

  const needsChoice = delivery.needsDelivery && !delivery.canCheckout;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, top]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.intro}>
            <Text variant="eyebrow">Your order</Text>
            <Text variant="title" accessibilityRole="header">
              Your basket
            </Text>
            <Text variant="lede">
              {count} {count === 1 ? 'item' : 'items'} selected. Review your choices before checkout.
            </Text>
          </View>

          <View style={styles.lines}>
            {lines.map((line, index) => (
              <View key={line.id} style={index ? styles.lineRule : null}>
                <CartLineItem line={line} />
              </View>
            ))}
          </View>

          {delivery.needsDelivery ? <DeliveryCard /> : null}

          <Discounts />

          <View style={styles.summary}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.total}>{formatMoney(cart!.cost.subtotalAmount, { trailingZeros: true })}</Text>
            </View>
            <Text variant="hint">Shipping and taxes are calculated at checkout.</Text>
            <Button
              label="Continue to checkout"
              onPress={checkout}
              loading={checkingOut}
              disabled={needsChoice || pending > 0}
              wide
              style={styles.checkout}
              testID="checkout"
              accessibilityHint={needsChoice ? 'Choose a delivery or pickup day first' : undefined}
            />
            <View style={styles.secure}>
              <Feather name="lock" size={12} color={colors.ink600} />
              <Text variant="hint">Secure checkout</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A discount code: type it, apply it, take it off again. */
function Discounts() {
  const { cart, store } = useCart();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState('');
  const applied = cart?.discountCodes.filter((d) => d.applicable) ?? [];

  const apply = async () => {
    const wanted = code.trim();
    if (!wanted || busy) return;
    setBusy(true);
    setRefused('');
    try {
      const ok = await store.applyDiscount(wanted);
      if (ok) setCode('');
      else setRefused(`“${wanted}” can't be used on this basket.`);
    } catch {
      // The toast says what went wrong.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.discount}>
      <View style={styles.discountForm}>
        <Field
          label="Discount code"
          placeholder="Discount code"
          icon="tag"
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setRefused('');
          }}
          onSubmitEditing={apply}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          style={styles.discountField}
        />
        <Button label="Apply" variant="outline" size="sm" onPress={apply} loading={busy} disabled={!code.trim()} style={styles.discountApply} />
      </View>
      {refused ? <Text style={styles.refused}>{refused}</Text> : null}
      {applied.map((discount) => (
        <View key={discount.code} style={styles.applied}>
          <Feather name="tag" size={13} color={colors.gold700} />
          <Text style={styles.appliedText}>{discount.code}</Text>
          <Pressable
            onPress={() => void store.removeDiscount(discount.code).catch(() => undefined)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove the discount code ${discount.code}`}>
            <Feather name="x" size={15} color={colors.ink600} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 32 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 18 },
  intro: { gap: 5 },
  lines: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.linen400 },
  lineRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.linen400 },
  discount: { gap: 8 },
  discountForm: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  discountField: { flex: 1, minHeight: 46 },
  discountApply: { minHeight: 46, alignSelf: 'auto' },
  refused: { fontFamily: fonts.text, fontSize: 13, color: colors.red },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.gold100,
  },
  appliedText: { fontFamily: fonts.label, fontSize: 12.5, letterSpacing: 0.6, color: colors.gold900 },
  summary: { backgroundColor: colors.linen100, borderRadius: radius.xl, padding: 18, gap: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontFamily: fonts.label, fontSize: 15, color: colors.ink900 },
  total: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.price, fontVariant: ['tabular-nums'] },
  checkout: { marginTop: 8, minHeight: 54 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 },
});
