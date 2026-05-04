import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, Camera, MoreHorizontal, Paperclip, Stethoscope } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { completeSession, deferSession, getOrCreateSession, sendChatMessage } from '../../src/lib/sessionStore';
import { colors, radius, spacing, typography } from '../../src/theme';
import { ChatMessage, ChatSession, TriageResponse } from '../../src/types';

const SUGGESTIONS = [
  { label: 'I have a fever 🌡️', text: 'I have a fever' },
  { label: 'My chest hurts ❤️', text: 'My chest hurts' },
  { label: 'I need a prescription filled 💊', text: 'I need a prescription filled' },
];

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.max(0, Math.min(1, confidence));
  const filled = pct * 3;
  return (
    <View style={styles.confidenceTrack}>
      {[0, 1, 2].map((i) => {
        const segmentFill = Math.max(0, Math.min(1, filled - i));
        return (
          <View key={i} style={styles.confidenceSlot}>
            <View style={[styles.confidenceFill, { width: `${segmentFill * 100}%` }]} />
          </View>
        );
      })}
    </View>
  );
}

function TypingBubble() {
  const a1 = useRef(new Animated.Value(1)).current;
  const a2 = useRef(new Animated.Value(1)).current;
  const a3 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1.35, duration: 280, useNativeDriver: true }),
          Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }),
        ]),
      );
    const l1 = mk(a1, 0);
    const l2 = mk(a2, 120);
    const l3 = mk(a3, 240);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a1, a2, a3]);

  return (
    <View style={styles.typingRow}>
      <View style={styles.dlAvatar}>
        <Text style={styles.dlAvatarText}>DL</Text>
      </View>
      <View style={styles.assistantBubbleOuter}>
        <View style={styles.typingDotsRow}>
          <Animated.View style={[styles.typingDot, { transform: [{ scale: a1 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ scale: a2 }] }]} />
          <Animated.View style={[styles.typingDot, { transform: [{ scale: a3 }] }]} />
        </View>
      </View>
    </View>
  );
}

