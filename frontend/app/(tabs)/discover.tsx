/**
 * Discover tab — 2-column creator grid with sticky filter chips.
 * Businesses primarily use this to find influencers. Influencers can browse
 * peers too (useful for benchmarking / rankings).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

type Creator = {
  user_id: string;
  name: string;
  avatar_url?: string;
  category?: string;
  region?: string;
  followers?: number;
  engagement_rate?: number;
  rating_avg?: number;
  pricing?: { post?: number };
  verified?: boolean;
};

function fmtCount(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function Discover() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      const [{ influencers }, cats] = await Promise.all([
        get<{ influencers: Creator[] }>(`/api/influencers?${params.toString()}`),
        categories.length === 0 ? get<{ categories: string[] }>('/api/categories') : Promise.resolve({ categories }),
      ]);
      setItems(influencers);
      if (categories.length === 0) setCategories((cats as any).categories);
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); setRefreshing(false); }
  }, [q, category, categories]);

  useEffect(() => { load(); }, [load]);

  const header = useMemo(() => (
    <View style={styles.header} testID="discover-header">
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.hello}>Hi {user?.name?.split(' ')[0] || 'there'} 👋</Text>
          <Text style={styles.hi}>Discover creators</Text>
        </View>
        <Pressable testID="rankings-button" onPress={() => router.push('/leaderboard')} style={styles.iconBtn}>
          <Ionicons name="trophy-outline" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="discover-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Search creators, niches, keywords"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          onSubmitEditing={load}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <Pressable
          testID="chip-all"
          onPress={() => setCategory(null)}
          style={[styles.chip, category === null && styles.chipActive]}
        >
          <Text style={[styles.chipText, category === null && styles.chipTextActive]}>All</Text>
        </Pressable>
        {categories.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              testID={`chip-${c.toLowerCase()}`}
              onPress={() => setCategory(active ? null : c)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ), [q, category, categories, user, router, load]);

  const renderCard = ({ item }: { item: Creator }) => (
    <Pressable
      testID={`creator-card-${item.user_id}`}
      onPress={() => router.push(`/creator/${item.user_id}`)}
      style={styles.card}
    >
      <Image
        source={{ uri: item.avatar_url }}
        style={styles.cardImage}
        placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(23,23,20,0.85)']}
        style={styles.cardScrim}
      />
      <View style={styles.cardOverlay}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.verified ? <Ionicons name="checkmark-circle" size={14} color={colors.accent} /> : null}
        </View>
        <Text style={styles.cardNiche} numberOfLines={1}>
          {item.category || 'Creator'} • {item.region || '—'}
        </Text>
        <View style={styles.rowBetween}>
          <View style={styles.metric}>
            <Ionicons name="people-outline" size={11} color="#fff" />
            <Text style={styles.metricText}>{fmtCount(item.followers)}</Text>
          </View>
          <View style={styles.metric}>
            <Ionicons name="star" size={11} color={colors.accent} />
            <Text style={styles.metricText}>{item.rating_avg?.toFixed(1) || '—'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="discover-screen">
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.user_id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl, gap: spacing.md }}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No creators found</Text>
              <Text style={styles.emptySub}>Try clearing the filters or another niche.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const CARD_H = 240;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  hello: { color: colors.muted, fontSize: font.size.sm },
  hi: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface2,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: font.size.base },
  chipsScroll: { marginTop: spacing.md, maxHeight: 56 },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center', height: 56 },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontSize: font.size.base, fontWeight: '500' },
  chipTextActive: { color: colors.onBrand },
  card: {
    flex: 1, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.surface3, ...shadow.card,
  },
  cardImage: { ...StyleSheet.absoluteFillObject as any },
  cardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  cardOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, gap: 2 },
  cardName: { color: '#fff', fontSize: font.size.lg, fontWeight: '500' },
  cardNiche: { color: '#fff', opacity: 0.8, fontSize: font.size.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { color: '#fff', fontSize: font.size.sm },
  empty: { alignItems: 'center', padding: spacing.xxxl },
  emptyTitle: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  emptySub: { color: colors.muted, marginTop: spacing.xs },
});
