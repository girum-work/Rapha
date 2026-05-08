import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { ArrowUp, Camera, MoreHorizontal, Paperclip, Stethoscope } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { dbgIngestLog } from '../../src/lib/debugIngest';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import {
  completeSession,
  deferSession,
  getOrCreateSession,
  hydrateSessionFromRemote,
  sendChatMessage,
} from '../../src/lib/sessionStore';
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
  const pctLabel = Math.round(pct * 100);
  return (
    <View style={styles.confidenceWrap}>
      <View style={styles.confidenceTrackSingle}>
        <View style={[styles.confidenceFillSingle, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.confidencePct}>{pctLabel}% confidence</Text>
    </View>
  );
}

function normalizeTriageOneCondition(s: TriageResponse): TriageResponse {
  if (!s.conditions?.length) return s;
  if (s.conditions.length === 1) return s;
  const top = [...s.conditions].sort((a, b) => b.confidence - a.confidence)[0]!;
  return { ...s, conditions: [top] };
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
          onPress={() => void Linking.openURL('tel:907')}
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
    const primary =
      structured.conditions.length > 0
        ? [...structured.conditions].sort((a, b) => b.confidence - a.confidence)[0]!
        : null;
    const steps = primary
      ? [{ n: 1, title: primary.name, detail: primary.rationale }]
      : structured.red_flags.length > 0
        ? [{ n: 1, title: structured.red_flags[0]!, detail: '' }]
        : [{ n: 1, title: 'General care', detail: 'Follow safe rest and hydration guidance.' }];
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

function PinnedTriageBanner({
  structured,
  onOpenServices,
}: {
  structured: TriageResponse;
  onOpenServices: () => void;
}) {
  const c0 = structured.conditions[0];
  const label =
    structured.action === 'emergency'
      ? 'Emergency'
      : structured.action === 'hospital'
        ? 'Hospital'
        : structured.action === 'clinic'
          ? 'Clinic'
          : structured.action === 'pharmacy'
            ? 'Pharmacy'
            : structured.action === 'first_aid'
              ? 'First aid'
              : structured.action === 'self_care'
                ? 'Self care'
                : 'Care';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpenServices}
      style={({ pressed }) => [styles.pinnedBar, pressed && styles.pinnedBarPressed]}
    >
      <Text style={styles.pinnedBarTitle}>Pinned · {label}</Text>
      <Text style={styles.pinnedBarSub} numberOfLines={1}>
        {c0?.name ?? 'Your triage result'}
      </Text>
      <Text style={styles.pinnedBarHint}>Tap for Care Options</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefill, openSession } = useLocalSearchParams<{ prefill?: string; openSession?: string }>();
  const navigation = useNavigation();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastStructured, setLastStructured] = useState<TriageResponse | null>(null);
  const [pinnedStructured, setPinnedStructured] = useState<TriageResponse | null>(null);
  const [pendingDisclaimerMsgId, setPendingDisclaimerMsgId] = useState<string | null>(null);
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
        const lastM = nextMessages[nextMessages.length - 1];
        setPendingDisclaimerMsgId(lastM?.role === 'assistant' ? lastM.id : null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof openSession !== 'string' || !openSession.trim()) return;
    const sid = openSession.trim();
    let cancelled = false;
    void (async () => {
      const ok = await hydrateSessionFromRemote(sid);
      if (cancelled) return;
      if (!ok) {
        router.replace('/(drawer)/');
        return;
      }
      const { session: nextSession, messages: nextMessages } = await getOrCreateSession();
      if (cancelled) return;
      setSession(nextSession);
      setMessages(nextMessages);
      const structured = [...nextMessages].reverse().find((message) => message.structuredResponse)?.structuredResponse;
      setLastStructured(structured ?? null);
      const lastM = nextMessages[nextMessages.length - 1];
      setPendingDisclaimerMsgId(lastM?.role === 'assistant' ? lastM.id : null);
      router.replace('/(drawer)/');
    })();
    return () => {
      cancelled = true;
    };
  }, [openSession, router]);

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

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }, []);

  const displayLastStructured = lastStructured ? normalizeTriageOneCondition(lastStructured) : null;
  const displayPinnedStructured = pinnedStructured ? normalizeTriageOneCondition(pinnedStructured) : null;

  const showTriageCard =
    displayLastStructured !== null && displayLastStructured.action !== 'ask_more' && !sending;

  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const showAskMoreChips =
    !sending &&
    lastMsg?.role === 'assistant' &&
    lastMsg.structuredResponse?.action === 'ask_more';
  const askMoreOptions =
    lastMsg?.structuredResponse?.question_options?.filter((o) => o?.trim())?.length
      ? (lastMsg.structuredResponse!.question_options as string[])
      : ['Yes', 'No', 'Not sure', 'More detail'];

  async function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!session || !trimmed) return;
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] Calling chat-triage with:', {
        message: trimmed,
        sessionId: session.id,
        messageCount: messages.length,
      });
    }
    if (lastStructured && lastStructured.action !== 'ask_more') {
      setPinnedStructured(lastStructured);
    }
    setPendingDisclaimerMsgId(null);
    setLastStructured(null);
    setSending(true);
    setInput('');
    const result = await sendChatMessage(session, messages, trimmed);
    if (__DEV__) {
      const lastDebug = result.messages[result.messages.length - 1];
      // eslint-disable-next-line no-console
      console.log('[DEBUG] chat-triage done', { connectionFallback: lastDebug?.connectionFallback });
    }
    setSession(result.session);
    setMessages(result.messages);
    setLastStructured(result.structured);
    const last = result.messages[result.messages.length - 1];
    if (last?.role === 'assistant' && !last.connectionFallback) {
      setPendingDisclaimerMsgId(last.id);
    }
    if (last?.connectionFallback) {
      setInput(trimmed);
    }
    setSending(false);
    scrollToEnd();
  }

  async function handleSend() {
    if (!session || !input.trim()) return;
    await sendUserText(input);
  }

  async function handleDefer() {
    // #region agent log
    fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
      body: JSON.stringify({
        sessionId: 'd90aac',
        location: 'index.tsx:handleDefer:entry',
        message: 'Remind pressed',
        data: { hasSession: !!session },
        timestamp: Date.now(),
        hypothesisId: 'H1',
        runId: 'pre-fix',
      }),
    }).catch(() => {});
    // #endregion
    if (!session) {
      // #region agent log
      fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
        body: JSON.stringify({
          sessionId: 'd90aac',
          location: 'index.tsx:handleDefer:no-session',
          message: 'defer aborted — no session',
          data: {},
          timestamp: Date.now(),
          hypothesisId: 'H2',
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    try {
      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.status === 'granted';
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.status === 'granted';
      }
      // #region agent log
      fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
        body: JSON.stringify({
          sessionId: 'd90aac',
          location: 'index.tsx:handleDefer:perm',
          message: 'notification permission',
          data: { granted },
          timestamp: Date.now(),
          hypothesisId: 'H3',
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      if (!granted) {
        Alert.alert('Notifications', 'Allow notifications in Settings so Rapha can remind you.');
      }
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rapha',
          body: 'Rapha will remind you to visit the clinic/hospital in 6 hours.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 6 * 60 * 60,
          repeats: false,
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
        body: JSON.stringify({
          sessionId: 'd90aac',
          location: 'index.tsx:handleDefer:scheduled',
          message: 'scheduled local notification',
          data: { notifId },
          timestamp: Date.now(),
          hypothesisId: 'H4',
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      const updated = await deferSession(session);
      setSession(updated);
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7889/ingest/b65fff1d-83ff-4aa1-9e61-afb69ca06a52', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd90aac' },
        body: JSON.stringify({
          sessionId: 'd90aac',
          location: 'index.tsx:handleDefer:error',
          message: 'defer failed',
          data: { err: e instanceof Error ? e.message : String(e) },
          timestamp: Date.now(),
          hypothesisId: 'H5',
          runId: 'pre-fix',
        }),
      }).catch(() => {});
      // #endregion
      Alert.alert('Reminder', 'Could not schedule the reminder. Try again.');
    }
  }

  async function handleComplete() {
    if (!session) return;
    const updated = await completeSession(session);
    setSession(updated);
    setLastStructured(null);
    setPinnedStructured(null);
  }

  const onNavigateServices = useCallback(
    (action: string) => {
      router.push({ pathname: '/services', params: { action } });
    },
    [router],
  );

  const runImageFlow = useCallback(
    async (source: 'camera' | 'library') => {
      if (!hasSupabaseConfig || !supabase) {
        Alert.alert('Unavailable', 'Sign in and configure the app to scan prescriptions.');
        return;
      }
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow camera or photo library access to scan a prescription.');
        return;
      }
      const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.65,
      });
      if (result.canceled || !result.assets[0]?.base64) return;
      const b64 = result.assets[0].base64;
      // #region agent log
      dbgIngestLog({
        hypothesisId: 'H3',
        location: 'index.tsx:runImageFlow',
        message: 'prescription-ocr invoke',
        data: { b64Len: b64.length },
      });
      // #endregion
      const { data, error } = await supabase.functions.invoke('prescription-ocr', {
        body: { image_base64: b64 },
      });
      const meds = (data as { extracted_medications?: { drug_name: string }[] } | null)?.extracted_medications ?? [];
      const names = meds.map((m) => m.drug_name).filter(Boolean);
      // #region agent log
      dbgIngestLog({
        hypothesisId: 'H3',
        location: 'index.tsx:runImageFlow:after',
        message: error ? 'ocr error' : 'ocr response',
        data: { err: error?.message ?? null, medCount: names.length },
      });
      // #endregion
      if (error) {
        Alert.alert('Prescription scan', 'Could not read this image. Try a clearer photo.');
        return;
      }
      Alert.alert(
        'Prescription scan',
        names.length > 0 ? `Possible medications: ${names.join(', ')}.` : 'No medications were detected from this image.',
        [
          {
            text: 'Find pharmacies',
            onPress: () => router.push({ pathname: '/services', params: { action: 'pharmacy' } }),
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
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
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.headerBar}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Dr Lucas</Text>
            <Text style={styles.headerSubtitle}>AI Health Assistant</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => void runImageFlow('camera')}
              style={styles.headerSideBtn}
            >
              <Camera size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={12}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={styles.headerSideBtn}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing.sm }]}
          ListEmptyComponent={messages.length === 0 && !sending ? emptyState : null}
          ListHeaderComponent={
            displayPinnedStructured ? (
              <PinnedTriageBanner
                structured={displayPinnedStructured}
                onOpenServices={() => {
                  const c0 = displayPinnedStructured.conditions[0];
                  const act =
                    displayPinnedStructured.action === 'emergency'
                      ? 'emergency'
                      : displayPinnedStructured.action === 'hospital'
                        ? 'hospital'
                        : displayPinnedStructured.action === 'clinic'
                          ? 'clinic'
                          : displayPinnedStructured.action === 'pharmacy'
                            ? 'pharmacy'
                            : 'default';
                  router.push({
                    pathname: '/services',
                    params: { action: act, conditionName: c0?.name ?? '' },
                  });
                }}
              />
            ) : null
          }
          ListFooterComponent={sending ? <TypingBubble /> : null}
          renderItem={({ item }) => (
            <MessageRow
              message={item}
              connectionFallback={item.connectionFallback === true}
              showDisclaimer={pendingDisclaimerMsgId === item.id && item.role === 'assistant'}
            />
          )}
          onContentSizeChange={scrollToEnd}
        />

        {showTriageCard && displayLastStructured ? (
          <TriageCards
            structured={displayLastStructured}
            onDefer={handleDefer}
            onComplete={handleComplete}
            onNavigateServices={onNavigateServices}
          />
        ) : null}

        {showAskMoreChips ? (
          <View style={styles.mcqWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mcqScroll}
            >
              {askMoreOptions.map((opt) => (
                <Pressable key={opt} style={styles.mcqChip} onPress={() => void sendUserText(opt)}>
                  <Text style={styles.mcqChipText}>{opt}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>Rapha assists but does not replace a doctor</Text>

        <View style={[styles.composerOuter, { paddingBottom: Platform.OS === 'ios' ? 34 : 16 }]}>
          <View style={styles.composerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach"
              hitSlop={8}
              style={styles.attachBtn}
              onPress={() => void runImageFlow('library')}
            >
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
              textAlignVertical="center"
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

function MessageRow({
  message,
  connectionFallback,
  showDisclaimer,
}: {
  message: ChatMessage;
  connectionFallback: boolean;
  showDisclaimer?: boolean;
}) {
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
          {showDisclaimer ? (
            <Text style={styles.bubbleDisclaimer}>
              Rapha helps you find care but does not replace a doctor.
            </Text>
          ) : null}
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
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    ...typography.h3,
    fontSize: 20,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerSideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    color: colors.textTertiary,
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
    shadowColor: colors.ink,
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
  bubbleDisclaimer: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  pinnedBar: {
    backgroundColor: colors.mildLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.mild,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  pinnedBarPressed: { opacity: 0.9 },
  pinnedBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mild,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pinnedBarSub: { ...typography.body, marginTop: 2, fontWeight: '600' },
  pinnedBarHint: { ...typography.caption, marginTop: 4, color: colors.textSecondary },
  mcqWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  mcqScroll: { gap: spacing.sm, paddingVertical: 2 },
  mcqChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  mcqChipText: { ...typography.bodySmall, color: colors.textPrimary },
  composerOuter: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
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
  confidenceWrap: { gap: 6 },
  confidenceTrackSingle: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  confidenceFillSingle: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  confidencePct: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
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
