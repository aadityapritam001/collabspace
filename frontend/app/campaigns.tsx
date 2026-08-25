/**
 * Campaigns list + creation flow.
 *   • /campaigns              -> list current user's campaigns
 *   • /campaign/new?request_id=... -> create a new campaign against a finalized request
 *   • /campaign/[id]          -> update status, add notes, submit review
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

type Campaign = {
  campaign_id: string;
  title: string;
  deliverables: string;
  price: number;
  status: string;
  deadline?: string;
  created_at: string;
};

export default function CampaignsIndex() {
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { campaigns } = await get<{ campaigns: Campaign[] }>('/api/campaigns');
      setItems(campaigns);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="campaigns-screen">
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>My campaigns</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.campaign_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`campaign-${item.campaign_id}`}
              onPress={() => router.push(`/campaign/${item.campaign_id}`)}
              style={styles.card}
            >
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.pill, item.status === 'completed' && { backgroundColor: colors.success + '33' }]}>
                  <Text style={[styles.pillText, item.status === 'completed' && { color: colors.onSuccess }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.deliv}>{item.deliverables}</Text>
              <View style={styles.row}>
                <Text style={styles.price}>₹{item.price.toLocaleString('en-IN')}</Text>
                {item.deadline ? <Text style={styles.deadline}>Due: {item.deadline}</Text> : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No campaigns yet</Text>
              <Text style={styles.emptySub}>Finalize a deal in chat and start your first campaign.</Text>
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
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  card: {
    padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, ...shadow.soft, gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  deliv: { color: colors.muted },
  price: { color: colors.brand, fontWeight: '500', fontSize: font.size.lg },
  deadline: { color: colors.muted, fontSize: font.size.sm },
  pill: { backgroundColor: colors.surface2, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { color: colors.muted, textTransform: 'capitalize', fontSize: font.size.xs, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: font.size.lg, fontWeight: '500', color: colors.onSurface },
  emptySub: { color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
});
