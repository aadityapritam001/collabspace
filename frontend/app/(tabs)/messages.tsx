/**
 * Messages tab — list of conversations sorted by last activity.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get } from '@/src/api/client';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

type Conv = {
  conversation_id: string;
  last_message?: string;
  last_message_at?: string;
  peer?: { user_id: string; name?: string; avatar_url?: string };
};

export default function Messages() {
  const router = useRouter();
  const [items, setItems] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { conversations } = await get<{ conversations: Conv[] }>('/api/conversations');
      setItems(conversations);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="messages-screen">
      <View style={styles.header}><Text style={styles.title}>Chat</Text></View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.conversation_id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
          renderItem={({ item }) => (
            <Pressable
              testID={`conversation-${item.conversation_id}`}
              onPress={() => router.push(`/chat/${item.conversation_id}`)}
              style={styles.row}
            >
              <Image source={{ uri: item.peer?.avatar_url }} style={styles.avatar} placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7Rj~qt7t7Rj' }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.peer?.name || 'User'}</Text>
                <Text style={styles.msg} numberOfLines={1}>{item.last_message || 'Say hi 👋'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Send a collaboration request to start a chat.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: font.size.xxl, color: colors.onSurface, fontWeight: '500' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, ...shadow.soft,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { fontSize: font.size.lg, color: colors.onSurface, fontWeight: '500' },
  msg: { color: colors.muted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontSize: font.size.lg, fontWeight: '500', color: colors.onSurface },
  emptySub: { color: colors.muted, textAlign: 'center', paddingHorizontal: spacing.xl },
});
