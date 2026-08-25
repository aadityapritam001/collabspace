/**
 * Requests tab — incoming/outgoing collab requests with accept/reject actions.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get, patch } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

type Req = {
  request_id: string;
  from_user_id: string;
  to_user_id: string;
  conversation_id: string;
  message: string;
  budget?: number;
  status: string;
  contact_unlocked: boolean;
  from_user?: { name?: string; avatar_url?: string; role?: string };
  to_user?: { name?: string; avatar_url?: string; role?: string };
  created_at?: string;
};

export default function Requests() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { requests } = await get<{ requests: Req[] }>(`/api/requests?box=${tab}`);
      setItems(requests);
    } finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, status: 'accepted' | 'rejected') => {
    await patch(`/api/requests/${id}`, { status });
    load();
  };

  const renderItem = ({ item }: { item: Req }) => {
    const peer = tab === 'incoming' ? item.from_user : item.to_user;
    return (
      <Pressable
        testID={`request-item-${item.request_id}`}
        onPress={() => router.push(`/chat/${item.conversation_id}`)}
        style={styles.card}
      >
        <Image source={{ uri: peer?.avatar_url }} style={styles.avatar} placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{peer?.name || 'User'}</Text>
            <StatusPill status={item.status} unlocked={item.contact_unlocked} />
          </View>
          <Text style={styles.msg} numberOfLines={2}>{item.message}</Text>
          <View style={styles.metaRow}>
            {item.budget ? <Text style={styles.meta}>₹{item.budget.toLocaleString('en-IN')}</Text> : null}
            {tab === 'incoming' && item.status === 'pending' ? (
              <View style={styles.actions}>
                <Pressable testID={`accept-${item.request_id}`} onPress={() => respond(item.request_id, 'accepted')} style={styles.acceptBtn}>
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable testID={`reject-${item.request_id}`} onPress={() => respond(item.request_id, 'rejected')} style={styles.rejectBtn}>
                  <Text style={styles.rejectText}>Reject</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="requests-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Requests</Text>
        <View style={styles.segment}>
          <Pressable testID="tab-incoming" onPress={() => setTab('incoming')} style={[styles.segBtn, tab === 'incoming' && styles.segActive]}>
            <Text style={[styles.segText, tab === 'incoming' && styles.segTextActive]}>Incoming</Text>
          </Pressable>
          <Pressable testID="tab-outgoing" onPress={() => setTab('outgoing')} style={[styles.segBtn, tab === 'outgoing' && styles.segActive]}>
            <Text style={[styles.segText, tab === 'outgoing' && styles.segTextActive]}>Outgoing</Text>
          </Pressable>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.request_id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-open-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>No requests yet</Text>
              <Text style={styles.emptySub}>{tab === 'incoming' ? 'When brands or creators reach out, you\'ll see them here.' : 'Start by discovering creators and sending your first pitch.'}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function StatusPill({ status, unlocked }: { status: string; unlocked: boolean }) {
  const label = unlocked ? 'Unlocked' : status;
  const bg = unlocked ? colors.success : status === 'accepted' ? colors.brandSoft : status === 'rejected' ? '#FADBD8' : colors.surface2;
  const fg = unlocked ? colors.onSuccess : status === 'accepted' ? colors.onBrandSoft : status === 'rejected' ? colors.error : colors.muted;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  segment: {
    flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill,
    padding: 4, marginTop: spacing.md, alignSelf: 'flex-start',
  },
  segBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill },
  segActive: { backgroundColor: colors.surface, ...shadow.soft },
  segText: { color: colors.muted, fontWeight: '500' },
  segTextActive: { color: colors.onSurface },
  card: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  msg: { color: colors.muted, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  meta: { color: colors.onSurface, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: { backgroundColor: colors.brand, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  acceptText: { color: colors.onBrand, fontWeight: '500' },
  rejectBtn: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  rejectText: { color: colors.muted, fontWeight: '500' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: font.size.xs, fontWeight: '500', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: font.size.lg, fontWeight: '500', color: colors.onSurface },
  emptySub: { color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
});
