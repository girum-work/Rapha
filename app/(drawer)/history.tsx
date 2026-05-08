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
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../../src/components/Skeleton';
import { formatRelative } from '../../src/lib/dateUtils';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ChatMsg = {
  id?: string;
  content: string;
  role: string;
  created_at: string;
};

type ChatSessionRow = {
  id: string;
  status: string;
  started_at: string;
  final_action: string | null;
  final_severity: 'critical' | 'urgent' | 'mild' | null;
  chat_messages?: ChatMsg[] | null;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isToday(d: Date) {
  return startOfDay(d).getTime() === startOfDay(new Date()).getTime();
}

function isYesterday(d: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return startOfDay(d).getTime() === startOfDay(y).getTime();
}

function subDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
}

function groupSessions(sessions: ChatSessionRow[]) {
  const today = new Date();
  const weekAgo = subDays(today, 7);
  const grouped = {
    today: [] as ChatSessionRow[],
    yesterday: [] as ChatSessionRow[],
    thisWeek: [] as ChatSessionRow[],
    earlier: [] as ChatSessionRow[],
  };
  for (const s of sessions) {
    const d = new Date(s.started_at);
    if (isToday(d)) grouped.today.push(s);
    else if (isYesterday(d)) grouped.yesterday.push(s);
    else if (d.getTime() > weekAgo.getTime() && !isToday(d) && !isYesterday(d)) grouped.thisWeek.push(s);
    else grouped.earlier.push(s);
  }
  return grouped;
}

function firstUserLine(messages: ChatMsg[] | undefined): string {
  if (!messages?.length) return '';
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const u = sorted.find((m) => m.role === 'user');
  return u?.content ?? '';
}

function subtitleFor(session: ChatSessionRow): string {
  const fa = session.final_action;
  if (session.status === 'active' || session.status === 'deferred') return 'In progress...';
  switch (fa) {
    case 'emergency':
      return 'Emergency care recommended';
    case 'hospital':
      return 'Hospital visit recommended';
    case 'clinic':
      return 'Clinic visit recommended';
    case 'pharmacy':
      return 'Pharmacy referral';
    case 'first_aid':
      return 'First aid guidance';
    case 'self_care':
      return 'Home monitoring advised';
    case 'ask_more':
      return 'More detail needed';
    default:
      return 'Consultation';
  }
}

function circleStyle(session: ChatSessionRow): { bg: string; glyph: string } {
  const fa = session.final_action;
  const sev = session.final_severity;
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
    if (!hasSupabaseConfig || !supabase) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setSessions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, status, started_at, final_action, final_severity, chat_messages(id, content, role, created_at)')
      .eq('user_id', uid)
      .order('started_at', { ascending: false });
    setSessions((data as ChatSessionRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'thisWeek', label: 'This week' },
    { key: 'earlier', label: 'Earlier' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h2}>History</Text>
        <Text style={styles.sub}>Your consultations with Dr Lucas</Text>
        <View style={styles.search}>
          <Search size={18} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search consultations..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.skeletonCol}>
          <Skeleton width="100%" height={80} radius={12} />
          <Skeleton width="92%" height={56} radius={12} />
          <Skeleton width="88%" height={56} radius={12} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <MessageSquare size={48} color={colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No consultations yet</Text>
          <Text style={styles.emptySub}>Your conversation history with Dr Lucas will appear here</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(drawer)/')}>
            <Text style={styles.emptyBtnText}>Start your first consultation</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.md }]}
          showsVerticalScrollIndicator={false}
        >
          {sections.map(({ key, label }) => {
            const rows = grouped[key];
            if (!rows.length) return null;
            return (
              <View key={key}>
                <Text style={styles.sectionLabel}>{label}</Text>
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

function SessionRowItem({
  session,
  expanded,
  onToggle,
}: {
  session: ChatSessionRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const title =
    firstUserLine(session.chat_messages ?? undefined) ||
    `Consultation ${new Date(session.started_at).toLocaleDateString()}`;
  const sub = subtitleFor(session);
  const { bg, glyph } = circleStyle(session);
  const msgs = session.chat_messages ?? [];
  const sorted = [...msgs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const tail = sorted.slice(-6);

  const showResume = session.status === 'active' || session.status === 'deferred';

  return (
    <View style={styles.rowOuter}>
      <Pressable style={styles.row} onPress={onToggle}>
        <View style={[styles.sevCircle, { backgroundColor: bg }]}>
          <Text style={styles.sevGlyph}>{glyph}</Text>
        </View>
        <View style={styles.rowCenter}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub}
          </Text>
          <Text style={styles.rowTime}>{formatRelative(session.started_at)}</Text>
        </View>
        <View style={styles.rowRight}>
          <StatusBadge status={session.status} />
          {expanded ? (
            <ChevronDown size={18} color={colors.textTertiary} />
          ) : (
            <ChevronRight size={18} color={colors.textTertiary} />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.thread}>
          {tail.map((m, idx) =>
            m.role === 'user' ? (
              <View key={m.id ?? `${session.id}-u-${idx}`} style={styles.msgUserOuter}>
                <View style={styles.msgUser}>
                  <Text style={styles.msgUserText}>{m.content}</Text>
                </View>
              </View>
            ) : (
              <View key={m.id ?? `${session.id}-a-${idx}`} style={styles.msgAsstOuter}>
                <View style={styles.msgAsst}>
                  <Text style={styles.msgAsstText}>{m.content}</Text>
                </View>
              </View>
            ),
          )}
          <View style={styles.threadActions}>
            {showResume ? (
              <Pressable
                style={styles.resumeBtn}
                onPress={() => router.push({ pathname: '/(drawer)/', params: { openSession: session.id } })}
              >
                <Text style={styles.resumeText}>Resume →</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.viewBtn}
              onPress={() => router.push({ pathname: '/(drawer)/', params: { openSession: session.id } })}
            >
              <Text style={styles.viewText}>View full</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
        <Text style={[styles.badgeText, { color: colors.accentDark }]}>Active</Text>
      </View>
    );
  }
  if (status === 'deferred') {
    return (
      <View style={[styles.badge, { backgroundColor: colors.urgentLight }]}>
        <Clock size={14} color={colors.urgent} strokeWidth={2} />
      </View>
    );
  }
  if (status === 'completed') {
    return (
      <View style={[styles.badge, { backgroundColor: colors.mildLight }]}>
        <Check size={14} color={colors.mild} strokeWidth={3} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  h2: { ...typography.h2 },
  sub: { fontSize: 13, color: colors.textSecondary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
  },
  skeletonCol: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md },
  scroll: { paddingBottom: spacing.xxl, paddingHorizontal: 0 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingLeft: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  rowOuter: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sevCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevGlyph: { fontSize: 18 },
  rowCenter: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rowTime: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  badge: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  thread: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  msgUserOuter: { alignItems: 'flex-end' },
  msgUser: {
    maxWidth: '85%',
    backgroundColor: colors.userBubble,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  msgUserText: { fontSize: 13, color: colors.userText, lineHeight: 18 },
  msgAsstOuter: { alignItems: 'flex-start' },
  msgAsst: {
    maxWidth: '85%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  msgAsstText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  threadActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  resumeBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  resumeText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  viewBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  viewText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md },
  emptySub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  emptyBtnText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 15 },
});
