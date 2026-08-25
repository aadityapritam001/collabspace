/**
 * Profile — dark theme with verification & saved-searches quick actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [verification, setVerification] = useState<any>(null);

  const loadVerification = useCallback(async () => {
    if (user?.role !== 'influencer') return;
    try {
      const { verification } = await get<any>('/api/verifications/me');
      setVerification(verification);
    } catch {}
  }, [user?.role]);

  useFocusEffect(useCallback(() => { loadVerification(); }, [loadVerification]));
  useEffect(() => { loadVerification(); }, [loadVerification]);

  if (!user) return null;

  const verStatus =
    user.verified ? 'verified' :
    verification?.status === 'pending' ? 'pending' :
    verification?.status === 'rejected' ? 'rejected' : 'unverified';

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.headerCard}>
          <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
          <View style={styles.avatarWrap}>
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }} contentFit="cover" />
            {user.verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={12} color={colors.onBrand} />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name}>{user.name}</Text>
              {user.verified ? <Ionicons name="checkmark-circle" size={16} color={colors.accent} /> : null}
            </View>
            <Text style={styles.role}>
              {user.role === 'influencer' ? user.category || 'Creator' : user.industry || 'Brand'}
              {user.region ? ` • ${user.region}` : ''}
            </Text>
            <Pressable testID="edit-profile-button" onPress={() => router.push('/edit-profile')} style={{ marginTop: spacing.sm }}>
              <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.editBtn}>
                <Text style={styles.editText}>Edit profile</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* Verification banner (creators only) */}
        {user.role === 'influencer' ? (
          <Pressable testID="verification-banner" onPress={() => router.push('/verification')} style={[styles.card, styles.verificationRow]}>
            <View style={[styles.verIcon, verStatus === 'verified' && { backgroundColor: colors.success + '33' }]}>
              <Ionicons
                name={verStatus === 'verified' ? 'shield-checkmark' : verStatus === 'pending' ? 'time-outline' : 'shield-outline'}
                size={22}
                color={verStatus === 'verified' ? colors.success : verStatus === 'pending' ? colors.warning : colors.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verTitle}>
                {verStatus === 'verified' ? 'You are verified' :
                 verStatus === 'pending' ? 'Verification pending' :
                 verStatus === 'rejected' ? 'Verification rejected — resubmit' :
                 'Get verified'}
              </Text>
              <Text style={styles.verSub}>
                {verStatus === 'verified' ? 'Your profile shows a verified badge in Discover.' :
                 verStatus === 'pending' ? 'Our team is reviewing your ID + social proof.' :
                 verStatus === 'rejected' ? verification?.review_reason || 'Please resubmit with clearer proof.' :
                 'Upload ID + social links to earn a premium badge that boosts trust.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        ) : null}

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
            <Row k="Brand name" v={user.brand_name || user.name || '—'} />
            <Row k="Industry" v={user.industry || '—'} />
            <Row k="Website" v={user.website || '—'} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>Quick actions</Text>
          <ActionRow icon="briefcase-outline" label="My campaigns" onPress={() => router.push('/campaigns')} testID="campaigns-link" />
          <ActionRow icon="trophy-outline" label="Rankings & leaderboard" onPress={() => router.push('/leaderboard')} testID="leaderboard-link" />
          {user.role === 'business' ? (
            <ActionRow icon="bookmark-outline" label="Saved searches" onPress={() => router.push('/saved-searches')} testID="saved-searches-link" />
          ) : null}
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
      <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceMuted} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  headerCard: {
    flexDirection: 'row', gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl,
    alignItems: 'center', overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: colors.surface3, borderWidth: 2, borderColor: colors.brand },
  verifiedBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  name: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '700' },
  role: { color: colors.onSurfaceMuted, marginTop: 2 },
  editBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', alignSelf: 'flex-start' },
  editText: { color: colors.onBrand, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.soft, marginHorizontal: spacing.lg, marginTop: spacing.md,
  },
  section: { fontSize: font.size.base, color: colors.onSurfaceMuted, marginBottom: spacing.sm, fontWeight: '500' },
  metricsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metricBox: { flex: 1, backgroundColor: colors.surface3, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  metricVal: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '700' },
  metricLabel: { color: colors.onSurfaceMuted, marginTop: 2, fontSize: font.size.sm },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceTag: { backgroundColor: colors.surface3, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  priceKey: { color: colors.onSurfaceMuted, textTransform: 'capitalize', fontSize: font.size.sm },
  priceVal: { color: colors.accent, fontWeight: '700', marginTop: 2 },
  muted: { color: colors.onSurfaceMuted },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvKey: { color: colors.onSurfaceMuted },
  kvVal: { color: colors.onSurface, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionText: { color: colors.onSurface, fontSize: font.size.base, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.lg, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.error,
  },
  logoutText: { color: colors.error, fontWeight: '700' },
  verificationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  verIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  verTitle: { color: colors.onSurface, fontWeight: '700', fontSize: font.size.base },
  verSub: { color: colors.onSurfaceMuted, fontSize: font.size.sm, marginTop: 2 },
});
