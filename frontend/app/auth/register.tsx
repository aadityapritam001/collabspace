/**
 * Register — dark palette + gradient CTA + role picker.
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

export default function Register() {
  const { registerEmail } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'influencer' | 'business'>('influencer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null); setLoading(true);
    try {
      await registerEmail(email.trim(), pw, name.trim(), role);
      router.replace('/');
    } catch (e: any) {
      setErr(e.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.wrap} testID="register-screen">
      <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
              <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Choose how you will use CollabSpace.</Text>

            <View style={styles.roleRow}>
              <Pressable testID="role-influencer-button" onPress={() => setRole('influencer')}
                style={[styles.roleCard, role === 'influencer' && styles.roleActive]}>
                <Ionicons name="sparkles" size={22} color={role === 'influencer' ? colors.accent : colors.onSurfaceMuted} />
                <Text style={styles.roleTitle}>I am a creator</Text>
                <Text style={styles.roleSub}>Monetize your audience</Text>
              </Pressable>
              <Pressable testID="role-business-button" onPress={() => setRole('business')}
                style={[styles.roleCard, role === 'business' && styles.roleActive]}>
                <Ionicons name="rocket" size={22} color={role === 'business' ? colors.accent : colors.onSurfaceMuted} />
                <Text style={styles.roleTitle}>I am a brand</Text>
                <Text style={styles.roleSub}>Discover creators</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Full name</Text>
              <TextInput testID="register-name-input" value={name} onChangeText={setName}
                placeholder="Jane Doe" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Email</Text>
              <TextInput testID="register-email-input" autoCapitalize="none" keyboardType="email-address"
                value={email} onChangeText={setEmail}
                placeholder="you@brand.com" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.label}>Password</Text>
              <TextInput testID="register-password-input" secureTextEntry value={pw} onChangeText={setPw}
                placeholder="min 6 chars" placeholderTextColor={colors.muted} style={styles.input} />
              {err ? <Text style={styles.err}>{err}</Text> : null}

              <Pressable testID="register-submit-button" onPress={onSubmit} disabled={loading} style={{ marginTop: spacing.xl }}>
                <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
                </LinearGradient>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable testID="go-to-login-button" onPress={() => router.replace('/auth/login')}>
                <Text style={styles.link}> Sign in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  backBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700' },
  subtitle: { color: colors.onSurfaceMuted, marginTop: spacing.xs, marginBottom: spacing.lg, fontSize: font.size.lg },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  roleCard: {
    flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.lg, backgroundColor: colors.surface2, gap: spacing.xs,
  },
  roleActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft, ...shadow.glow },
  roleTitle: { fontSize: font.size.lg, color: colors.onSurface, marginTop: spacing.sm, fontWeight: '700' },
  roleSub: { fontSize: font.size.sm, color: colors.onSurfaceMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface2, borderRadius: radius.xl, padding: spacing.xl,
    ...shadow.card, borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.onSurfaceMuted, fontSize: font.size.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.lg, color: colors.onSurface, backgroundColor: colors.surface3,
  },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.size.base },
  primary: { borderRadius: radius.pill, paddingVertical: spacing.md + 2, alignItems: 'center', ...shadow.glow },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceMuted, fontSize: font.size.base },
  link: { color: colors.accent, fontSize: font.size.base, fontWeight: '700' },
});
