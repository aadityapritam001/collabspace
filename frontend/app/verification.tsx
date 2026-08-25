/**
 * Verification screen — creators upload a Government ID photo and their
 * Instagram/YouTube profile links. On submit the file goes to Emergent Object
 * Storage and the record is saved server-side for admin review.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get, post } from '@/src/api/client';
import { fileUrl, pickImageAndUpload } from '@/src/api/upload';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

export default function Verification() {
  const router = useRouter();
  const { user } = useAuth();
  const [existing, setExisting] = useState<any>(null);
  const [fullName, setFullName] = useState(user?.name || '');
  const [idPath, setIdPath] = useState<string | null>(null);
  const [fileToken, setFileToken] = useState<string | null>(null);
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { verification } = await get<any>('/api/verifications/me');
      if (verification) {
        setExisting(verification);
        setFullName(verification.full_name || user?.name || '');
        setIdPath(verification.id_document_path || null);
        setInstagram(verification.social_links?.instagram || '');
        setYoutube(verification.social_links?.youtube || '');
        setNotes(verification.notes || '');
      }
    } catch {}
  }, [user?.name]);

  useEffect(() => { load(); }, [load]);

  const pickId = async () => {
    setErr(null); setUploading(true);
    try {
      const uploaded = await pickImageAndUpload();
      if (uploaded) {
        setIdPath(uploaded.path);
        setFileToken(uploaded.file_token);
      }
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const submit = async () => {
    setErr(null);
    if (!idPath) { setErr('Please upload your ID photo'); return; }
    if (!instagram && !youtube) { setErr('Add at least one social profile link'); return; }
    if (!fullName.trim()) { setErr('Full name is required'); return; }
    setSaving(true);
    try {
      await post('/api/verifications', {
        full_name: fullName.trim(),
        id_document_path: idPath,
        id_document_type: 'government_id',
        social_links: {
          ...(instagram ? { instagram } : {}),
          ...(youtube ? { youtube } : {}),
        },
        notes: notes || undefined,
      });
      router.back();
    } catch (e: any) {
      setErr(e?.detail || 'Submission failed');
    } finally { setSaving(false); }
  };

  const readOnly = existing?.status === 'pending' || existing?.status === 'approved';
  const statusPill = existing ? (
    <View style={[
      styles.pill,
      existing.status === 'approved' && { backgroundColor: colors.success + '33' },
      existing.status === 'pending' && { backgroundColor: colors.warning + '33' },
      existing.status === 'rejected' && { backgroundColor: colors.error + '33' },
    ]}>
      <Text style={[
        styles.pillText,
        existing.status === 'approved' && { color: colors.success },
        existing.status === 'pending' && { color: colors.warning },
        existing.status === 'rejected' && { color: colors.error },
      ]}>{existing.status}</Text>
    </View>
  ) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="verification-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Get verified</Text>
        {statusPill}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Ionicons name="shield-checkmark" size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Earn the verified badge</Text>
              <Text style={styles.heroSub}>Upload a Government ID and one social profile link. Our team reviews within 24 hours.</Text>
            </View>
          </View>

          {existing?.status === 'rejected' && existing?.review_reason ? (
            <View style={styles.rejectBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={styles.rejectText}>Rejected: {existing.review_reason}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.section}>1. Government ID photo</Text>
            <Pressable testID="upload-id-button" onPress={pickId} disabled={readOnly || uploading} style={styles.uploadBox}>
              {idPath ? (
                <Image
                  source={{ uri: fileUrl(idPath, fileToken || undefined) }}
                  style={styles.preview}
                  contentFit="cover"
                />
              ) : (
                <>
                  {uploading ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="cloud-upload-outline" size={28} color={colors.onSurfaceMuted} />}
                  <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Tap to upload photo'}</Text>
                  <Text style={styles.uploadHint}>Aadhaar / PAN / Passport / DL — Front side only.</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>2. Full name (as on ID)</Text>
            <TextInput
              testID="verification-name-input"
              value={fullName} onChangeText={setFullName} editable={!readOnly}
              placeholder="Jane Doe" placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <Text style={styles.section}>3. Social profile links</Text>
            <View style={styles.inputRow}>
              <Ionicons name="logo-instagram" size={18} color={colors.onSurfaceMuted} />
              <TextInput
                testID="verification-instagram-input"
                value={instagram} onChangeText={setInstagram} editable={!readOnly}
                autoCapitalize="none" keyboardType="url"
                placeholder="https://instagram.com/yourhandle"
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <View style={styles.inputRow}>
              <Ionicons name="logo-youtube" size={18} color={colors.onSurfaceMuted} />
              <TextInput
                testID="verification-youtube-input"
                value={youtube} onChangeText={setYoutube} editable={!readOnly}
                autoCapitalize="none" keyboardType="url"
                placeholder="https://youtube.com/@yourchannel"
                placeholderTextColor={colors.muted}
                style={[styles.input, { flex: 1 }]}
              />
            </View>

            <Text style={styles.section}>4. Notes (optional)</Text>
            <TextInput
              testID="verification-notes-input"
              value={notes} onChangeText={setNotes} editable={!readOnly}
              multiline
              placeholder="Anything the reviewer should know"
              placeholderTextColor={colors.muted}
              style={[styles.input, { height: 80 }]}
            />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>

        {!readOnly ? (
          <View style={styles.stickyBar}>
            <Pressable testID="verification-submit" onPress={submit} disabled={saving}>
              <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.primary, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit for review</Text>}
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700', flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', ...shadow.glow },
  heroTitle: { color: '#fff', fontWeight: '700', fontSize: font.size.lg },
  heroSub: { color: '#fff', opacity: 0.9, marginTop: 2 },
  card: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.soft, gap: spacing.sm },
  section: { color: colors.onSurfaceMuted, marginTop: spacing.sm, fontWeight: '500' },
  uploadBox: {
    height: 200, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.borderStrong, backgroundColor: colors.surface3,
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  uploadText: { color: colors.onSurface, fontWeight: '500' },
  uploadHint: { color: colors.onSurfaceMuted, fontSize: font.size.sm, textAlign: 'center', paddingHorizontal: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.onSurface, backgroundColor: colors.surface3, fontSize: font.size.base },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  err: { color: colors.error, textAlign: 'center', marginTop: spacing.sm },
  stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  primary: { borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', ...shadow.glow },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '700' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  pillText: { fontSize: font.size.xs, fontWeight: '700', textTransform: 'capitalize', color: colors.onSurface },
  rejectBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.error + '22' },
  rejectText: { color: colors.error, flex: 1 },
});
