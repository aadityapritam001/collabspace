/**
 * Splash/gate — routes user based on auth state.
 *   • loading            -> spinner
 *   • unauthenticated    -> /auth/login
 *   • authenticated pending role -> /auth/role-select
 *   • authenticated admin -> /admin
 *   • otherwise          -> /(tabs)/discover
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, spacing } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/auth/login');
    else if (user.role === 'pending') router.replace('/auth/role-select');
    else if (user.role === 'admin') router.replace('/admin');
    else router.replace('/(tabs)/discover');
  }, [user, loading, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Text style={styles.brand}>CollabSpace</Text>
      <Text style={styles.tagline}>Where creators meet brands.</Text>
      <ActivityIndicator size="small" color={colors.brand} style={{ marginTop: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  brand: { color: colors.brand, fontSize: font.size.xxxl, fontWeight: '500' },
  tagline: { color: colors.muted, marginTop: spacing.sm, fontSize: font.size.lg },
});
