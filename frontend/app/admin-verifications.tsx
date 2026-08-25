/**
 * Admin — Verification review queue.
 * Lists pending submissions with the ID photo + social links, and Approve/Reject.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get, loadToken, patch } from '@/src/api/client';
import { fileUrl } from '@/src/api/upload';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';
import { Platform } from 'react-native';

type Verification = {
  verification_id: string;
  user_id: string;
  full_name: string;
  id_document_path: string;
  social_links: Record<string, string>;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  review_reason?: string;
  user?: { name?: string; avatar_url?: string; category?: string; region?: string };
};

export default function AdminVerifications() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Verification[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejecting, setRejecting] = useState<Verification | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { verifications } = await get<{ verifications: Verification[] }>(
        `/api/admin/verifications?status_filter=${filter}`,
      );
      setItems(verifications);
    } finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => {
    (async () => setToken(await loadToken()))();
    load();
  }, [load]);

  const approve = async (id: string) => {
    await patch(`/api/admin/verifications/${id}`, { status: 'approved' });
    load();
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    await patch(`/api/admin/verifications/${rejecting.verification_id}`, {
      status: 'rejected', reason: rejectReason || 'Insufficient proof',
    });
    setRejecting(null); setRejectReason('');
    load();
  };

  if (user?.role !== 'admin') return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="admin-verifications-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Verifications</Text>
      </View>

      <View style={styles.filterRow}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <Pressable key={f} testID={`vfilter-${f}`} onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && { color: colors.onBrand }]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.verification_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`verify-card-${item.verification_id}`}>
              <View style={styles.rowTop}>
                <Image source={{ uri: item.user?.avatar_url }} style={styles.avatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user?.name || item.full_name}</Text>
                  <Text style={styles.sub}>{item.user?.category} • {item.user?.region}</Text>
                </View>
                <View style={[
                  styles.pill,
                  item.status === 'approved' && { backgroundColor: colors.success + '33' },
                  item.status === 'pending' && { backgroundColor: colors.warning + '33' },
                  item.status === 'rejected' && { backgroundColor: colors.error + '33' },
                ]}>
                  <Text style={[
                    styles.pillText,
                    item.status === 'approved' && { color: colors.success },
                    item.status === 'pending' && { color: colors.warning },
                    item.status === 'rejected' && { color: colors.error },
                  ]}>{item.status}</Text>
                </View>
              </View>

              <Image
                source={{
                  uri: fileUrl(item.id_document_path),
                  headers: Platform.OS === 'web' ? undefined : token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                style={styles.idImage}
                contentFit="cover"
              />

              <View style={styles.socials}>
                {item.social_links?.instagram ? (
                  <View style={styles.socialChip}>
                    <Ionicons name="logo-instagram" size={14} color={colors.onSurfaceMuted} />
                    <Text style={styles.socialText} numberOfLines={1}>{item.social_links.instagram}</Text>
                  </View>
                ) : null}
                {item.social_links?.youtube ? (
                  <View style={styles.socialChip}>
                    <Ionicons name="logo-youtube" size={14} color={colors.onSurfaceMuted} />
                    <Text style={styles.socialText} numberOfLines={1}>{item.social_links.youtube}</Text>
                  </View>
                ) : null}
              </View>

              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              {item.review_reason ? <Text style={styles.reason}>Reviewer note: {item.review_reason}</Text> : null}

              {item.status === 'pending' ? (
                <View style={styles.actions}>
                  <Pressable testID={`reject-${item.verification_id}`} onPress={() => setRejecting(item)} style={styles.rejectBtn}>
                    <Text style={styles.rejectText}>Reject</Text>
                  </Pressable>
                  <Pressable testID={`approve-${item.verification_id}`} onPress={() => approve(item.verification_id)}>
                    <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.approveBtn}>
                      <Text style={styles.approveText}>Approve</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.onSurfaceMuted} />
              <Text style={styles.emptyText}>No submissions</Text>
              <Text style={styles.emptySub}>{filter === 'pending' ? 'You\'re all caught up.' : 'No records match this filter.'}</Text>
            </View>
          }
        />
      )}

      <Modal transparent visible={!!rejecting} animationType="slide" onRequestClose={() => setRejecting(null)}>
        <Pressable style={styles.modalBg} onPress={() => setRejecting(null)} />
        <View style={styles.modalCard} testID="reject-modal">
          <Text style={styles.modalTitle}>Reject verification</Text>
          <Text style={styles.modalSub}>Explain what needs to change.</Text>
          <TextInput
            testID="reject-reason-input"
            value={rejectReason} onChangeText={setRejectReason}
            placeholder="e.g. ID photo is blurry — please retake"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
          <Pressable testID="confirm-reject-button" onPress={confirmReject} style={styles.confirmReject}>
            <Text style={styles.confirmText}>Confirm rejection</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  filterText: { color: colors.onSurface, textTransform: 'capitalize', fontWeight: '500' },
  card: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, ...shadow.soft, gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { color: colors.onSurface, fontWeight: '700' },
  sub: { color: colors.onSurfaceMuted, fontSize: font.size.sm, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  pillText: { fontSize: font.size.xs, fontWeight: '700', textTransform: 'capitalize' },
  idImage: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.surface3 },
  socials: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  socialChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, maxWidth: '100%' },
  socialText: { color: colors.onSurfaceMuted, fontSize: font.size.sm, maxWidth: 220 },
  notes: { color: colors.onSurfaceMuted, fontStyle: 'italic' },
  reason: { color: colors.error, fontSize: font.size.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  rejectBtn: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.error },
  rejectText: { color: colors.error, fontWeight: '700' },
  approveBtn: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  approveText: { color: colors.onBrand, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: font.size.lg, fontWeight: '700', color: colors.onSurface },
  emptySub: { color: colors.onSurfaceMuted },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.onSurface, fontSize: font.size.xl, fontWeight: '700' },
  modalSub: { color: colors.onSurfaceMuted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, backgroundColor: colors.surface3, height: 90, marginTop: spacing.sm },
  confirmReject: { marginTop: spacing.md, backgroundColor: colors.error, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: font.size.lg },
});
