/**
 * Discover — dark theme, verified badge, saved-search chips, and "Save this
 * search" FAB. Businesses can one-tap a saved search to jump straight to the
 * exact filter combo they curated earlier.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { del, get, post } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

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

type SavedSearch = { search_id: string; name: string; filters: Record<string, any> };

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
  const [region, setRegion] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [items, setItems] = useState<Creator[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [saveName, setSaveName] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (region) params.set('region', region);
      const [{ influencers }] = await Promise.all([
        get<{ influencers: Creator[] }>(`/api/influencers?${params.toString()}`),
      ]);
      setItems(influencers);
      if (categories.length === 0) {
        const [c, r, s] = await Promise.all([
          get<{ categories: string[] }>('/api/categories'),
          get<{ regions: string[] }>('/api/regions'),
          get<{ saved_searches: SavedSearch[] }>('/api/saved-searches').catch(() => ({ saved_searches: [] as SavedSearch[] })),
        ]);
        setCategories(c.categories);
        setRegions(r.regions);
        setSaved(s.saved_searches);
      } else {
        // Refresh saved on each load to reflect edits
        const s = await get<{ saved_searches: SavedSearch[] }>('/api/saved-searches').catch(() => ({ saved_searches: [] as SavedSearch[] }));
        setSaved(s.saved_searches);
      }
    } catch (e) {
      console.warn(e);
    } finally { setLoading(false); setRefreshing(false); }
  }, [q, category, region, categories.length]);

  useEffect(() => { load(); }, [load]);

  const applySaved = (s: SavedSearch) => {
    setQ(s.filters?.q || '');
    setCategory(s.filters?.category || null);
    setRegion(s.filters?.region || null);
  };

  const saveCurrent = async () => {
    if (!saveName.trim()) return;
    await post('/api/saved-searches', {
      name: saveName.trim(),
      filters: { q, category, region },
    });
    setSaveName('');
    setSavingModal(false);
    load();
  };

  const removeSaved = async (id: string) => {
    await del(`/api/saved-searches/${id}`);
    load();
  };

  const header = useMemo(() => (
    <View style={styles.header} testID="discover-header">
      <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
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
          value={q} onChangeText={setQ}
          placeholder="Search creators, niches, keywords"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          onSubmitEditing={load}
          returnKeyType="search"
        />
      </View>

      {saved.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow} style={styles.savedScroll}>
          {saved.map((s) => (
            <Pressable key={s.search_id} testID={`saved-${s.search_id}`} onLongPress={() => removeSaved(s.search_id)} onPress={() => applySaved(s)} style={styles.savedChip}>
              <Ionicons name="bookmark" size={12} color={colors.accent} />
              <Text style={styles.savedText}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}
      >
        <Pressable testID="chip-all" onPress={() => { setCategory(null); setRegion(null); }}
          style={[styles.chip, category === null && region === null && styles.chipActive]}>
          <Text style={[styles.chipText, category === null && region === null && styles.chipTextActive]}>All</Text>
        </Pressable>
        {categories.map((c) => {
          const active = category === c;
          return (
            <Pressable key={c} testID={`chip-${c.toLowerCase()}`} onPress={() => setCategory(active ? null : c)}
              style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  ), [q, category, region, categories, saved, user, router, load]);

  const renderCard = ({ item }: { item: Creator }) => (
    <Pressable
      testID={`creator-card-${item.user_id}`}
      onPress={() => router.push(`/creator/${item.user_id}`)}
      style={styles.card}
    >
      <Image
        source={{ uri: item.avatar_url }}
        style={StyleSheet.absoluteFillObject as any}
        placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }}
        contentFit="cover" transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(15,11,31,0.95)']}
        style={styles.cardScrim}
      />
      <View style={styles.cardOverlay}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          {item.verified ? (
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={12} color={colors.accent} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
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

  const hasFilters = q || category || region;

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
          contentContainerStyle={{ paddingBottom: 120, gap: spacing.md }}
          ListHeaderComponent={header}
          stickyHeaderIndices={[0]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={36} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyTitle}>No creators found</Text>
              <Text style={styles.emptySub}>Try clearing the filters or another niche.</Text>
            </View>
          }
        />
      )}

      {hasFilters ? (
        <Pressable testID="save-search-fab" onPress={() => setSavingModal(true)} style={styles.fab}>
          <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabInner}>
            <Ionicons name="bookmark" size={18} color={colors.onBrand} />
            <Text style={styles.fabText}>Save this search</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      <Modal transparent visible={savingModal} animationType="slide" onRequestClose={() => setSavingModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setSavingModal(false)} />
        <View style={styles.modalCard} testID="save-search-modal">
          <Text style={styles.modalTitle}>Save this search</Text>
          <Text style={styles.modalSub}>Give it a name so you can tap it later.</Text>
          <TextInput
            testID="save-search-name-input"
            value={saveName} onChangeText={setSaveName}
            placeholder="e.g. Mumbai fashion under 20k"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable testID="save-search-confirm" onPress={saveCurrent} disabled={!saveName.trim()}
            style={{ marginTop: spacing.md }}>
            <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
              <Text style={styles.primaryText}>Save</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CARD_H = 240;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md, overflow: 'hidden' },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  hello: { color: colors.onSurfaceMuted, fontSize: font.size.sm },
  hi: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700' },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  searchBox: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface2,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 44,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: font.size.base },
  savedScroll: { marginTop: spacing.sm, maxHeight: 42 },
  savedRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center', height: 42 },
  savedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brand,
  },
  savedText: { color: colors.onBrandSoft, fontWeight: '500', fontSize: font.size.sm },
  chipsScroll: { marginTop: spacing.sm, maxHeight: 56 },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center', height: 56 },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.onSurface, fontSize: font.size.base, fontWeight: '500' },
  chipTextActive: { color: colors.onBrand, fontWeight: '700' },
  card: {
    flex: 1, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.surface3, ...shadow.card,
  },
  cardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  cardOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, gap: 2 },
  cardName: { color: '#fff', fontSize: font.size.lg, fontWeight: '700' },
  cardNiche: { color: '#fff', opacity: 0.85, fontSize: font.size.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: colors.accent },
  verifiedText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { color: '#fff', fontSize: font.size.sm },
  empty: { alignItems: 'center', padding: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '700' },
  emptySub: { color: colors.onSurfaceMuted, marginTop: spacing.xs },
  fab: { position: 'absolute', bottom: 80, right: spacing.lg, borderRadius: radius.pill, ...shadow.glow },
  fabInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.pill },
  fabText: { color: colors.onBrand, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '700' },
  modalSub: { color: colors.onSurfaceMuted, fontSize: font.size.base },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, backgroundColor: colors.surface3,
    fontSize: font.size.base, marginTop: spacing.sm,
  },
  primary: { borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '700' },
});
