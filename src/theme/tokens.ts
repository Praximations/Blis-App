// The Blis look, taken from the website's theme (Blis repo:
// assets/blis-base.css and the palette in the compiled bundle). Change a
// colour, radius or text style here, not in a screen.

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  gold100: '#f2e7d6',
  gold300: '#dbba87',
  /** The brand gold: buttons, icons, selected things. */
  gold500: '#ba9561',
  gold600: '#91744d',
  gold700: '#9c6c28',
  gold900: '#7c4e0e',
  /** Muted text. */
  ink600: '#9f9783',
  /** Main text. */
  ink900: '#2a2a2a',
  linen100: '#f3f2ee',
  linen200: '#f0eee9',
  linen300: '#eeece8',
  /** Hairlines and borders. */
  linen400: '#e7e5e0',
  white: '#fefefe',
  red: '#db3030',
  textSoft: '#555555',
  textWarm: '#5b5147',
  price: '#4a3f35',
  fieldPaper: '#fcf9f3',
  /** Selected size, current section. */
  pickPaper: '#f3e9d8',
  cardLine: '#e8e2d8',
  fieldLine: '#c7b8a0',
  scrim: 'rgba(42,42,42,0.45)',
} as const;

export const radius = { xs: 4, sm: 6, md: 10, lg: 14, xl: 18, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

/** The page gutter on phones (the website's is 20px). */
export const gutter = 20;
/** Screens stop growing here on tablets and the web. */
export const maxWidth = 760;

export const fonts = {
  /** Titles and prices. */
  serif: 'EBGaramond_400Regular',
  /** Paragraphs. */
  text: 'GoogleSans_400Regular',
  textMedium: 'GoogleSans_500Medium',
  /** Buttons, labels and menus. */
  label: 'GoogleSans_600SemiBold',
  labelBold: 'GoogleSans_700Bold',
} as const;

export const shadow = {
  soft: Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 22px -14px rgba(42,42,42,0.22)' },
    default: {
      shadowColor: '#2a2a2a',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }) as ViewStyle,
  float: Platform.select<ViewStyle>({
    web: { boxShadow: '0 16px 36px -18px rgba(42,42,42,0.3)' },
    default: {
      shadowColor: '#2a2a2a',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  }) as ViewStyle,
};

/** Text styles by role. */
export const type = {
  /** Screen titles: "Your basket", a section's name. */
  title: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.3, color: colors.ink900 },
  /** The home hero. */
  display: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 46, letterSpacing: -0.5, color: colors.ink900 },
  /** Titles inside a screen. */
  heading: { fontFamily: fonts.serif, fontSize: 27, lineHeight: 30, letterSpacing: -0.2, color: colors.ink900 },
  subheading: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, color: colors.ink900 },
  cardTitle: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 21, color: colors.ink900 },
  price: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 21, color: colors.price },
  body: { fontFamily: fonts.text, fontSize: 16, lineHeight: 25, color: colors.textWarm },
  bodySmall: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 20, color: colors.textWarm },
  /** Intros under a title. */
  lede: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.textSoft },
  /** Small capitals above a title or on a card. */
  eyebrow: {
    fontFamily: fonts.label,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.gold700,
  },
  label: { fontFamily: fonts.label, fontSize: 14, lineHeight: 20, color: colors.ink900 },
  button: {
    fontFamily: fonts.labelBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hint: { fontFamily: fonts.text, fontSize: 12.5, lineHeight: 18, color: colors.ink600 },
} satisfies Record<string, TextStyle>;

// ─── Section tones ──────────────────────────────────────────────────────────
// Each part of the shop has its own paper colour and a deeper one for text
// and icons (website: snippets/shop-tone.liquid).

export interface Tone {
  paper: string;
  deep: string;
}

const TONES = {
  wheat: { paper: '#f8f0e2', deep: '#946c3a' },
  olive: { paper: '#f0f1e3', deep: '#626e3b' },
  clay: { paper: '#f7ece5', deep: '#985a43' },
  cream: { paper: '#f1f3ef', deep: '#587485' },
  honey: { paper: '#faf0da', deep: '#9c7022' },
  sage: { paper: '#edf1ea', deep: '#5c775a' },
  stone: { paper: '#f1eee9', deep: '#776d64' },
  mint: { paper: '#eaf2ee', deep: '#44766a' },
  heather: { paper: '#f1edf3', deep: '#75617f' },
  beet: { paper: '#f8ecef', deep: '#a14a60' },
  linen: { paper: colors.linen200, deep: colors.gold700 },
} satisfies Record<string, Tone>;

const TONE_BY_HANDLE: Record<string, keyof typeof TONES> = {
  bakery: 'wheat',
  'breads-bakery': 'wheat',
  'olive-oil-vinegar': 'olive',
  'olive-oil': 'olive',
  vinegar: 'olive',
  'meats-seafood': 'clay',
  meats: 'clay',
  seafood: 'clay',
  'dairy-eggs': 'cream',
  cheese: 'cream',
  eggs: 'cream',
  'milk-butter': 'cream',
  produce: 'beet',
  pantry: 'honey',
  honey: 'honey',
  'salts-spices': 'honey',
  'coffee-tea': 'honey',
  'black-garlic': 'honey',
  'pantry-staples': 'honey',
  'prepared-foods': 'sage',
  catering: 'stone',
  wellness: 'mint',
  pet: 'heather',
  pets: 'heather',
};

export const toneFor = (handle: string | null | undefined): Tone => TONES[TONE_BY_HANDLE[handle ?? ''] ?? 'linen'];
