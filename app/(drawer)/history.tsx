import { useRouter } from 'expo-router';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Search,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../../src/components/Skeleton';
import { formatRelative } from '../../src/lib/dateUtils';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ChatMsg = { id?: string; content: string; role: string; created_at: string };
type ChatSessionRow = {
  id: string; status: string; started_at: string;
  final_action: string | null; final_severity: 'critical' | 'urgent' | 'mild' | null;
  chat_messages?: ChatMsg[] | null;
};

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function isToday(d: Date) { return startOfDay(d).getTime() === startOfDay(new Date()).getTime(); }
function isYesterday(d: Date) {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return startOfDay(d).getTime() === startOfDay(y).getTime();
}
function subDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() - n); return x; }

function groupSessions(sessions: ChatSessionRow[]) {
  const today = new Date(); const weekAgo = subDays(today, 7);
  const grouped = { today: [] as ChatSessionRow[], yesterday: [] as ChatSessionRow[], thisWeek: [] as ChatSessionRow[], earlier: [] as ChatSessionRow[] };
  for (const s of sessions) {
    const d = new Date(s.started_at);
    if (isToday(d)) grouped.today.push(s);
    else if (isYesterday(d)) grouped.yesterday.push(s);
    else if (d.getTime() > weekAgo.getTime()) grouped.thisWeek.push(s);
    else grouped.earlier.push(s);
  }
  return grouped;
}

function firstUserLine(messages: ChatMsg[] | undefined): string {
  if (!messages?.length) return '';
  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return sorted.find((m) => m.role === 'user')?.content ?? '';
}

function subtitleFor(session: ChatSessionRow): string {
  if (session.status === 'active' || session.status === 'deferred') return 'In progress...';
  const map: Record<string, string> = {
    emergency: 'Emergency care recommended', hospital: 'Hospital visit recommended',
    clinic: 'Clinic visit recommended', pharmacy: 'Pharmacy referral',
    first_aid: 'First aid guidance', self_care: 'Home monitoring advised', ask_more: 'More detail needed',
  };
  return map[session.final_action ?? ''] ?? 'Consultation';
}

