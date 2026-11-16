// Shop: every part of the shop, as the website's "Our Products" lists them.

import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { getSections, type Section } from '@/shopify/sections';
import { imageUrl } from '@/shopify/storefront';
import { sectionPhoto } from '@/theme/photos';
import { colors, fonts, gutter, maxWidth, radius, toneFor } from '@/theme/tokens';

const openCollection = (handle: string) => router.push({ pathname: '/collections/[handle]', params: { handle } });

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const sections = useQuery({ queryKey: ['sections'], queryFn: getSections });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
      refreshControl={
        <RefreshControl refreshing={sections.isRefetching} onRefresh={() => void sections.refetch()} tintColor={colors.gold500} />
      }
      showsVerticalScrollIndicator={false}>
      <View style={styles.column}>
        <View style={styles.intro}>
          <Text variant="title" accessibilityRole="header">
            Our Products
          </Text>
          <Text variant="lede">Thoughtfully sourced, chosen for exceptional quality.</Text>
        </View>

        <Pressable
          onPress={() => router.navigate('/search')}
          accessibilityRole="search"
          accessibilityLabel="Search products"
          style={styles.search}>
          <Feather name="search" size={17} color={colors.gold500} />
          <Text style={styles.searchText}>Search</Text>
        </Pressable>

        <Pressable
          onPress={() => openCollection('all')}
          accessibilityRole="link"
          style={({ pressed }) => [styles.all, pressed ? styles.pressed : null]}>
          <Text style={styles.allText}>All products</Text>
          <Feather name="arrow-right" size={16} color={colors.gold700} />
        </Pressable>

        {sections.isPending ? (
          <Loading />
        ) : sections.isError ? (
          <ErrorState onRetry={() => void sections.refetch()} />
        ) : (
          sections.data.map((section) => <SectionRow key={section.handle} section={section} />)
        )}
      </View>
    </ScrollView>
  );
}

function SectionRow({ section }: { section: Section }) {
  const tone = toneFor(section.handle);
  const photo = sectionPhoto(section.handle);
  return (
    <View style={[styles.section, { backgroundColor: tone.paper }]}>
      <Pressable
        onPress={() => openCollection(section.handle)}
        accessibilityRole="link"
        accessibilityLabel={`${section.title}${section.empty ? ', coming soon' : ''}`}
        style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
        <View style={styles.sectionPhoto}>
          {photo || section.image ? (
            <Image
              source={photo ?? { uri: imageUrl(section.image?.url, 300) }}
              alt=""
              contentFit="cover"
              transition={200}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Feather name="shopping-bag" size={22} color={tone.deep} />
          )}
        </View>
        <View style={styles.sectionWords}>
          <Text variant="subheading" style={styles.sectionTitle}>
            {section.title}
          </Text>
          {section.empty ? (
            <Text variant="eyebrow" color={tone.deep}>
              Coming soon
            </Text>
          ) : section.description ? (
            <Text variant="bodySmall" numberOfLines={2}>
              {section.description}
            </Text>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={tone.deep} />
      </Pressable>
      {section.categories.length ? (
        <View style={styles.chips}>
          {section.categories.map((category) => (
            <Pressable
              key={category.handle}
              onPress={() => openCollection(category.handle)}
              accessibilityRole="link"
              accessibilityLabel={`${category.title}${category.empty ? ', coming soon' : ''}`}
              style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}>
              <Text style={[styles.chipText, category.empty ? styles.chipSoon : null]}>{category.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingBottom: 36 },
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, gap: 12 },
  intro: { gap: 6, marginBottom: 6 },
  search: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(214,201,179,0.75)',
    backgroundColor: colors.fieldPaper,
  },
  searchText: { fontFamily: fonts.text, fontSize: 16, color: colors.ink600 },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  allText: { fontFamily: fonts.label, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gold700 },
  pressed: { opacity: 0.7 },
  section: { borderRadius: radius.xl, padding: 12, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectionPhoto: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  sectionWords: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 23, lineHeight: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.label, fontSize: 13, color: colors.ink900 },
  chipSoon: { color: colors.ink600 },
});
