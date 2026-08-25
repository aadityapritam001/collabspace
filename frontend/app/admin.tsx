/**
 * Admin panel — analytics + user management (verify/delete).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { del, get, patch } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function AdminPanel() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'influencer' | 'business'>('all');

  const load = useCallback(async () => {
    try {
      const [{ users }, s] = await Promise.all([
        get<any>(`/api/admin/users${filter === 'all' ? '' : `?role=${filter}`}`),
        get<any>('/api/admin/analytics'),
      ]);
      setUsers(users);
      setStats(s);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const verify = async (uid: string, current: boolean) => {
    await patch(`/api/admin/users/${uid}/verify`, { verified: !current });
    load();
  };
  const remove = async (uid: string) => {
    await del(`/api/admin/users/${uid}`);
    load();
  };

  if (user?.role !== 'admin') return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="admin-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Admin</Text>
        <Pressable onPress={logout} testID="admin-logout" style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={16} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: '500' }}>Sign out</Text>
        </Pressable>
      </View>

      {stats ? (
        <View style={styles.statsGrid}>
          <Stat k="Users" v={stats.users} />
          <Stat k="Creators" v={stats.influencers} />
          <Stat k="Brands" v={stats.businesses} />
          <Stat k="Requests" v={stats.requests} />
          <Stat k="Deals" v={stats.finalized_deals} />
          <Stat k="Revenue" v={`₹${stats.revenue_inr}`} />
        </View>
      ) : null}

      <View style={styles.filterRow}>
        {(['all', 'influencer', 'business'] as const).map((f) => (
          <Pressable key={f} testID={`admin-filter-${f}`} onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && { color: colors.onBrand }]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.role} • {item.email}</Text>
              </View>
              <Pressable testID={`verify-${item.user_id}`} onPress={() => verify(item.user_id, !!item.verified)}
                style={[styles.smallBtn, { backgroundColor: item.verified ? colors.success : colors.surface2 }]}>
                <Text style={[styles.smallText, item.verified && { color: '#fff' }]}>{item.verified ? 'Verified' : 'Verify'}</Text>
              </Pressable>
              <Pressable testID={`delete-${item.user_id}`} onPress={() => remove(item.user_id)} style={styles.smallBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ k, v }: { k: string; v: any }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statV}>{v}</Text>
      <Text style={styles.statK}>{k}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderWidth: 1, borderColor: colors.error, borderRadius: radius.pill },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  statBox: { width: '31%', backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statV: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  statK: { color: colors.muted, marginTop: 2, fontSize: font.size.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { color: colors.onSurface, textTransform: 'capitalize', fontWeight: '500' },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { color: colors.onSurface, fontWeight: '500' },
  sub: { color: colors.muted, fontSize: font.size.sm, marginTop: 2 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  smallText: { color: colors.onSurface, fontWeight: '500', fontSize: font.size.sm },
});
