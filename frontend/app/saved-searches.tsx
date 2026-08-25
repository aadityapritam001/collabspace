/**
 * Saved Searches — brand-side one-tap filter presets.
 * Tap to apply on Discover; long-press or trash button to delete.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { del, get } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function SavedSearches() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { saved_searches } = await get<any>('/api/saved-searches');
      setItems(saved_searches);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await del(`/api/saved-searches/${id}`);
    load();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="saved-searches-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Saved searches</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.search_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`saved-${item.search_id}`}>
              <View style={styles.iconWrap}>
                <Ionicons name="bookmark" size={18} color={colors.accent} />
              </View>
              <Pressable style={{ flex: 1 }} onPress={() => router.push('/(tabs)/discover')}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {[item.filters?.category, item.filters?.region, item.filters?.q].filter(Boolean).join(' • ') || 'All creators'}
                </Text>
              </Pressable>
              <Pressable testID={`delete-${item.search_id}`} onPress={() => remove(item.search_id)} style={styles.trashBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={40} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>No saved searches yet</Text>
              <Text style={styles.emptySub}>Filter on Discover and tap "Save this search" to keep it here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  iconWrap: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.onSurface, fontWeight: '700', fontSize: font.size.base },
  sub: { color: colors.onSurfaceMuted, marginTop: 2, fontSize: font.size.sm },
  trashBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: font.size.lg, fontWeight: '700', color: colors.onSurface },
  emptySub: { color: colors.onSurfaceMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
});
