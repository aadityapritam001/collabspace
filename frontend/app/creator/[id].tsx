/**
 * Creator detail — hero banner, metrics, pricing tiers, portfolio, "Send Request" sticky CTA.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { get, post } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function CreatorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [creator, setCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [budget, setBudget] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await get<{ user: any }>(`/api/users/${id}`);
        setCreator(user);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const send = async () => {
    setSending(true);
    try {
      const { request } = await post<{ request: any }>('/api/requests', {
        to_user_id: id, message: msg,
        budget: budget ? Number(budget) : undefined,
        deliverables: deliverables || undefined,
      });
      setShowModal(false);
      router.push(`/chat/${request.conversation_id}`);
    } catch (e: any) {
      // fallback: show alert-like text
      console.warn(e);
    } finally { setSending(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;
  if (!creator) return <View style={styles.center}><Text>Not found</Text></View>;

  const canRequest = user?.user_id !== creator.user_id;

  return (
    <View style={styles.container} testID="creator-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <Image source={{ uri: creator.avatar_url }} style={styles.heroImg} contentFit="cover" placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }} />
          <LinearGradient colors={['transparent', 'rgba(23,23,20,0.9)']} style={styles.heroScrim} />
          <SafeAreaView edges={['top']} style={styles.heroTop}>
            <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.heroName}>{creator.name}</Text>
              {creator.verified ? <Ionicons name="checkmark-circle" size={18} color={colors.accent} /> : null}
            </View>
            <Text style={styles.heroSub}>{creator.category} • {creator.region}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.metricsRow}>
            <View style={styles.metric}><Text style={styles.mv}>{fmtCount(creator.followers)}</Text><Text style={styles.ml}>Followers</Text></View>
            <View style={styles.metric}><Text style={styles.mv}>{creator.engagement_rate || 0}%</Text><Text style={styles.ml}>Engagement</Text></View>
            <View style={styles.metric}><Text style={styles.mv}>⭐ {creator.rating_avg?.toFixed(1) || '—'}</Text><Text style={styles.ml}>Rating</Text></View>
          </View>

          {creator.bio ? <Text style={styles.bio}>{creator.bio}</Text> : null}

          <Text style={styles.section}>Available on</Text>
          <View style={styles.chipsRow}>
            {(creator.platforms || []).map((p: string) => (
              <View key={p} style={styles.platChip}><Text style={styles.platText}>{p}</Text></View>
            ))}
          </View>

          <Text style={styles.section}>Pricing</Text>
          <View style={{ gap: spacing.sm }}>
            {Object.entries(creator.pricing || {}).map(([k, v]) => (
              <View key={k} style={styles.priceCard}>
                <View>
                  <Text style={styles.priceKind}>{k}</Text>
                  <Text style={styles.priceHint}>per {k}</Text>
                </View>
                <Text style={styles.priceValue}>₹{Number(v).toLocaleString('en-IN')}</Text>
              </View>
            ))}
            {(!creator.pricing || Object.keys(creator.pricing).length === 0) ? (
              <Text style={styles.muted}>No pricing published yet.</Text>
            ) : null}
          </View>

          <Text style={styles.section}>Contact unlock fee</Text>
          <View style={styles.unlockBox}>
            <Ionicons name="lock-closed" size={16} color={colors.onBrandSoft} />
            <Text style={styles.unlockText}>
              ₹{creator.unlock_tier === 'gold' ? 99 : creator.unlock_tier === 'silver' ? 49 : 10} after finalizing a deal.
            </Text>
          </View>
        </View>
      </ScrollView>

      {canRequest ? (
        <View style={styles.stickyBar} pointerEvents="box-none">
          <Pressable testID="send-request-button" onPress={() => setShowModal(true)} style={styles.stickyCta}>
            <Text style={styles.stickyText}>Send collaboration request</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal transparent visible={showModal} animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowModal(false)} />
        <View style={styles.modalCard} testID="send-request-modal">
          <Text style={styles.modalTitle}>Pitch to {creator.name}</Text>
          <Text style={styles.label}>Message</Text>
          <TextInput testID="request-message-input" value={msg} onChangeText={setMsg} multiline
            placeholder="Hi! I'd love to work together on..."
            placeholderTextColor={colors.muted} style={[styles.input, { height: 90 }]} />
          <Text style={styles.label}>Budget (₹)</Text>
          <TextInput testID="request-budget-input" keyboardType="number-pad" value={budget} onChangeText={setBudget}
            placeholder="10000" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Deliverables</Text>
          <TextInput testID="request-deliverables-input" value={deliverables} onChangeText={setDeliverables}
            placeholder="1 reel + 2 stories" placeholderTextColor={colors.muted} style={styles.input} />
          <Pressable testID="submit-request-button" disabled={sending || !msg.trim()} onPress={send}
            style={[styles.stickyCta, (!msg.trim() || sending) && { opacity: 0.6 }]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.stickyText}>Send request</Text>}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function fmtCount(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  hero: { height: 320, backgroundColor: colors.surface3 },
  heroImg: { ...(StyleSheet.absoluteFillObject as any) },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0, padding: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroInfo: { position: 'absolute', bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  heroName: { color: '#fff', fontSize: font.size.xxl, fontWeight: '500' },
  heroSub: { color: '#fff', opacity: 0.9, marginTop: 4 },
  body: { padding: spacing.lg, gap: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  mv: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  ml: { color: colors.muted, marginTop: 2, fontSize: font.size.sm },
  bio: { color: colors.onSurface, fontSize: font.size.base, lineHeight: 20 },
  section: { fontSize: font.size.base, color: colors.muted, marginTop: spacing.md, fontWeight: '500' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  platChip: { backgroundColor: colors.surface2, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  platText: { color: colors.onSurface, textTransform: 'capitalize', fontWeight: '500' },
  priceCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, backgroundColor: colors.surface2, borderRadius: radius.md,
  },
  priceKind: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500', textTransform: 'capitalize' },
  priceHint: { color: colors.muted, fontSize: font.size.sm },
  priceValue: { fontSize: font.size.lg, color: colors.brand, fontWeight: '500' },
  muted: { color: colors.muted },
  unlockBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.brandSoft, padding: spacing.md, borderRadius: radius.md,
  },
  unlockText: { color: colors.onBrandSoft, fontWeight: '500' },
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md,
    backgroundColor: 'rgba(252,252,250,0.95)', borderTopWidth: 1, borderTopColor: colors.border,
  },
  stickyCta: {
    backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  stickyText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, gap: spacing.sm,
  },
  modalTitle: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '500' },
  label: { color: colors.muted, marginTop: spacing.sm, fontSize: font.size.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, backgroundColor: colors.surface2,
    fontSize: font.size.base,
  },
});
