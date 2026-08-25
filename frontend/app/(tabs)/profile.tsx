/**
 * Profile tab — user's own profile summary + quick actions.
 * Shows role-specific data (creator: pricing/reach; brand: industry/website).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.headerCard}>
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.name}>{user.name}</Text>
              {user.verified ? <Ionicons name="checkmark-circle" size={16} color={colors.accent} /> : null}
            </View>
            <Text style={styles.role}>
              {user.role === 'influencer' ? user.category || 'Creator' : user.industry || 'Brand'}
              {user.region ? ` • ${user.region}` : ''}
            </Text>
            <Pressable testID="edit-profile-button" onPress={() => router.push('/edit-profile')} style={styles.editBtn}>
              <Text style={styles.editText}>Edit profile</Text>
            </Pressable>
          </View>
        </View>

        {user.role === 'influencer' ? (
          <View style={styles.card}>
            <Text style={styles.section}>Reach & rating</Text>
            <View style={styles.metricsRow}>
              <Metric label="Followers" value={(user.followers || 0).toLocaleString('en-IN')} />
              <Metric label="Engagement" value={`${user.engagement_rate || 0}%`} />
              <Metric label="Rating" value={(user.rating_avg || 0).toFixed(1)} />
            </View>
            <Text style={styles.section}>Pricing</Text>
            <View style={styles.priceRow}>
              {Object.entries(user.pricing || {}).map(([k, v]) => (
                <View key={k} style={styles.priceTag}>
                  <Text style={styles.priceKey}>{k}</Text>
                  <Text style={styles.priceVal}>₹{Number(v).toLocaleString('en-IN')}</Text>
                </View>
              ))}
              {(!user.pricing || Object.keys(user.pricing).length === 0) ? (
                <Text style={styles.muted}>Add your rate card in edit profile.</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.section}>Brand details</Text>
            <Row k="Brand name" v={user.brand_name || user.name} />
            <Row k="Industry" v={user.industry || '—'} />
            <Row k="Website" v={user.website || '—'} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>Quick actions</Text>
          <ActionRow icon="briefcase-outline" label="My campaigns" onPress={() => router.push('/campaigns')} testID="campaigns-link" />
          <ActionRow icon="trophy-outline" label="Rankings & leaderboard" onPress={() => router.push('/leaderboard')} testID="leaderboard-link" />
          {user.role === 'admin' ? (
            <ActionRow icon="shield-checkmark-outline" label="Admin panel" onPress={() => router.push('/admin')} testID="admin-link" />
          ) : null}
        </View>

        <Pressable testID="logout-button" onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricVal}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}
function ActionRow({ icon, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.actionRow}>
      <Ionicons name={icon} size={18} color={colors.onSurface} />
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  headerCard: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: colors.brandSoft, alignItems: 'center', marginBottom: spacing.md,
  },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '500' },
  role: { color: colors.muted, marginTop: 2 },
  editBtn: {
    marginTop: spacing.sm, backgroundColor: colors.brand, alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
  },
  editText: { color: colors.onBrand, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.soft, marginTop: spacing.md,
  },
  section: { fontSize: font.size.base, color: colors.muted, marginBottom: spacing.sm, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metricBox: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  metricVal: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  metricLabel: { color: colors.muted, marginTop: 2, fontSize: font.size.sm },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceTag: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  priceKey: { color: colors.muted, textTransform: 'capitalize', fontSize: font.size.sm },
  priceVal: { color: colors.onSurface, fontWeight: '500', marginTop: 2 },
  muted: { color: colors.muted },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvKey: { color: colors.muted },
  kvVal: { color: colors.onSurface, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionText: { color: colors.onSurface, fontSize: font.size.base, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontWeight: '500' },
});
