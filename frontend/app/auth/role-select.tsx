/**
 * Role select — shown after Google login when the user has no role yet.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, spacing } from '@/src/theme';

export default function RoleSelect() {
  const { selectRole } = useAuth();
  const router = useRouter();

  const pick = async (r: 'influencer' | 'business') => {
    await selectRole(r);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe} testID="role-select-screen">
      <View style={styles.wrap}>
        <Text style={styles.title}>How will you use CollabSpace?</Text>
        <Text style={styles.subtitle}>You can change this later in profile settings.</Text>

        <Pressable testID="role-select-influencer" onPress={() => pick('influencer')} style={styles.card}>
          <Text style={styles.emoji}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>I am a creator</Text>
            <Text style={styles.cardSub}>Get discovered by brands and monetize your reach.</Text>
          </View>
        </Pressable>

        <Pressable testID="role-select-business" onPress={() => pick('business')} style={styles.card}>
          <Text style={styles.emoji}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>I am a brand</Text>
            <Text style={styles.cardSub}>Find creators that match your niche and budget.</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  wrap: { padding: spacing.xl, gap: spacing.md, flex: 1, justifyContent: 'center' },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  subtitle: { color: colors.muted, marginBottom: spacing.lg, fontSize: font.size.lg },
  card: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'center',
    padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface2,
    borderWidth: 1, borderColor: colors.border,
  },
  emoji: { fontSize: 36 },
  cardTitle: { fontSize: font.size.lg, fontWeight: '500', color: colors.onSurface },
  cardSub: { color: colors.muted, marginTop: 2, fontSize: font.size.base },
});
