/**
 * Register screen — email/password + role select (influencer/business).
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

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
    <SafeAreaView style={styles.safe} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose how you will use CollabSpace.</Text>

          <View style={styles.roleRow}>
            <Pressable
              testID="role-influencer-button"
              onPress={() => setRole('influencer')}
              style={[styles.roleCard, role === 'influencer' && styles.roleActive]}
            >
              <Text style={styles.roleEmoji}>✨</Text>
              <Text style={styles.roleTitle}>I am a creator</Text>
              <Text style={styles.roleSub}>Monetize your audience</Text>
            </Pressable>
            <Pressable
              testID="role-business-button"
              onPress={() => setRole('business')}
              style={[styles.roleCard, role === 'business' && styles.roleActive]}
            >
              <Text style={styles.roleEmoji}>🚀</Text>
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
            <Pressable testID="register-submit-button" onPress={onSubmit} disabled={loading}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create account</Text>}
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  subtitle: { color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg, fontSize: font.size.lg },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  roleCard: {
    flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.lg, backgroundColor: colors.surface,
  },
  roleActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  roleEmoji: { fontSize: 28 },
  roleTitle: { fontSize: font.size.lg, color: colors.onSurface, marginTop: spacing.sm, fontWeight: '500' },
  roleSub: { fontSize: font.size.sm, color: colors.muted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl,
    ...shadow.card, borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: font.size.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.lg, color: colors.onSurface, backgroundColor: colors.surface2,
  },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.size.base },
  primary: { marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: spacing.md + 2, alignItems: 'center' },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: font.size.base },
  link: { color: colors.brand, fontSize: font.size.base, fontWeight: '500' },
});