function circleStyle(session: ChatSessionRow): { bg: string; glyph: string } {
  const fa = session.final_action; const sev = session.final_severity;
  if (fa === 'pharmacy') return { bg: colors.accentLight, glyph: '💊' };
  if (fa === 'first_aid') return { bg: colors.infoLight, glyph: '🩹' };
  if (sev === 'critical') return { bg: colors.emergencyLight, glyph: '🚨' };
  if (sev === 'urgent') return { bg: colors.urgentLight, glyph: '⚠️' };
  if (sev === 'mild') return { bg: colors.mildLight, glyph: '✓' };
  return { bg: colors.surfaceSoft, glyph: '💬' };
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (!hasSupabaseConfig || !supabase) { setSessions([]); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSessions([]); setLoading(false); return; }
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, status, started_at, final_action, final_severity, chat_messages(id, content, role, created_at)')
      .eq('user_id', uid)
      .order('started_at', { ascending: false });
    setSessions((data as ChatSessionRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const title = firstUserLine(s.chat_messages ?? undefined) || subtitleFor(s);
      return title.toLowerCase().includes(q) || subtitleFor(s).toLowerCase().includes(q);
    });
  }, [sessions, query]);

  const grouped = useMemo(() => groupSessions(filtered), [filtered]);

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === id ? null : id));
  }

  const sections: { key: keyof ReturnType<typeof groupSessions>; label: string }[] = [
    { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' },
    { key: 'thisWeek', label: 'This week' }, { key: 'earlier', label: 'Earlier' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 pb-2 gap-1">
        <Text className="text-[26px] font-bold text-foreground">History</Text>
        <Text className="text-[13px] text-muted-foreground">Your consultations with Dr Lucas</Text>
        <View className="flex-row items-center gap-2 bg-card border border-border rounded-xl px-4 mt-3 min-h-[44px]">
          <Search size={18} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            className="flex-1 text-[15px] text-foreground py-[10px]"
            placeholder="Search consultations..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loading ? (
        <View className="px-4 pt-4 gap-4">
          <Skeleton width="100%" height={80} radius={12} />
          <Skeleton width="92%" height={56} radius={12} />
          <Skeleton width="88%" height={56} radius={12} />
        </View>
      ) : sessions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-2">
          <MessageSquare size={48} color={colors.textTertiary} strokeWidth={1.5} />
          <Text className="text-[18px] font-bold text-foreground mt-4">No consultations yet</Text>
          <Text className="text-[14px] text-muted-foreground text-center">Your conversation history will appear here</Text>
          <Pressable
            className="mt-6 bg-primary px-8 py-[14px] rounded-2xl"
            onPress={() => router.push('/(drawer)/')}
          >
            <Text className="text-primary-foreground font-bold text-[15px]">Start your first consultation</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {sections.map(({ key, label }) => {
            const rows = grouped[key];
            if (!rows.length) return null;
            return (
              <View key={key}>
                <Text className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pl-4 mt-5 mb-2">
                  {label}
                </Text>
                {rows.map((session) => (
                  <SessionRowItem
                    key={session.id}
                    session={session}
                    expanded={expanded === session.id}
                    onToggle={() => toggleExpand(session.id)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SessionRowItem({ session, expanded, onToggle }: {
  session: ChatSessionRow; expanded: boolean; onToggle: () => void;
}) {
  const router = useRouter();
  const title = firstUserLine(session.chat_messages ?? undefined) || `Consultation ${new Date(session.started_at).toLocaleDateString()}`;
  const sub = subtitleFor(session);
  const { bg, glyph } = circleStyle(session);
  const sorted = [...(session.chat_messages ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const tail = sorted.slice(-6);
  const showResume = session.status === 'active' || session.status === 'deferred';

  return (
    <View className="mx-4 mb-2 bg-card rounded-xl overflow-hidden border border-border">
      <Pressable className="flex-row items-center p-4 gap-3" onPress={onToggle}>
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: bg }}>
          <Text className="text-[18px]">{glyph}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-foreground" numberOfLines={1}>{title}</Text>
          <Text className="text-[13px] text-muted-foreground mt-0.5" numberOfLines={1}>{sub}</Text>
          <Text className="text-[12px] text-muted-foreground/60 mt-1">{formatRelative(session.started_at)}</Text>
        </View>
        <View className="items-end gap-1.5">
          <StatusBadge status={session.status} />
          {expanded ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />}
        </View>
      </Pressable>

      {expanded ? (
        <View className="px-4 pb-4 border-t border-border gap-2">
          {tail.map((m, idx) =>
            m.role === 'user' ? (
              <View key={m.id ?? `${session.id}-u-${idx}`} className="items-end">
                <View className="max-w-[85%] rounded-2xl py-[10px] px-[14px]" style={{ backgroundColor: colors.userBubble }}>
                  <Text className="text-[13px] leading-[18px]" style={{ color: colors.userText }}>{m.content}</Text>
                </View>
              </View>
            ) : (
              <View key={m.id ?? `${session.id}-a-${idx}`} className="items-start">
                <View className="max-w-[85%] bg-card border border-border rounded-2xl py-[10px] px-[14px]">
                  <Text className="text-[13px] text-foreground leading-[18px]">{m.content}</Text>
                </View>
              </View>
            ),
          )}
          <View className="flex-row gap-3 mt-2 justify-end">
            {showResume ? (
              <Pressable className="py-2 px-3" onPress={() => router.push({ pathname: '/(drawer)/', params: { openSession: session.id } })}>
                <Text className="text-[13px] font-bold text-primary">Resume →</Text>
              </Pressable>
            ) : null}
            <Pressable className="py-2 px-3" onPress={() => router.push({ pathname: '/(drawer)/', params: { openSession: session.id } })}>
              <Text className="text-[13px] font-semibold text-muted-foreground">View full</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <View className="min-w-[28px] h-6 px-2 rounded-full items-center justify-center flex-row" style={{ backgroundColor: colors.accentLight }}>
      <Text className="text-[11px] font-bold" style={{ color: colors.accentDark }}>Active</Text>
    </View>
  );
  if (status === 'deferred') return (
    <View className="min-w-[28px] h-6 px-2 rounded-full items-center justify-center flex-row" style={{ backgroundColor: colors.urgentLight }}>
      <Clock size={14} color={colors.urgent} strokeWidth={2} />
    </View>
  );
  if (status === 'completed') return (
    <View className="min-w-[28px] h-6 px-2 rounded-full items-center justify-center flex-row" style={{ backgroundColor: colors.mildLight }}>
      <Check size={14} color={colors.mild} strokeWidth={3} />
    </View>
  );
  return null;
}
