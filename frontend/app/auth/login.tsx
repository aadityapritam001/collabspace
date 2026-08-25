/**
 * Login — dark navy + purple/cyan brand, gradient CTA, logo-forward.
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
import { BrandLogo } from '@/src/components/BrandLogo';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

export default function Login() {
  const { loginEmail, loginGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    setErr(null); setLoading(true);
    try {
      await loginEmail(email.trim(), pw);
      router.replace('/');
    } catch (e: any) {
      setErr(e.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.wrap} testID="login-screen">
      <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brandRow}>
              <BrandLogo size={72} />
              <Text style={styles.brand}>CollabSpace</Text>
              <Text style={styles.tagline}>Where creators meet brands.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue collaborating.</Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                testID="login-email-input"
                autoCapitalize="none" keyboardType="email-address"
                value={email} onChangeText={setEmail}
                placeholder="you@brand.com" placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                testID="login-password-input"
                secureTextEntry value={pw} onChangeText={setPw}
                placeholder="••••••••" placeholderTextColor={colors.muted}
                style={styles.input}
              />
              {err ? <Text style={styles.err}>{err}</Text> : null}

              <Pressable testID="login-submit-button" onPress={onLogin} disabled={loading} style={{ marginTop: spacing.xl }}>
                <LinearGradient colors={gradient.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
                </LinearGradient>
              </Pressable>

              <View style={styles.divider}><View style={styles.dLine} /><Text style={styles.dText}>OR</Text><View style={styles.dLine} /></View>

              <Pressable testID="login-google-button" onPress={loginGoogle}
                style={({ pressed }) => [styles.google, pressed && { opacity: 0.9 }]}>
                <Ionicons name="logo-google" size={18} color={colors.onSurface} />
                <Text style={styles.googleText}>Continue with Google</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New here?</Text>
              <Pressable testID="go-to-register-button" onPress={() => router.push('/auth/register')}>
                <Text style={styles.link}> Create account</Text>
              </Pressable>
            </View>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo accounts</Text>
              <Text style={styles.demoLine}>Brand: brand@collabspace.app / Brand@123</Text>
              <Text style={styles.demoLine}>Creator: creator@collabspace.app / Creator@123</Text>
              <Text style={styles.demoLine}>Admin: admin@collabspace.app / Admin@123</Text>
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
  brandRow: { alignItems: 'center', marginBottom: spacing.xl },
  brand: { fontSize: font.size.xxxl, color: colors.onSurface, fontWeight: '700', marginTop: spacing.md, letterSpacing: 0.4 },
  tagline: { color: colors.onSurfaceMuted, marginTop: spacing.xs, fontSize: font.size.base },
  card: {
    backgroundColor: colors.surface2, borderRadius: radius.xl, padding: spacing.xl,
    ...shadow.card, borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '700' },
  subtitle: { color: colors.onSurfaceMuted, marginTop: 2, marginBottom: spacing.md, fontSize: font.size.base },
  label: { color: colors.onSurfaceMuted, fontSize: font.size.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.lg, color: colors.onSurface, backgroundColor: colors.surface3,
  },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.size.base },
  primary: { borderRadius: radius.pill, paddingVertical: spacing.md + 2, alignItems: 'center', ...shadow.glow },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '700', letterSpacing: 0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: spacing.sm },
  dLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dText: { color: colors.onSurfaceMuted, fontSize: font.size.sm },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    paddingVertical: spacing.md, gap: spacing.sm, backgroundColor: colors.surface3,
  },
  googleText: { color: colors.onSurface, fontSize: font.size.lg, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceMuted, fontSize: font.size.base },
  link: { color: colors.accent, fontSize: font.size.base, fontWeight: '700' },
  demoBox: {
    marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.brandSoft,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  demoTitle: { color: colors.onBrandSoft, fontWeight: '700', marginBottom: spacing.xs },
  demoLine: { color: colors.onBrandSoft, fontSize: font.size.sm },
});
