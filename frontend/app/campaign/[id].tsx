/**
 * Campaign detail — update status, add notes, submit rating/review on completion.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get, patch, post } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

const STATUSES = ['active', 'delivered', 'completed', 'cancelled'] as const;

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  const load = useCallback(async () => {
    const { campaigns } = await get<any>('/api/campaigns');
    const found = campaigns.find((x: any) => x.campaign_id === id);
    setC(found);
    setNotes(found?.notes || '');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (s: string) => {
    await patch(`/api/campaigns/${id}`, { status: s, notes });
    load();
  };

  const submitReview = async () => {
    if (!rating) return;
    await post('/api/reviews', { campaign_id: id, rating, comment: review });
    router.back();
  };

  if (!c) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="campaign-detail">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }}>
        <View style={styles.card}>
          <Text style={styles.section}>Deliverables</Text>
          <Text style={styles.body}>{c.deliverables}</Text>
          <Text style={styles.section}>Price</Text>
          <Text style={styles.body}>₹{c.price.toLocaleString('en-IN')}</Text>
          {c.deadline ? (<><Text style={styles.section}>Deadline</Text><Text style={styles.body}>{c.deadline}</Text></>) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((s) => (
              <Pressable key={s} testID={`status-${s}`} onPress={() => setStatus(s)}
                style={[styles.statusChip, c.status === s && styles.statusActive]}>
                <Text style={[styles.statusText, c.status === s && { color: colors.onBrand }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.section}>Notes</Text>
          <TextInput testID="campaign-notes-input" value={notes} onChangeText={setNotes} multiline
            placeholder="Add updates, links, or files"
            placeholderTextColor={colors.muted}
            style={[styles.input, { height: 100 }]} />
          <Pressable testID="save-notes-button" onPress={() => setStatus(c.status)} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save notes</Text>
          </Pressable>
        </View>

        {c.status === 'completed' ? (
          <View style={styles.card}>
            <Text style={styles.section}>Rate this collaboration</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} testID={`star-${i}`} onPress={() => setRating(i)}>
                  <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={28} color={colors.accent} />
                </Pressable>
              ))}
            </View>
            <TextInput testID="review-input" value={review} onChangeText={setReview} multiline
              placeholder="Share your feedback..."
              placeholderTextColor={colors.muted}
              style={[styles.input, { height: 90 }]} />
            <Pressable testID="submit-review-button" onPress={submitReview}
              style={[styles.primary, !rating && { opacity: 0.6 }]}>
              <Text style={styles.primaryText}>Submit review</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '500', flex: 1 },
  card: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.soft, gap: 6 },
  section: { color: colors.muted, marginTop: spacing.sm, fontWeight: '500' },
  body: { color: colors.onSurface, fontSize: font.size.base },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  statusActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  statusText: { color: colors.onSurface, textTransform: 'capitalize', fontWeight: '500' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.onSurface, backgroundColor: colors.surface2 },
  saveBtn: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.surface2, marginTop: spacing.sm },
  saveText: { color: colors.onSurface, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  primary: { marginTop: spacing.md, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: colors.onBrand, fontWeight: '500', fontSize: font.size.lg },
});
