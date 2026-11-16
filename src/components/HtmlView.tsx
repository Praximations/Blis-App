// A product's description: Shopify's HTML shown as native text.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { parseHtml } from '@/lib/html';
import { appRoute, openWeb } from '@/lib/links';
import { colors, fonts } from '@/theme/tokens';
import { router } from 'expo-router';

import { Text } from './Text';

function follow(href: string) {
  const inside = appRoute(href);
  if (inside) router.push(inside);
  else void openWeb(href);
}

export function HtmlView({ html }: { html: string }) {
  const blocks = useMemo(() => parseHtml(html), [html]);
  if (!blocks.length) return null;
  return (
    <View style={styles.box}>
      {blocks.map((block, index) => {
        const spans = block.spans.map((span, i) => (
          <Text
            key={i}
            onPress={span.href ? () => follow(span.href as string) : undefined}
            accessibilityRole={span.href ? 'link' : undefined}
            style={[
              span.bold ? styles.bold : null,
              span.italic ? styles.italic : null,
              span.href ? styles.link : null,
            ]}>
            {span.text}
          </Text>
        ));
        if (block.kind === 'heading') {
          return (
            <Text key={index} variant="subheading" accessibilityRole="header">
              {spans}
            </Text>
          );
        }
        if (block.kind === 'item') {
          return (
            <View key={index} style={styles.item}>
              <Text style={styles.marker}>{block.marker}</Text>
              <Text style={styles.itemText}>{spans}</Text>
            </View>
          );
        }
        return <Text key={index}>{spans}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  bold: { fontFamily: fonts.label, color: colors.ink900 },
  italic: { fontStyle: 'italic' },
  link: { color: colors.gold700, textDecorationLine: 'underline' },
  item: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  marker: { minWidth: 14, color: colors.gold700 },
  itemText: { flex: 1 },
});