function TriageCards({
  structured,
  onDefer,
  onComplete,
  onNavigateServices,
}: {
  structured: TriageResponse;
  onDefer: () => void;
  onComplete: () => void;
  onNavigateServices: (action: string) => void;
}) {
  const c0 = structured.conditions[0];

  if (structured.action === 'emergency') {
    return (
      <View style={[styles.actionCard, styles.actionCardEmergency]}>
        <Text style={styles.actionTitleEmergency}>🚨 Emergency — Immediate Care Needed</Text>
        {c0 ? (
          <>
            <Text style={styles.actionBody}>{c0.name}</Text>
            <Text style={styles.actionBodySmall}>{c0.rationale}</Text>
          </>
        ) : (
          <Text style={styles.actionBody}>Seek emergency care now if symptoms are severe.</Text>
        )}
        <View style={styles.actionGap} />
        <ConfidenceBar confidence={structured.confidence} />
        <View style={styles.actionGapLg} />
        <Pressable style={styles.btnEmergencyFill} onPress={() => onNavigateServices('emergency')}>
          <Text style={styles.btnEmergencyFillText}>Get Emergency Help →</Text>
        </Pressable>
        <View style={styles.actionGapSm} />
        <Pressable
          style={styles.btnEmergencyOutline}
          onPress={() => void Linking.openURL('tel:911')}
        >
          <Text style={styles.btnEmergencyOutlineText}>Call emergency contact</Text>
        </Pressable>
      </View>
    );
  }

  if (structured.action === 'hospital' || structured.action === 'clinic') {
    const isHospital = structured.action === 'hospital';
    return (
      <View style={[styles.actionCard, styles.actionCardUrgent]}>
        <Text style={styles.actionTitleUrgent}>
          {isHospital ? '🏥 Hospital care suggested' : '🩺 Clinic visit suggested'}
        </Text>
        {c0 ? (
          <>
            <Text style={styles.actionBody}>{c0.name}</Text>
            <Text style={styles.actionBodySmall}>{c0.rationale}</Text>
          </>
        ) : null}
        <View style={styles.actionGap} />
        <ConfidenceBar confidence={structured.confidence} />
        <View style={styles.actionGapLg} />
        <Pressable
          style={styles.btnUrgentFill}
          onPress={() => onNavigateServices(isHospital ? 'hospital' : 'clinic')}
        >
          <Text style={styles.btnUrgentFillText}>{isHospital ? 'Find nearest hospital →' : 'Find nearest clinic →'}</Text>
        </Pressable>
        <View style={styles.actionGapSm} />
        <Pressable style={styles.btnUrgentOutline} onPress={onDefer}>
          <Text style={styles.btnUrgentOutlineText}>Remind me in 6 hours</Text>
        </Pressable>
      </View>
    );
  }

  if (structured.action === 'pharmacy') {
    const chips =
      structured.required_services?.filter((s) => s.length > 0 && s !== 'pharmacy') ?? [];
    return (
      <View style={[styles.actionCard, styles.actionCardMild]}>
        <Text style={styles.actionTitleMild}>💊 Pharmacy</Text>
        <Text style={styles.actionBodySmall}>We will help you find stock nearby.</Text>
        {chips.length > 0 ? (
          <View style={styles.chipRow}>
            {chips.map((d) => (
              <View key={d} style={styles.drugChip}>
                <Text style={styles.drugChipText}>{d}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.actionGapLg} />
        <Pressable style={styles.btnMildFill} onPress={() => onNavigateServices('pharmacy')}>
          <Text style={styles.btnMildFillText}>Find pharmacy with stock →</Text>
        </Pressable>
      </View>
    );
  }

  if (structured.action === 'first_aid') {
    const steps =
      structured.conditions.length > 0
        ? structured.conditions.map((c, i) => ({ n: i + 1, title: c.name, detail: c.rationale }))
        : structured.red_flags.map((t, i) => ({ n: i + 1, title: t, detail: '' }));
    return (
      <View style={[styles.actionCard, styles.actionCardInfo]}>
        <Text style={styles.actionTitleInfo}>🩹 First aid</Text>
        {steps.map((s) => (
          <View key={s.n} style={styles.stepRow}>
            <Text style={styles.stepNum}>{s.n}.</Text>
            <View style={styles.stepBody}>
              <Text style={styles.actionBody}>{s.title}</Text>
              {s.detail ? <Text style={styles.actionBodySmall}>{s.detail}</Text> : null}
            </View>
            <View style={styles.stepCheck} />
          </View>
        ))}
        <View style={styles.actionGapLg} />
        <Pressable style={styles.btnInfoFill} onPress={onComplete}>
          <Text style={styles.btnInfoFillText}>I&apos;ve completed first aid</Text>
        </Pressable>
      </View>
    );
  }

  if (structured.action === 'self_care') {
    return (
      <View style={[styles.actionCard, styles.actionCardSelf]}>
        <Text style={styles.actionTitleSelf}>Self care</Text>
        <Text style={styles.actionBodySmall}>Watch for these warning signs:</Text>
        {structured.red_flags.map((t) => (
          <Text key={t} style={styles.bulletLine}>
            • {t}
          </Text>
        ))}
        <View style={styles.actionGapLg} />
        <Pressable style={styles.btnSelfOutline} onPress={onComplete}>
          <Text style={styles.btnSelfOutlineText}>I&apos;m feeling worse — restart</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const navigation = useNavigation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastStructured, setLastStructured] = useState<TriageResponse | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    getOrCreateSession()
      .then(({ session: nextSession, messages: nextMessages }) => {
        setSession(nextSession);
        setMessages(nextMessages);
        const structured = [...nextMessages].reverse().find((message) => message.structuredResponse)?.structuredResponse;
        setLastStructured(structured ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, sending, scrollToEnd]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const email = userData.user?.email ?? '';
      if (!uid) {
        if (!cancelled) setDisplayName(email.split('@')[0] || 'there');
        return;
      }
      const { data } = await supabase.from('profiles').select('display_name').eq('id', uid).maybeSingle();
      if (cancelled) return;
      const name = (data?.display_name as string | null)?.trim();
      setDisplayName(name || email.split('@')[0] || 'there');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof prefill === 'string' && prefill.trim()) {
      setInput(prefill);
    }
  }, [prefill]);

  const showTriageCard = lastStructured !== null && lastStructured.action !== 'ask_more' && !sending;

  async function handleSend() {
    if (!session || !input.trim()) return;
    const text = input.trim();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] Calling dr-lucas with:', {
        message: text,
        sessionId: session.id,
        messageCount: messages.length,
      });
    }
    setLastStructured(null);
    setSending(true);
    setInput('');
    const result = await sendChatMessage(session, messages, text);
    if (__DEV__) {
      const last = result.messages[result.messages.length - 1];
      // eslint-disable-next-line no-console
      console.log('[DEBUG] dr-lucas done', { connectionFallback: last?.connectionFallback });
    }
    setSession(result.session);
    setMessages(result.messages);
    setLastStructured(result.structured);
    const last = result.messages[result.messages.length - 1];
    if (last?.connectionFallback) {
      setInput(text);
    }
    setSending(false);
    scrollToEnd();
  }

  async function handleDefer() {
    if (!session) return;
    const updated = await deferSession(session);
    setSession(updated);
  }

  async function handleComplete() {
    if (!session) return;
    const updated = await completeSession(session);
    setSession(updated);
    setLastStructured(null);
  }

  const onNavigateServices = useCallback(
    (action: string) => {
      router.push({ pathname: '/services', params: { action } });
    },
    [router],
  );

  const emptyState = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <Stethoscope size={36} color={colors.accent} strokeWidth={2} />
        </View>
        <Text style={styles.emptyGreeting}>
          {greetingPrefix()}, {displayName || 'there'}
        </Text>
        <Text style={styles.emptyLead}>
          I&apos;m Dr Lucas. Describe your symptoms and I&apos;ll help you find the right care.
        </Text>
        <View style={styles.suggestionCol}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s.label} style={styles.suggestionChip} onPress={() => setInput(s.text)}>
              <Text style={styles.suggestionChipText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [displayName],
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeTop} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerTitle}>Dr Lucas</Text>
            <Text style={styles.headerSubtitle}>AI Health Assistant</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => undefined}
              style={styles.headerIconBtn}
            >
              <Camera size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={styles.headerIconBtn}
            >
              <MoreHorizontal size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.md }]}
          ListEmptyComponent={messages.length === 0 && !sending ? emptyState : null}
          ListFooterComponent={sending ? <TypingBubble /> : null}
          renderItem={({ item }) => <MessageRow message={item} connectionFallback={item.connectionFallback === true} />}
          onContentSizeChange={scrollToEnd}
        />

        {showTriageCard && lastStructured ? (
          <TriageCards
            structured={lastStructured}
            onDefer={handleDefer}
            onComplete={handleComplete}
            onNavigateServices={onNavigateServices}
          />
        ) : null}

        <Text style={styles.disclaimer}>Rapha helps you find care but does not replace a doctor</Text>

        <View style={[styles.composerOuter, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.composerRow}>
            <Pressable style={styles.attachBtn} onPress={() => undefined}>
              <Paperclip size={18} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message Dr Lucas..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={4000}
              textAlignVertical="top"
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleSend}
              disabled={!input.trim() || sending}
              style={({ pressed }) => [
                styles.sendBtn,
                (!input.trim() || sending) && styles.sendBtnDisabled,
                pressed && input.trim() && !sending && styles.sendBtnPressed,
              ]}
            >
              <ArrowUp size={22} color={colors.textOnAccent} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageRow({ message, connectionFallback }: { message: ChatMessage; connectionFallback: boolean }) {
  const isUser = message.role === 'user';
  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>{message.content}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.assistantRow}>
      <View style={styles.dlAvatar}>
        <Text style={styles.dlAvatarText}>DL</Text>
      </View>
      <View style={styles.assistantBubbleOuter}>
        <View style={[styles.assistantBubble, connectionFallback && styles.assistantBubbleRetry]}>
          <Text style={[styles.assistantBubbleText, connectionFallback && styles.assistantBubbleTextRetry]}>
            {message.content}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeTop: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 20,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyGreeting: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyLead: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  suggestionCol: { gap: spacing.sm, width: '100%' },
  suggestionChip: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  suggestionChipText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  userRow: { alignItems: 'flex-end', marginBottom: spacing.md },
  userBubble: {
    maxWidth: '75%',
    backgroundColor: colors.userBubble,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userBubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.userText,
  },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md, gap: spacing.sm },
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md, gap: spacing.sm },
  dlAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.drLucasBubble,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dlAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.drLucasText,
  },
  assistantBubbleOuter: { maxWidth: '85%', flexShrink: 1 },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  assistantBubbleRetry: {
    backgroundColor: colors.urgentLight,
    borderColor: colors.urgent,
  },
  assistantBubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  assistantBubbleTextRetry: {
    color: colors.urgent,
    fontWeight: '600',
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    color: colors.textTertiary,
  },
  composerOuter: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 22 * 4 + 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.borderStrong,
  },
  sendBtnPressed: {
    backgroundColor: colors.accentDark,
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
  },
  actionCardEmergency: {
    backgroundColor: colors.emergencyLight,
    borderLeftColor: colors.emergency,
  },
  actionCardUrgent: {
    backgroundColor: colors.urgentLight,
    borderLeftColor: colors.urgent,
  },
  actionCardMild: {
    backgroundColor: colors.mildLight,
    borderLeftColor: colors.mild,
  },
  actionCardInfo: {
    backgroundColor: colors.infoLight,
    borderLeftColor: colors.info,
  },
  actionCardSelf: {
    backgroundColor: colors.background,
    borderLeftColor: colors.textTertiary,
  },
  actionTitleEmergency: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.emergency,
  },
  actionTitleUrgent: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.urgent,
  },
  actionTitleMild: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.mild,
  },
  actionTitleInfo: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.info,
  },
  actionTitleSelf: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  actionBody: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  actionBodySmall: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  actionGap: { height: spacing.sm },
  actionGapSm: { height: spacing.sm },
  actionGapLg: { height: spacing.md },
  confidenceTrack: {
    flexDirection: 'row',
    gap: 4,
    height: 8,
  },
  confidenceSlot: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  btnEmergencyFill: {
    backgroundColor: colors.emergency,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnEmergencyFillText: {
    color: colors.textOnEmergency,
    fontWeight: '600',
    fontSize: 15,
  },
  btnEmergencyOutline: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.emergency,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnEmergencyOutlineText: {
    color: colors.emergency,
    fontWeight: '600',
    fontSize: 15,
  },
  btnUrgentFill: {
    backgroundColor: colors.urgent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnUrgentFillText: {
    color: colors.textOnAccent,
    fontWeight: '600',
    fontSize: 15,
  },
  btnUrgentOutline: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.urgent,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnUrgentOutlineText: {
    color: colors.urgent,
    fontWeight: '600',
    fontSize: 15,
  },
  btnMildFill: {
    backgroundColor: colors.mild,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnMildFillText: {
    color: colors.textOnAccent,
    fontWeight: '600',
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  drugChip: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  drugChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentDark,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepNum: { ...typography.label, width: 22 },
  stepBody: { flex: 1 },
  stepCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 2,
  },
  btnInfoFill: {
    backgroundColor: colors.info,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnInfoFillText: {
    color: colors.textOnAccent,
    fontWeight: '600',
    fontSize: 15,
  },
  btnSelfOutline: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnSelfOutlineText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  bulletLine: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
});
