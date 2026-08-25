/**
 * Login screen — supports both email/password and Emergent Google Auth.
 */
import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

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
    <SafeAreaView style={styles.safe} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logoDot} />
            <Text style={styles.brand}>CollabSpace</Text>
            <Text style={styles.tagline}>Sign in to collaborate.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@brand.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              secureTextEntry
              value={pw}
              onChangeText={setPw}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}

            <Pressable
              testID="login-submit-button"
              onPress={onLogin}
              disabled={loading}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign in</Text>}
            </Pressable>

            <View style={styles.divider}><Text style={styles.dividerText}>OR</Text></View>

            <Pressable
              testID="login-google-button"
              onPress={loginGoogle}
              style={({ pressed }) => [styles.google, pressed && { opacity: 0.9 }]}
            >
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { alignItems: 'flex-start', marginBottom: spacing.xl },
  logoDot: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brand, marginBottom: spacing.md },
  brand: { fontSize: font.size.xxxl, color: colors.onSurface, fontWeight: '500' },
  tagline: { fontSize: font.size.lg, color: colors.muted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, ...shadow.card, borderWidth: 1, borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: font.size.sm, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: font.size.lg, color: colors.onSurface, backgroundColor: colors.surface2,
  },
  err: { color: colors.error, marginTop: spacing.md, fontSize: font.size.base },
  primary: {
    marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.pill,
    paddingVertical: spacing.md + 2, alignItems: 'center',
  },
  primaryText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
  divider: { alignItems: 'center', marginVertical: spacing.lg },
  dividerText: { color: colors.muted, fontSize: font.size.sm },
  google: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    paddingVertical: spacing.md, gap: spacing.sm,
  },
  googleText: { color: colors.onSurface, fontSize: font.size.lg, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.muted, fontSize: font.size.base },
  link: { color: colors.brand, fontSize: font.size.base, fontWeight: '500' },
  demoBox: {
    marginTop: spacing.xl, padding: spacing.md, backgroundColor: colors.brandSoft,
    borderRadius: radius.md,
  },
  demoTitle: { color: colors.onBrandSoft, fontWeight: '500', marginBottom: spacing.xs },
  demoLine: { color: colors.onBrandSoft, fontSize: font.size.sm },
});
