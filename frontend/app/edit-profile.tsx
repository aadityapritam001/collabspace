/**
 * Edit profile — updates user profile (role-aware fields).
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { put } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar_url || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [region, setRegion] = useState(user?.region || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [category, setCategory] = useState(user?.category || '');
  const [followers, setFollowers] = useState(String(user?.followers || ''));
  const [instagram, setInstagram] = useState(user?.social_handles?.instagram || '');
  const [youtube, setYoutube] = useState(user?.social_handles?.youtube || '');
  const [pricePost, setPricePost] = useState(String(user?.pricing?.post || ''));
  const [priceReel, setPriceReel] = useState(String(user?.pricing?.reel || ''));
  const [priceStory, setPriceStory] = useState(String(user?.pricing?.story || ''));
  const [tier, setTier] = useState(user?.unlock_tier || 'basic');
  const [brand, setBrand] = useState(user?.brand_name || '');
  const [industry, setIndustry] = useState(user?.industry || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { name, avatar_url: avatar, bio, region, phone };
      if (user?.role === 'influencer') {
        body.category = category;
        body.followers = Number(followers) || 0;
        body.unlock_tier = tier;
        body.social_handles = { instagram, youtube };
        body.pricing = {
          post: Number(pricePost) || 0,
          reel: Number(priceReel) || 0,
          story: Number(priceStory) || 0,
        };
        body.platforms = [
          instagram ? 'instagram' : null,
          youtube ? 'youtube' : null,
        ].filter(Boolean);
      } else if (user?.role === 'business') {
        body.brand_name = brand;
        body.industry = industry;
        body.website = website;
      }
      const { user: updated } = await put<any>('/api/users/profile', body);
      updateUser(updated);
      router.back();
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="edit-profile-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 4, paddingBottom: 120 }}>
          <Field label="Full name" testID="edit-name" value={name} onChangeText={setName} />
          <Field label="Avatar URL" testID="edit-avatar" value={avatar} onChangeText={setAvatar} />
          <Field label="Bio" testID="edit-bio" value={bio} onChangeText={setBio} multiline />
          <Field label="Region" testID="edit-region" value={region} onChangeText={setRegion} />
          <Field label="Phone (private)" testID="edit-phone" value={phone} onChangeText={setPhone} />
          {user?.role === 'influencer' ? (
            <>
              <Field label="Category" testID="edit-category" value={category} onChangeText={setCategory} />
              <Field label="Followers" testID="edit-followers" value={followers} onChangeText={setFollowers} keyboardType="number-pad" />
              <Field label="Instagram handle" testID="edit-instagram" value={instagram} onChangeText={setInstagram} />
              <Field label="YouTube channel" testID="edit-youtube" value={youtube} onChangeText={setYoutube} />
              <Field label="Price / post (₹)" testID="edit-price-post" value={pricePost} onChangeText={setPricePost} keyboardType="number-pad" />
              <Field label="Price / reel (₹)" testID="edit-price-reel" value={priceReel} onChangeText={setPriceReel} keyboardType="number-pad" />
              <Field label="Price / story (₹)" testID="edit-price-story" value={priceStory} onChangeText={setPriceStory} keyboardType="number-pad" />
              <Text style={styles.label}>Contact unlock tier</Text>
              <View style={styles.tierRow}>
                {(['basic', 'silver', 'gold'] as const).map((t) => (
                  <Pressable key={t} testID={`tier-${t}`} onPress={() => setTier(t)}
                    style={[styles.tierChip, tier === t && styles.tierActive]}>
                    <Text style={[styles.tierText, tier === t && { color: colors.onBrand }]}>
                      {t} • ₹{t === 'gold' ? 99 : t === 'silver' ? 49 : 10}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {user?.role === 'business' ? (
            <>
              <Field label="Brand name" testID="edit-brand" value={brand} onChangeText={setBrand} />
              <Field label="Industry" testID="edit-industry" value={industry} onChangeText={setIndustry} />
              <Field label="Website" testID="edit-website" value={website} onChangeText={setWebsite} />
            </>
          ) : null}
          <Pressable testID="save-profile-button" onPress={save}
            style={[styles.primary, saving && { opacity: 0.6 }]} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save changes</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && { height: 80 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  label: { color: colors.muted, marginTop: spacing.md, fontSize: font.size.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.onSurface, backgroundColor: colors.surface2, marginTop: 4,
    fontSize: font.size.base,
  },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  tierChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  tierActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  tierText: { color: colors.onSurface, textTransform: 'capitalize', fontWeight: '500' },
  primary: { marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: spacing.md + 2, alignItems: 'center', ...shadow.soft },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
});
