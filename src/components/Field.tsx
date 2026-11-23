// A text field in the website's style, with an optional leading icon.

import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius } from '@/theme/tokens';

export interface FieldProps extends TextInputProps {
  icon?: keyof typeof Feather.glyphMap;
  /** Round ends, as in the delivery card and the search box. */
  pill?: boolean;
  label: string;
}

export function Field({ icon, pill, label, style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, pill ? styles.pill : null, focused ? styles.focused : null, style]}>
      {icon ? <Feather name={icon} size={17} color={focused ? colors.gold700 : colors.gold500} /> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.ink600}
        selectionColor={colors.gold500}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, webOnly]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.linen400,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  pill: { borderRadius: radius.pill },
  focused: { borderColor: colors.gold500 },
  // 16px keeps phones from zooming into the field.
  input: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.ink900,
  },
});

// A browser draws its own ring around a focused field; the box shows focus instead.
const webOnly = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : null;
