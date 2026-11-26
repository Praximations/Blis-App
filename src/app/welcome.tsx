// The sign-in page: the first thing a new customer sees. It is the
// website's sign-in sheet as a screen: cream paper, the logo, a few words,
// the email, one gold button, and the coastal watercolour along the foot.
//
// Signing in and creating an account are the same step (Shopify emails a
// 6-digit code; a new email address gets an account), so only the words
// change between the two.

import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tap } from '@/components/Button';
import { Text } from '@/components/Text';
import { openWeb } from '@/lib/links';
import { useAuth } from '@/state/auth';
import { skipFor, useGate } from '@/state/gate';
import { logoHorizontal, welcomeCoast } from '@/theme/photos';
import { colors, fonts, radius, shadow } from '@/theme/tokens';

const PERKS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  { icon: 'truck', text: 'Track your delivery and get a text when it arrives' },
  { icon: 'heart', text: 'Reorder your favourites in one tap' },
  { icon: 'shopping-bag', text: 'Check out faster with your address saved' },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  // On a phone the page is the whole screen; on a tablet or in a browser it
  // is a card in the middle, as the website's sign-in sheet is.
  const card = useWindowDimensions().width >= 640;
  const auth = useAuth();
  const skip = skipFor();
  // Someone who has signed in on this phone before is welcomed back.
  const [mode, setMode] = useState<'join' | 'signin'>(auth.known ? 'signin' : 'join');
  const [email, setEmail] = useState(auth.known?.email ?? '');
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState('');
  /** Already in the shop when the page opened: it was opened from Account, and can be closed. */
  const gate = useGate();
  const [fromShop] = useState(gate === 'open');

  // In (signed in, or "Look around first"): back to where the page was
  // opened from, or on to the shop.
  const entered = auth.signedIn || (gate === 'open' && !fromShop);
  useEffect(() => {
    if (!entered) return;
    if (fromShop && router.canGoBack()) router.back();
    else router.replace('/');
  }, [entered, fromShop]);

  const submit = async () => {
    const typed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) {
      setInvalid('Please enter a valid email address.');
      return;
    }
    if (!auth.available) {
      setInvalid('Sign-in isn’t set up for this app yet (npm run setup).');
      return;
    }
    tap();
    setInvalid('');
    await auth.store.signIn(typed);
  };

  const join = mode === 'join';
  const error = invalid || auth.error || '';

  return (
    <KeyboardAvoidingView style={[styles.screen, card ? styles.screenCard : null]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, card ? styles.contentCard : { paddingTop: insets.top + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.sheet, card ? styles.sheetCard : null]}>
          <View style={[styles.body, card ? styles.bodyCard : null]}>
            <View style={styles.top}>
              <Image source={logoHorizontal} alt="Blis Farms" contentFit="contain" contentPosition="left" style={styles.logo} />
              {fromShop ? (
                <Pressable
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}>
                  <Feather name="x" size={18} color={colors.gold700} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.eyebrow}>
              {join ? 'Welcome to Blis Farms' : auth.known?.name ? `Welcome back, ${auth.known.name}` : 'Welcome back'}
            </Text>
            <Text style={styles.title} accessibilityRole="header">
              {join ? 'Create your free account' : 'Sign in to your account'}
            </Text>

            {join ? (
              <>
                <Text style={styles.lead}>All you need is your email. No password to remember.</Text>
                <View style={styles.perks}>
                  {PERKS.map((perk) => (
                    <View key={perk.icon} style={styles.perk}>
                      <Feather name={perk.icon} size={16} color={colors.gold700} />
                      <Text style={styles.perkText}>{perk.text}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.gap} />
            )}

            <Text style={styles.label}>Email address</Text>
            <TextInput
              testID="welcome-email"
              accessibilityLabel="Email address"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setInvalid('');
                auth.store.dismissError();
              }}
              onSubmitEditing={submit}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor="#707276"
              selectionColor={colors.gold500}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              editable={!auth.busy}
              style={[styles.input, focused ? styles.inputFocused : null, webOnly]}
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Pressable
              testID="welcome-continue"
              onPress={submit}
              disabled={auth.busy}
              accessibilityRole="button"
              accessibilityLabel={join ? 'Create account' : 'Continue'}
              accessibilityState={{ disabled: auth.busy, busy: auth.busy }}
              style={({ pressed }) => [styles.submit, pressed ? styles.submitPressed : null, auth.busy ? styles.submitBusy : null]}>
              {auth.busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.submitText}>{join ? 'Create account' : 'Continue'}</Text>
                  <Feather name="arrow-right" size={15} color={colors.white} />
                </>
              )}
            </Pressable>
            <Text style={styles.note}>We&apos;ll email you a 6-digit code to confirm it&apos;s you.</Text>

            <View style={styles.switch}>
              <Text style={styles.switchText}>{join ? 'Already have an account?' : 'New to Blis Farms?'}</Text>
              <Pressable
                onPress={() => {
                  setMode(join ? 'signin' : 'join');
                  setInvalid('');
                  auth.store.dismissError();
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={join ? 'Sign in' : 'Create an account'}>
                <Text style={styles.switchLink}>{join ? 'Sign in' : 'Create an account'}</Text>
              </Pressable>
            </View>

            {skip && !fromShop ? (
              <Pressable
                testID="welcome-skip"
                onPress={() => auth.store.enterAsGuest()}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.guest, pressed ? styles.pressed : null]}>
                <Text style={styles.guestText}>
                  {skip === 'choice' ? 'Look around first' : 'Continue without signing in (development only)'}
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.small}>
              By continuing you agree to our{' '}
              <Text style={styles.smallLink} accessibilityRole="link" onPress={() => void openWeb('/pages/terms-of-service')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.smallLink} accessibilityRole="link" onPress={() => void openWeb('/policies/privacy-policy')}>
                Privacy Policy
              </Text>
              .
            </Text>
          </View>

          {/* The painting runs to the very foot of the screen, under the home indicator. */}
          <Image
            source={welcomeCoast}
            alt=""
            contentFit="cover"
            contentPosition="bottom"
            style={[styles.scene, card ? styles.sceneCard : null]}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A browser draws its own ring around a focused field; the box shows focus instead.
const webOnly = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.signInPaper },
  content: { flexGrow: 1 },
  screenCard: { backgroundColor: '#ece4d6' },
  contentCard: { justifyContent: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  sheet: { flexGrow: 1, width: '100%', justifyContent: 'space-between' },
  // The width, corners and shadow the sheet has on the website.
  sheetCard: {
    flexGrow: 0,
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(214,201,179,0.5)',
    backgroundColor: colors.signInPaper,
    ...shadow.float,
  },
  body: { paddingHorizontal: 28, paddingBottom: 8 },
  bodyCard: { paddingHorizontal: 40, paddingTop: 32 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  logo: { width: 124, height: 38 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  eyebrow: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.gold700,
    marginBottom: 10,
  },
  title: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.4, color: colors.ink900 },
  lead: { fontFamily: fonts.text, fontSize: 15.5, lineHeight: 23, color: colors.textSoft, marginTop: 12 },
  perks: { gap: 10, marginTop: 20, marginBottom: 24 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkText: { flex: 1, fontFamily: fonts.text, fontSize: 14.5, lineHeight: 20, color: colors.textSoft },
  gap: { height: 22 },
  label: { fontFamily: fonts.label, fontSize: 12.5, lineHeight: 17, letterSpacing: 0.25, color: colors.ink900, marginBottom: 8 },
  // 16px keeps phones from zooming into the field.
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.fieldLine,
    borderRadius: 8,
    backgroundColor: '#fffdf9',
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.ink900,
  },
  inputFocused: { borderColor: colors.gold500, backgroundColor: '#ffffff' },
  error: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18, color: '#8a3426', marginTop: 8 },
  submit: {
    height: 54,
    marginTop: 14,
    borderRadius: 8,
    backgroundColor: '#ba915c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitPressed: { backgroundColor: '#a67e48' },
  submitBusy: { opacity: 0.7 },
  submitText: { fontFamily: fonts.labelBold, fontSize: 13, lineHeight: 18, letterSpacing: 2.6, textTransform: 'uppercase', color: colors.white },
  note: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 19, color: colors.textSoft, marginTop: 10 },
  switch: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#e3d8c6',
  },
  switchText: { fontFamily: fonts.text, fontSize: 14.5, lineHeight: 20, color: colors.textSoft },
  switchLink: { fontFamily: fonts.label, fontSize: 14.5, lineHeight: 20, color: colors.gold700 },
  guest: {
    height: 48,
    marginTop: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#e3d8c6',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  guestText: { fontFamily: fonts.label, fontSize: 14, color: colors.ink900, textAlign: 'center' },
  small: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: colors.ink600, marginTop: 18 },
  smallLink: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: colors.gold700, textDecorationLine: 'underline' },
  scene: { width: '100%', aspectRatio: 2.6 },
  sceneCard: { borderBottomLeftRadius: radius.lg - 1, borderBottomRightRadius: radius.lg - 1 },
});
