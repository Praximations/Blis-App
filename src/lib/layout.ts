// Sizes that depend on the screen.

import { useWindowDimensions } from 'react-native';

import { gutter, maxWidth } from '@/theme/tokens';

/** Width of the content column, and how many product cards fit across it. */
export function useLayout() {
  const { width } = useWindowDimensions();
  const content = Math.min(width, maxWidth);
  const inner = content - gutter * 2;
  const columns = inner >= 640 ? 3 : 2;
  const gap = 10;
  return {
    width,
    content,
    inner,
    columns,
    gap,
    card: Math.floor((inner - gap * (columns - 1)) / columns),
    /** A card in a sideways rail: most of a phone's width, so the next one peeks in. */
    railCard: Math.min(230, Math.round(inner * 0.62)),
  };
}
