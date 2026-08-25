/**
 * Campaign creation form (POST /api/campaigns).
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { post } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function NewCampaign() {
  const { request_id } = useLocalSearchParams<{ request_id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [price, setPrice] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      await post('/api/campaigns', {
        request_id, title, deliverables,
        price: Number(price) || 0,
        deadline: deadline || undefined,
      });
      router.replace('/campaigns');
    } catch (e: any) {
      setErr(e.detail || 'Could not create campaign');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="new-campaign-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Start a campaign</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={styles.label}>Campaign title</Text>
          <TextInput testID="campaign-title-input" value={title} onChangeText={setTitle}
            placeholder="Summer skincare launch" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Deliverables</Text>
          <TextInput testID="campaign-deliverables-input" value={deliverables} onChangeText={setDeliverables} multiline
            placeholder="2 reels + 3 stories in 10 days"
            placeholderTextColor={colors.muted} style={[styles.input, { height: 90 }]} />
          <Text style={styles.label}>Price (₹)</Text>
          <TextInput testID="campaign-price-input" keyboardType="number-pad" value={price} onChangeText={setPrice}
            placeholder="25000" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
          <TextInput testID="campaign-deadline-input" value={deadline} onChangeText={setDeadline}
            placeholder="2026-06-30" placeholderTextColor={colors.muted} style={styles.input} />
          {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
          <Pressable testID="campaign-submit-button" onPress={submit}
            disabled={saving || !title || !deliverables || !price}
            style={[styles.primary, (!title || !deliverables || !price || saving) && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create campaign</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  label: { color: colors.muted, marginTop: spacing.sm, fontSize: font.size.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, backgroundColor: colors.surface2,
    fontSize: font.size.base,
  },
  primary: {
    marginTop: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: spacing.md + 2, alignItems: 'center', ...shadow.soft,
  },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
});
