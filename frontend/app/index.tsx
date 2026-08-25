/**
 * Splash / route gate — dark, logo-forward brand moment.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { BrandLogo } from '@/src/components/BrandLogo';
import { colors, gradient, spacing } from '@/src/theme';

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
      <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
      <BrandLogo size={120} showWordmark tagline="Where creators meet brands." />
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
});
