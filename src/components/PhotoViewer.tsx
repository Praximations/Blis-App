// A product's photos, full screen: swipe from one to the next; on an
// iPhone, pinch to look closer.

import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageUrl } from '@/shopify/storefront';
import type { Image as ShopImage } from '@/shopify/types';
import { colors, fonts, radius } from '@/theme/tokens';

import { Text } from './Text';

export function PhotoViewer({
  images,
  title,
  start,
  onClose,
}: {
  images: ShopImage[];
  title: string;
  /** The photo to open on; null keeps the viewer closed. */
  start: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState<number | null>(null);
  // Opening on another photo starts the counter there.
  if (start !== opened) {
    setOpened(start);
    if (start !== null) setIndex(start);
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== index && next >= 0 && next < images.length) setIndex(next);
  };

  return (
    <Modal visible={start !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <FlatList
          horizontal
          pagingEnabled
          data={images}
          keyExtractor={(image) => image.url}
          initialScrollIndex={start ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            // Pinch to zoom is the scroll view's own on iOS; elsewhere the photo fills the screen.
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={styles.page}
              maximumZoomScale={Platform.OS === 'ios' ? 4 : 1}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
              bouncesZoom>
              <Image
                source={{ uri: imageUrl(item.url, Math.min(2048, width * 3)) }}
                alt={item.altText ?? `${title}, photo ${i + 1} of ${images.length}`}
                contentFit="contain"
                transition={150}
                style={{ width, height: height - insets.top - insets.bottom - 120 }}
              />
            </ScrollView>
          )}
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
        />
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close the photos"
          style={[styles.close, { top: insets.top + 10 }]}>
          <Feather name="x" size={22} color={colors.ink900} />
        </Pressable>
        {images.length > 1 ? (
          <View style={[styles.counter, { bottom: insets.bottom + 18 }]} accessibilityLiveRegion="polite">
            <Text style={styles.counterText}>
              {index + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.linen200 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  counterText: { fontFamily: fonts.label, fontSize: 12.5, color: colors.ink900, fontVariant: ['tabular-nums'] },
});
