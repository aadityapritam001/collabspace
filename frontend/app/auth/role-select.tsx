/**
 * Role select after Google login.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { BrandLogo } from '@/src/components/BrandLogo';
import { colors, font, gradient, radius, shadow, spacing } from '@/src/theme';

export default function RoleSelect() {
  const { selectRole } = useAuth();
  const router = useRouter();

  const pick = async (r: 'influencer' | 'business') => {
    await selectRole(r);
    router.replace('/');
  };

  return (
    <View style={styles.wrap} testID="role-select-screen">
      <LinearGradient colors={gradient.hero} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <BrandLogo size={64} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>How will you use CollabSpace?</Text>
          <Text style={styles.subtitle}>You can change this later in your profile.</Text>

          <Pressable testID="role-select-influencer" onPress={() => pick('influencer')} style={styles.card}>
            <Ionicons name="sparkles" size={26} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>I am a creator</Text>
              <Text style={styles.cardSub}>Get discovered by brands and monetize your reach.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
          </Pressable>

          <Pressable testID="role-select-business" onPress={() => pick('business')} style={styles.card}>
            <Ionicons name="rocket" size={26} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>I am a brand</Text>
              <Text style={styles.cardSub}>Find creators that match your niche and budget.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1 },
  top: { alignItems: 'center', paddingTop: spacing.xxl },
  body: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '700' },
  subtitle: { color: colors.onSurfaceMuted, marginBottom: spacing.lg, fontSize: font.size.lg },
  card: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  cardTitle: { fontSize: font.size.lg, fontWeight: '700', color: colors.onSurface },
  cardSub: { color: colors.onSurfaceMuted, marginTop: 2, fontSize: font.size.base },
});
