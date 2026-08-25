/**
 * Chat + Negotiation screen.
 *   • Real-time via WebSocket (?token=<session_token>)
 *   • REST fallback via POST /api/messages when socket is unavailable
 *   • Renders "Negotiation Cards" (kind='system'/'offer') distinctly
 *   • Contact-unlock overlay when contact is still locked (MOCK Razorpay)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { get, post, loadToken, getBaseUrl } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, font, radius, shadow, spacing } from '@/src/theme';

type Msg = {
  message_id: string;
  sender_id: string;
  text: string;
  kind: 'text' | 'system' | 'offer';
  offer?: any;
  created_at: string;
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peer, setPeer] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [showUnlock, setShowUnlock] = useState(false);
  const [contact, setContact] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  const loadThread = useCallback(async () => {
    try {
      const { messages, peer_id, request } = await get<any>(`/api/conversations/${id}/messages`);
      setMessages(messages);
      setPeerId(peer_id);
      setRequest(request);
      if (peer_id) {
        const { user: p } = await get<any>(`/api/users/${peer_id}`);
        setPeer(p);
      }
      if (request?.contact_unlocked) {
        try {
          const { contact } = await get<any>(`/api/requests/${request.request_id}/contact`);
          setContact(contact);
        } catch {}
      }
    } finally { setLoading(false); }
  }, [id]);

  // Open WebSocket for real-time updates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadThread();
      const token = await loadToken();
      if (!token || cancelled) return;
      const base = getBaseUrl();
      const wsUrl = base.replace(/^http/, 'ws') + `/api/ws/chat/${id}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'message') {
            setMessages((prev) => [...prev, data.message]);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
          } else if (data.type === 'unlock') {
            // Refresh request state and fetch contact.
            loadThread();
          }
        } catch {}
      };
      ws.onerror = () => { /* silent — REST fallback still works */ };
    })();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    // Try WebSocket first, fall back to REST.
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text: body, kind: 'text' }));
    } else {
      try {
        const { message } = await post<any>('/api/messages', {
          conversation_id: id, text: body, kind: 'text',
        });
        setMessages((prev) => [...prev, message]);
      } catch (e) { console.warn(e); }
    }
  };

  const startUnlock = () => setShowUnlock(true);

  const confirmMockPayment = async () => {
    if (!request?.request_id) return;
    // 1) Create MOCK order
    const { order } = await post<any>('/api/payments/create-order', { request_id: request.request_id });
    // 2) Verify (mocked signature) — this reveals contact server-side
    await post('/api/payments/verify', {
      request_id: request.request_id,
      razorpay_order_id: order.id,
      razorpay_payment_id: 'pay_MOCK' + Math.random().toString(36).slice(2, 12),
      razorpay_signature: 'MOCK_SIGNATURE',
    });
    setShowUnlock(false);
    loadThread();
  };

  const unlockPrice = useMemo(() => {
    const t = peer?.unlock_tier || 'basic';
    return t === 'gold' ? 99 : t === 'silver' ? 49 : 10;
  }, [peer]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="chat-screen">
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Image source={{ uri: peer?.avatar_url }} style={styles.avatar} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{peer?.name || 'Chat'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {request?.contact_unlocked ? '🔓 Contact unlocked' : '🔒 Contact locked'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.user_id;
            if (item.kind !== 'text') {
              return (
                <View style={styles.negoCard}>
                  <Ionicons name="pricetag" size={16} color={colors.onBrand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.negoTitle}>{item.text}</Text>
                    {item.offer?.budget ? <Text style={styles.negoLine}>Budget: ₹{Number(item.offer.budget).toLocaleString('en-IN')}</Text> : null}
                    {item.offer?.deliverables ? <Text style={styles.negoLine}>Deliverables: {item.offer.deliverables}</Text> : null}
                  </View>
                </View>
              );
            }
            return (
              <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: colors.onBrand }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            request && !request.contact_unlocked ? (
              <Pressable testID="unlock-contact-button" onPress={startUnlock} style={styles.unlockCard}>
                <Ionicons name="lock-closed" size={18} color={colors.onBrandSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.unlockTitle}>Unlock contact details</Text>
                  <Text style={styles.unlockSub}>Pay ₹{unlockPrice} to reveal phone, email & socials. Backend verifies before revealing.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onBrandSoft} />
              </Pressable>
            ) : contact ? (
              <View style={styles.contactCard}>
                <Text style={styles.contactTitle}>🔓 Contact details</Text>
                {contact.email ? <Text style={styles.contactLine}>Email: {contact.email}</Text> : null}
                {contact.phone ? <Text style={styles.contactLine}>Phone: {contact.phone}</Text> : null}
                {contact.social_handles ? Object.entries(contact.social_handles).map(([k, v]) => (
                  <Text key={k} style={styles.contactLine}>{k}: {String(v)}</Text>
                )) : null}
                <Pressable testID="create-campaign-button" onPress={() => router.push({ pathname: '/campaign/new', params: { request_id: request.request_id } })}
                  style={styles.campaignBtn}>
                  <Text style={styles.campaignText}>Start campaign</Text>
                </Pressable>
              </View>
            ) : null
          }
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send-button" onPress={send} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal transparent visible={showUnlock} animationType="fade" onRequestClose={() => setShowUnlock(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowUnlock(false)} />
        <View style={styles.paymentSheet} testID="payment-sheet">
          <Text style={styles.paymentTitle}>Contact-unlock payment</Text>
          <Text style={styles.paymentSub}>Amount: ₹{unlockPrice}</Text>
          <Text style={styles.paymentSub}>Gateway: Razorpay (MOCK — no real charge)</Text>
          <Pressable testID="confirm-payment-button" onPress={confirmMockPayment} style={styles.payBtn}>
            <Text style={styles.payText}>Pay ₹{unlockPrice}</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface2 },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface3 },
  name: { color: colors.onSurface, fontSize: font.size.lg, fontWeight: '500' },
  sub: { color: colors.muted, fontSize: font.size.sm },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.surface2, borderBottomLeftRadius: 6 },
  bubbleText: { color: colors.onSurface, fontSize: font.size.base },
  negoCard: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.brand, borderRadius: radius.lg, ...shadow.card,
  },
  negoTitle: { color: colors.onBrand, fontSize: font.size.base, fontWeight: '500' },
  negoLine: { color: colors.onBrand, opacity: 0.9, fontSize: font.size.sm, marginTop: 2 },
  unlockCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.brandSoft, borderRadius: radius.lg, marginTop: spacing.md,
  },
  unlockTitle: { color: colors.onBrandSoft, fontSize: font.size.base, fontWeight: '500' },
  unlockSub: { color: colors.onBrandSoft, opacity: 0.85, fontSize: font.size.sm, marginTop: 2 },
  contactCard: {
    padding: spacing.md, backgroundColor: colors.success + '22',
    borderRadius: radius.lg, marginTop: spacing.md, gap: 4,
  },
  contactTitle: { fontSize: font.size.lg, color: colors.onSuccess, fontWeight: '500' },
  contactLine: { color: colors.onSurface },
  campaignBtn: { marginTop: spacing.md, backgroundColor: colors.success, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  campaignText: { color: '#fff', fontWeight: '500' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: colors.surface2,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.onSurface, fontSize: font.size.base,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  paymentSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, gap: spacing.sm,
  },
  paymentTitle: { fontSize: font.size.xl, color: colors.onSurface, fontWeight: '500' },
  paymentSub: { color: colors.muted },
  payBtn: { marginTop: spacing.md, backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  payText: { color: colors.onBrand, fontSize: font.size.lg, fontWeight: '500' },
});
