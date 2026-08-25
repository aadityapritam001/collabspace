/**
 * Leaderboard / rankings — top-rated influencers.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

export default function Leaderboard() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { leaders } = await get<any>('/api/leaderboard');
        setItems(leaders);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="leaderboard-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} testID="back-btn">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Top creators</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.user_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          renderItem={({ item, index }) => (
            <Pressable
              testID={`leader-${item.user_id}`}
              onPress={() => router.push(`/creator/${item.user_id}`)}
              style={styles.row}
            >
              <Text style={styles.rank}>#{index + 1}</Text>
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.sub}>{item.category} • {item.region}</Text>
              </View>
              <View style={styles.rating}>
                <Ionicons name="star" size={14} color={colors.accent} />
                <Text style={styles.ratingText}>{(item.rating_avg || 0).toFixed(1)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  rank: { width: 32, color: colors.brand, fontWeight: '500', fontSize: font.size.lg },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { color: colors.onSurface, fontSize: font.size.base, fontWeight: '500' },
  sub: { color: colors.muted, fontSize: font.size.sm, marginTop: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.onSurface, fontWeight: '500' },
});
