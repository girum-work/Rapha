import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { ArrowUp, Camera, MoreHorizontal, Paperclip, Stethoscope } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RichContent } from '../../src/components/chat/RichContent';
import { dbgIngestLog } from '../../src/lib/debugIngest';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import {
  completeSession,
  deferSession,
  getOrCreateSession,
  hydrateSessionFromRemote,
  sendChatMessage,
} from '../../src/lib/sessionStore';
import { colors, spacing } from '../../src/theme';
import { ChatMessage, ChatSession, TriageResponse } from '../../src/types';
import { useAppStore, useMessages, useDrLucasStatus } from '../../src/store';
import { useProfileQuery } from '../../src/hooks/queries';

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
    <View className="gap-1.5">
      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
        <View className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: colors.accent }} />
      </View>
      <Text className="text-[12px] font-semibold text-muted-foreground">{pctLabel}% confidence</Text>
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
  return (
    <View className="flex-row items-end mb-4 gap-2">
      <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.drLucasBubble }}>
        <Text className="text-[12px] font-bold" style={{ color: colors.drLucasText }}>DL</Text>
      </View>
      <View className="max-w-[85%]">
        <View className="flex-row items-center gap-1.5 rounded-[18px] rounded-bl-[4px] py-[14px] px-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          {[0, 120, 240].map((delay) => (
            <MotiView
              key={delay}
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textTertiary }}
              from={{ scale: 1 }}
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ type: 'timing', duration: 560, delay, loop: true }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function TriageCards({
  structured, onDefer, onComplete, onNavigateServices,
}: {
  structured: TriageResponse; onDefer: () => void; onComplete: () => void; onNavigateServices: (action: string) => void;
}) {
  const c0 = structured.conditions[0];

  if (structured.action === 'emergency') {
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="rounded-xl mx-4 mb-2 p-4 border-l-4"
        style={{ backgroundColor: colors.emergencyLight, borderLeftColor: colors.emergency }}>
        <Text className="text-[16px] font-bold" style={{ color: colors.emergency }}>🚨 Emergency — Immediate Care Needed</Text>
        {c0 ? (<><Text className="text-[14px] leading-5 mt-2 text-foreground">{c0.name}</Text><Text className="text-[13px] text-muted-foreground mt-1">{c0.rationale}</Text></>) : (<Text className="text-[14px] leading-5 mt-2 text-foreground">Seek emergency care now if symptoms are severe.</Text>)}
        <View className="h-2" /><ConfidenceBar confidence={structured.confidence} /><View className="h-3" />
        <Pressable className="rounded-xl py-[14px] items-center" style={{ backgroundColor: colors.emergency }} onPress={() => onNavigateServices('emergency')}>
          <Text className="text-[15px] font-semibold" style={{ color: colors.textOnEmergency }}>Get Emergency Help →</Text>
        </Pressable>
        <View className="h-2" />
        <Pressable className="rounded-xl py-[14px] items-center bg-card border" style={{ borderColor: colors.emergency }} onPress={() => void Linking.openURL('tel:907')}>
          <Text className="text-[15px] font-semibold" style={{ color: colors.emergency }}>Call emergency contact</Text>
        </Pressable>
      </MotiView>
    );
  }

  if (structured.action === 'hospital' || structured.action === 'clinic') {
    const isHospital = structured.action === 'hospital';
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="rounded-xl mx-4 mb-2 p-4 border-l-4"
        style={{ backgroundColor: colors.urgentLight, borderLeftColor: colors.urgent }}>
        <Text className="text-[16px] font-bold" style={{ color: colors.urgent }}>{isHospital ? '🏥 Hospital care suggested' : '🩺 Clinic visit suggested'}</Text>
        {c0 ? (<><Text className="text-[14px] leading-5 mt-2 text-foreground">{c0.name}</Text><Text className="text-[13px] text-muted-foreground mt-1">{c0.rationale}</Text></>) : null}
        <View className="h-2" /><ConfidenceBar confidence={structured.confidence} /><View className="h-3" />
        <Pressable className="rounded-xl py-[14px] items-center" style={{ backgroundColor: colors.urgent }} onPress={() => onNavigateServices(isHospital ? 'hospital' : 'clinic')}>
          <Text className="text-[15px] font-semibold text-white">{isHospital ? 'Find nearest hospital →' : 'Find nearest clinic →'}</Text>
        </Pressable>
        <View className="h-2" />
        <Pressable className="rounded-xl py-[14px] items-center bg-card border" style={{ borderColor: colors.urgent }} onPress={onDefer}>
          <Text className="text-[15px] font-semibold" style={{ color: colors.urgent }}>Remind me in 6 hours</Text>
        </Pressable>
      </MotiView>
    );
  }

  if (structured.action === 'pharmacy') {
    const chips = structured.required_services?.filter((s) => s.length > 0 && s !== 'pharmacy') ?? [];
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="rounded-xl mx-4 mb-2 p-4 border-l-4"
        style={{ backgroundColor: colors.mildLight, borderLeftColor: colors.mild }}>
        <Text className="text-[16px] font-bold" style={{ color: colors.mild }}>💊 Pharmacy</Text>
        <Text className="text-[13px] text-muted-foreground mt-1">We will help you find stock nearby.</Text>
        {chips.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 mt-2">
            {chips.map((d) => (
              <View key={d} className="px-2 py-1 rounded-md" style={{ backgroundColor: colors.accentLight }}>
                <Text className="text-[12px] font-semibold" style={{ color: colors.accentDark }}>{d}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="h-3" />
        <Pressable className="rounded-xl py-[14px] items-center" style={{ backgroundColor: colors.mild }} onPress={() => onNavigateServices('pharmacy')}>
          <Text className="text-[15px] font-semibold text-white">Find pharmacy with stock →</Text>
        </Pressable>
      </MotiView>
    );
  }

  if (structured.action === 'first_aid') {
    const primary = structured.conditions.length > 0 ? [...structured.conditions].sort((a, b) => b.confidence - a.confidence)[0]! : null;
    const steps = primary
      ? [{ n: 1, title: primary.name, detail: primary.rationale }]
      : structured.red_flags.length > 0
        ? [{ n: 1, title: structured.red_flags[0]!, detail: '' }]
        : [{ n: 1, title: 'General care', detail: 'Follow safe rest and hydration guidance.' }];
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="rounded-xl mx-4 mb-2 p-4 border-l-4"
        style={{ backgroundColor: colors.infoLight, borderLeftColor: colors.info }}>
        <Text className="text-[16px] font-bold" style={{ color: colors.info }}>🩹 First aid</Text>
        {steps.map((s) => (
          <View key={s.n} className="flex-row items-start gap-3 mt-2">
            <Text className="text-[13px] font-bold w-[22px]" style={{ color: colors.info }}>{s.n}.</Text>
            <View className="flex-1">
              <Text className="text-[14px] leading-5 text-foreground">{s.title}</Text>
              {s.detail ? <Text className="text-[13px] text-muted-foreground mt-1">{s.detail}</Text> : null}
            </View>
            <View className="w-[18px] h-[18px] rounded-[4px] border mt-0.5" style={{ borderColor: colors.borderStrong }} />
          </View>
        ))}
        <View className="h-3" />
        <Pressable className="rounded-xl py-[14px] items-center" style={{ backgroundColor: colors.info }} onPress={onComplete}>
          <Text className="text-[15px] font-semibold text-white">I&apos;ve completed first aid</Text>
        </Pressable>
      </MotiView>
    );
  }

  if (structured.action === 'self_care') {
    return (
      <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="rounded-xl mx-4 mb-2 p-4 border-l-4 bg-background"
        style={{ borderLeftColor: colors.textTertiary }}>
        <Text className="text-[16px] font-bold text-muted-foreground">Self care</Text>
        <Text className="text-[13px] text-muted-foreground mt-1">Watch for these warning signs:</Text>
        {structured.red_flags.map((t) => (
          <Text key={t} className="text-[13px] text-foreground mt-1">• {t}</Text>
        ))}
        <View className="h-3" />
        <Pressable className="rounded-xl py-[14px] items-center bg-card border" style={{ borderColor: colors.borderStrong }} onPress={onComplete}>
          <Text className="text-[15px] font-semibold text-muted-foreground">I&apos;m feeling worse — restart</Text>
        </Pressable>
      </MotiView>
    );
  }

  return null;
}

function PinnedTriageBanner({ structured, onOpenServices }: {
  structured: TriageResponse; onOpenServices: () => void;
}) {
  const c0 = structured.conditions[0];
  const label = { emergency: 'Emergency', hospital: 'Hospital', clinic: 'Clinic', pharmacy: 'Pharmacy', first_aid: 'First aid', self_care: 'Self care', ask_more: 'Consultation' }[structured.action] ?? 'Care';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpenServices}
      className="rounded-xl mb-4 p-3 border"
      style={({ pressed }) => ([
        { backgroundColor: colors.mildLight, borderColor: colors.mild },
        pressed && { opacity: 0.9 },
      ])}
    >
      <Text className="text-[12px] font-bold uppercase tracking-[0.4px]" style={{ color: colors.mild }}>Pinned · {label}</Text>
      <Text className="text-[14px] font-semibold text-foreground mt-0.5" numberOfLines={1}>{c0?.name ?? 'Your triage result'}</Text>
      <Text className="text-[12px] text-muted-foreground mt-1">Tap for Care Options</Text>
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

  // Zustand store sync
  const { addMessage: storeAddMessage, setDrLucasStatus, setActionCard } = useAppStore();
  const { data: profile } = useProfileQuery();

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
    if (lastStructured && lastStructured.action !== 'ask_more') {
      setPinnedStructured(lastStructured);
    }
    setPendingDisclaimerMsgId(null);
    setLastStructured(null);
    setSending(true);
    setInput('');
    setDrLucasStatus('thinking');
    setActionCard(null);
    // Optimistically add user message to store
    storeAddMessage({
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    });
    setTimeout(() => setDrLucasStatus('responding'), 800);
    const result = await sendChatMessage(session, messages, trimmed);
    setSession(result.session);
    setMessages(result.messages);
    setLastStructured(result.structured);
    const last = result.messages[result.messages.length - 1];
    if (last?.role === 'assistant') {
      // Add assistant reply to store
      storeAddMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: last.content,
        structured_response: last.structuredResponse as Record<string, unknown> | undefined,
        created_at: last.createdAt ?? new Date().toISOString(),
      });
      if (!last.connectionFallback) setPendingDisclaimerMsgId(last.id);
    }
    if (result.structured?.action && result.structured.action !== 'ask_more') {
      setActionCard(result.structured as Record<string, unknown>);
    }
    if (last?.connectionFallback) setInput(trimmed);
    setSending(false);
    setDrLucasStatus('idle');
    scrollToEnd();
  }

  async function handleSend() {
    if (!session || !input.trim()) return;
    await sendUserText(input);
  }

  async function handleDefer() {
    if (!session) return;
    try {
      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.status === 'granted';
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.status === 'granted';
      }
      if (!granted) {
        Alert.alert('Notifications', 'Allow notifications in Settings so Rapha can remind you.');
      }
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Rapha', body: 'Rapha will remind you to visit the clinic/hospital in 6 hours.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 6 * 60 * 60, repeats: false },
      });
      const updated = await deferSession(session);
      setSession(updated);
    } catch {
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
      <View className="flex-1 items-center justify-center py-12 px-8">
        <View className="w-[88px] h-[88px] rounded-full items-center justify-center mb-6" style={{ backgroundColor: colors.accentLight }}>
          <Stethoscope size={36} color={colors.accent} strokeWidth={2} />
        </View>
        <Text className="text-[22px] font-bold text-foreground text-center mb-2">
          {greetingPrefix()}, {displayName || 'there'}
        </Text>
        <Text className="text-[15px] text-muted-foreground text-center leading-6 mb-6">
          I&apos;m Dr Lucas. Describe your symptoms and I&apos;ll help you find the right care.
        </Text>
        <View className="gap-3 w-full">
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s.label}
              className="bg-card border border-border rounded-full py-3 px-4 items-center"
              onPress={() => setInput(s.text)}
            >
              <Text className="text-[14px] text-foreground text-center">{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [displayName],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <View className="flex-row items-center justify-between px-4 py-1 bg-background">
          <View className="flex-1">
            <Text className="text-[20px] font-bold text-foreground">Dr Lucas</Text>
            <Text className="text-[12px] text-muted-foreground mt-0.5">AI Health Assistant</Text>
          </View>
          <View className="flex-row items-center">
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => void runImageFlow('camera')}
              className="w-11 h-11 items-center justify-center"
            >
              <Camera size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open menu"
              hitSlop={12}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              className="w-11 h-11 items-center justify-center"
            >
              <MoreHorizontal size={22} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          className="flex-1"
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8, flexGrow: 1 }}
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
          <View className="px-4 py-1">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              {askMoreOptions.map((opt) => (
                <Pressable key={opt} className="bg-card border border-border rounded-full py-2 px-4 mr-2" onPress={() => void sendUserText(opt)}>
                  <Text className="text-[13px] text-foreground">{opt}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text className="text-[11px] text-center text-muted-foreground px-6 py-1">
          Rapha assists but does not replace a doctor
        </Text>

        <View className="bg-background px-4 pt-1" style={{ paddingBottom: Platform.OS === 'ios' ? 34 : 16 }}>
          <View className="flex-row items-end gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach"
              hitSlop={8}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
              onPress={() => void runImageFlow('library')}
            >
              <Paperclip size={18} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
            <TextInput
              className="flex-1 bg-card border border-border rounded-3xl py-3 px-4 text-[15px] text-foreground"
              style={{ minHeight: 44, maxHeight: 22 * 4 + 24, textAlignVertical: 'center' }}
              value={input}
              onChangeText={setInput}
              placeholder="Message Dr Lucas..."
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={4000}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleSend}
              disabled={!input.trim() || sending}
              className="w-11 h-11 rounded-full items-center justify-center"
              style={{ backgroundColor: (!input.trim() || sending) ? colors.borderStrong : colors.accent }}
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
      <MotiView
        from={{ opacity: 0, translateX: 20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 250 }}
        className="items-end mb-4"
      >
        <View className="max-w-[75%] rounded-[18px] rounded-br-[4px] py-3 px-4" style={{ backgroundColor: colors.userBubble }}>
          <Text className="text-[15px] leading-[22px]" style={{ color: colors.userText }}>{message.content}</Text>
        </View>
      </MotiView>
    );
  }
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 250 }}
      className="flex-row items-end mb-4 gap-2"
    >
      <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.drLucasBubble }}>
        <Text className="text-[12px] font-bold" style={{ color: colors.drLucasText }}>DL</Text>
      </View>
      <View className="max-w-[85%] flex-shrink">
        <View
          className="rounded-[18px] rounded-bl-[4px] py-3 px-4"
          style={[
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            connectionFallback && { backgroundColor: colors.urgentLight, borderColor: colors.urgent },
          ]}
        >
          <Text className="text-[15px] leading-[22px]" style={connectionFallback ? { color: colors.urgent, fontWeight: '600' } : { color: colors.textPrimary }}>
            {message.content}
          </Text>
          <RichContent structured={message.structuredResponse} />
          {showDisclaimer ? (
            <Text className="text-[10px] leading-[14px] text-muted-foreground mt-2">
              Rapha helps you find care but does not replace a doctor.
            </Text>
          ) : null}
        </View>
      </View>
    </MotiView>
  );
}


