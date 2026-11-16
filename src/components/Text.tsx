// Text in one of the theme's roles (see theme/tokens.ts: type).

import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { type } from '@/theme/tokens';

export interface TextProps extends NativeTextProps {
  variant?: keyof typeof type;
  color?: string;
  center?: boolean;
}

export function Text({ variant = 'body', color, center, style, ...rest }: TextProps) {
  return (
    <NativeText
      {...rest}
      style={[type[variant], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}
    />
  );
}
