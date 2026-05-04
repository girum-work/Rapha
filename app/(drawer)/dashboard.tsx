import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Droplets,
  Heart,
  MessageCircle,
  Pill,
  Stethoscope,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../../src/components/Skeleton';
import { getOrCreateSession } from '../../src/lib/sessionStore';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors, radius, spacing, typography } from '../../src/theme';

type ProfileRow = {
  display_name: string | null;
  blood_type: string | null;
  allergies: string[] | null;
  current_medications: string[] | null;
  chronic_conditions: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

type ChatMsg = { content: string; role: string; created_at: string };
type ChatSessionRow = {
  id: string;
  status: string;
  started_at: string;
  final_severity: 'critical' | 'urgent' | 'mild' | null;
  final_action: string | null;
  chat_messages?: ChatMsg[] | null;
};

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const t = d.getTime();
  if (t >= dayStart) return 'Today';
  if (t >= yStart) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function firstUserPreview(messages: ChatMsg[] | null | undefined): string {
  if (!messages?.length) return '';
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const first = sorted.find((m) => m.role === 'user');
  return first?.content ?? '';
}

function actionTitle(action: string | null): string {
  switch (action) {
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
      return 'More information needed';
    default:
      return 'Consultation';
  }
}

const WEEK_TIPS = [
  '💧 Drink at least 8 glasses of water today. Dehydration is a leading cause of headaches and fatigue in Addis Ababa\'s climate.',
  '🏃 Even 20 minutes of walking reduces blood pressure and improves mood. Entoto Park is a great option.',
  '🌿 Teff, the grain in injera, is high in iron. It naturally helps prevent anaemia — common in Ethiopia.',
  '😴 7-9 hours of sleep strengthens your immune system. Consistent sleep time matters more than duration.',
  '🦟 Malaria season peaks April-June. Use mosquito nets and report fever immediately — early treatment works.',
  '🤲 Wash hands before eating and after the toilet. 80% of common infections spread through unwashed hands.',
  '📋 Update your medical profile so Dr Lucas has your allergies and medications when you need help most.',
];

function tipForToday(): { title: string; body: string } {
  const d = new Date().getDay();
  const mondayIdx = d === 0 ? 6 : d - 1;
  const body = WEEK_TIPS[mondayIdx] ?? WEEK_TIPS[0];
  const emojiEnd = body.indexOf(' ');
  const icon = emojiEnd > 0 ? body.slice(0, emojiEnd) : '💡';
  const rest = emojiEnd > 0 ? body.slice(emojiEnd + 1).trim() : body;
  return { title: `${icon} Daily tip`, body: rest };
}

function PulseOrb({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return (
    <Animated.View style={[styles.healthOrbWrap, { transform: [{ scale }] }]}>
      <LinearGradient colors={[colors.accent, colors.primary]} style={styles.healthOrbGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Heart size={28} color={colors.textOnAccent} fill="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      </LinearGradient>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [activeRemote, setActiveRemote] = useState<ChatSessionRow | null>(null);
  const [localActive, setLocalActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const local = await getOrCreateSession();
    setLocalActive(local.session.status === 'active' || local.session.status === 'deferred');

    if (!hasSupabaseConfig || !supabase) {
      setProfile(null);
      setSessions([]);
      setActiveRemote(null);
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setProfile(null);
      setSessions([]);
      setActiveRemote(null);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select(
        'display_name, blood_type, allergies, current_medications, chronic_conditions, emergency_contact_name, emergency_contact_phone',
      )
      .eq('id', uid)
      .maybeSingle();

    setProfile((profileData as ProfileRow) ?? null);

    const { data: sessionData } = await supabase
      .from('chat_sessions')
      .select('id, status, started_at, final_severity, final_action, chat_messages(content, role, created_at)')
      .eq('user_id', uid)
      .order('started_at', { ascending: false })
      .limit(3);

    const list = (sessionData ?? []) as ChatSessionRow[];
    setSessions(list);
    const active = list.find((s) => s.status === 'active') ?? null;
    setActiveRemote(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = profile?.display_name?.trim() || 'there';
  const lastSession = sessions[0];
  const lastSeverity = lastSession?.final_severity ?? null;
  const lastTime = lastSession?.started_at;

  const showBellDot = localActive || !!activeRemote;

  const activeCardSession = activeRemote;
  const activePreview = firstUserPreview(activeCardSession?.chat_messages ?? undefined);
  const tip = useMemo(() => tipForToday(), []);

  const metrics = useMemo(
    () => [
      {
        key: 'blood',
        icon: <Droplets size={20} color={colors.emergency} />,
        label: 'Blood Type',
        value: profile?.blood_type?.trim() || null,
        sub: profile?.blood_type ? 'On record' : undefined,
        empty: 'Not set',
      },
      {
        key: 'meds',
        icon: <Pill size={20} color={colors.mild} />,
        label: 'Medications',
        value:
          profile?.current_medications && profile.current_medications.length > 0
            ? `${profile.current_medications.length} active`
            : null,
        sub: undefined,
        empty: 'None',
      },
      {
        key: 'allergy',
        icon: <AlertTriangle size={20} color={colors.urgent} />,
        label: 'Allergies',
        value:
          profile?.allergies && profile.allergies.length > 0
            ? `${profile.allergies.length} recorded`
            : null,
        sub: undefined,
        empty: 'None',
      },
      {
        key: 'emergency',
        icon: <Stethoscope size={20} color={colors.info} />,
        label: 'Emergency',
        value: profile?.emergency_contact_name?.trim() || null,
        sub: profile?.emergency_contact_phone || undefined,
        empty: 'Not set',
        danger: true,
      },
    ],
    [profile],
  );

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <Skeleton width="88%" height={28} radius={8} />
        <View style={styles.skeletonGap} />
        <Skeleton width="100%" height={120} radius={16} />
        <View style={styles.skeletonGap} />
        <Skeleton width="100%" height={80} radius={12} />
        <View style={styles.skeletonGap} />
        <Skeleton width="100%" height={72} radius={12} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroRow1}>
            <View style={styles.heroTitles}>
              <Text style={styles.heroGreet}>Good {greetingWord()},</Text>
              <Text style={styles.heroName}>{displayName}</Text>
            </View>
            <View style={styles.bellWrap}>
              <Bell size={24} color={colors.surface} strokeWidth={2} />
              {showBellDot ? <View style={styles.bellDot} /> : null}
            </View>
          </View>

          <View style={styles.healthCard}>
            <View style={styles.healthLeft}>
              <Text style={styles.healthLabel}>Health Status</Text>
              <SeverityBadge severity={lastSeverity} />
              <Text style={styles.healthTime}>{lastTime ? formatRelative(lastTime) : '—'}</Text>
              <Text style={styles.healthSub}>
                {lastTime ? 'Last consultation' : 'No consultations synced yet'}
              </Text>
            </View>
            <PulseOrb active={!!activeRemote || localActive} />
          </View>
        </View>

        <View style={styles.quickCard}>
          <View style={styles.quickRow}>
            <QuickAction
              emoji="💬"
              title="New Chat"
              sub="Dr Lucas"
              iconColor={colors.accent}
              onPress={() => router.push('/(drawer)/')}
            />
            <QuickAction
              emoji="💊"
              title="Pharmacy"
              sub="Stock search"
              iconColor={colors.mild}
              onPress={() => router.push({ pathname: '/services', params: { action: 'pharmacy' } })}
            />
            <QuickAction
              emoji="🏥"
              title="Find Care"
              sub="Hospitals"
              iconColor={colors.info}
              onPress={() => router.push({ pathname: '/services', params: { action: 'hospital' } })}
            />
          </View>
        </View>

        {activeCardSession ? (
          <Pressable style={styles.activeCard} onPress={() => router.push('/(drawer)/')}>
            <View style={styles.activeIconCircle}>
              <MessageCircle size={22} color={colors.info} strokeWidth={2} />
            </View>
            <View style={styles.activeCenter}>
              <Text style={styles.activeTitle}>Active consultation</Text>
              <Text style={styles.activePreview} numberOfLines={1}>
                {activePreview || 'Tap to continue'}
              </Text>
              <Text style={styles.activeTime}>{formatRelative(activeCardSession.started_at)}</Text>
            </View>
            <Text style={styles.activeResume}>Resume →</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Health Overview</Text>
            <Pressable onPress={() => router.push('/settings')}>
              <Text style={styles.sectionLink}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.metricGrid}>
            {metrics.map((m) => (
              <Pressable key={m.key} style={styles.metricCard} onPress={() => router.push('/settings')}>
                {m.icon}
                <Text style={styles.metricLabel}>{m.label}</Text>
                <Text
                  style={[styles.metricValue, !m.value && m.danger && styles.metricValueDanger]}
                  numberOfLines={1}
                >
                  {m.value ?? m.empty}
                </Text>
                {m.sub ? (
                  <Text style={styles.metricSub} numberOfLines={1}>
                    {m.sub}
                  </Text>
                ) : (
                  <Text style={styles.metricSub}> </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Recent consultations</Text>
            <Pressable onPress={() => router.push('/history')}>
              <Text style={styles.sectionLink}>See all →</Text>
            </Pressable>
          </View>
          {sessions.length === 0 ? (
            <View style={styles.emptySessions}>
              <Text style={styles.emptyIcon}>☰</Text>
              <Text style={styles.emptyTitle}>No consultations yet</Text>
              <Text style={styles.emptySub}>Start a conversation with Dr Lucas</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/(drawer)/')}>
                <Text style={styles.emptyBtnText}>Talk to Dr Lucas</Text>
              </Pressable>
            </View>
          ) : (
            sessions.map((s) => (
              <SessionRow key={s.id} session={s} onPress={() => router.push('/history')} />
            ))
          )}
        </View>

        <View style={styles.tipSection}>
          <Text style={styles.sectionTitle}>Daily health tip</Text>
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tipCard}
          >
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipBody}>{tip.body}</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'urgent' | 'mild' | null }) {
  if (!severity) {
    return (
      <View style={[styles.sevPill, styles.sevNone]}>
        <Text style={styles.sevTextMuted}>No recent sessions</Text>
      </View>
    );
  }
  const map = {
    critical: { bg: colors.emergency, t: 'Critical' },
    urgent: { bg: colors.urgent, t: 'Urgent' },
    mild: { bg: colors.accent, t: 'Mild' },
  }[severity];
  return (
    <View style={[styles.sevPill, { backgroundColor: map.bg }]}>
      <Text style={styles.sevTextOn}>{map.t}</Text>
    </View>
  );
}

function QuickAction({
  emoji,
  title,
  sub,
  iconColor: _iconColor,
  onPress,
}: {
  emoji: string;
  title: string;
  sub: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickCell} onPress={onPress}>
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </Pressable>
  );
}

function SessionRow({ session, onPress }: { session: ChatSessionRow; onPress: () => void }) {
  const preview =
    firstUserPreview(session.chat_messages ?? undefined) || actionTitle(session.final_action);
  const sev = session.final_severity;
  const circleBg =
    sev === 'critical'
      ? colors.emergencyLight
      : sev === 'urgent'
        ? colors.urgentLight
        : colors.mildLight;
  const emoji =
    session.final_action === 'pharmacy'
      ? '💊'
      : session.final_action === 'first_aid'
        ? '🩹'
        : sev === 'critical'
          ? '🚨'
          : sev === 'urgent'
            ? '⚠️'
            : '✓';

  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      <View style={[styles.sessionCircle, { backgroundColor: circleBg }]}>
        <Text>{emoji}</Text>
      </View>
      <View style={styles.sessionCenter}>
        <Text style={styles.sessionPreview} numberOfLines={1}>
          {preview}
        </Text>
        <Text style={styles.sessionSub}>{actionTitle(session.final_action)}</Text>
        <Text style={styles.sessionTime}>{formatRelative(session.started_at)}</Text>
      </View>
      <View style={styles.sessionRight}>
        <View style={[styles.miniBadge, sev === 'critical' && { backgroundColor: colors.emergency }]}>
          <Text style={styles.miniBadgeText}>{sev ?? '—'}</Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  skeletonGap: { height: spacing.md },
  scroll: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: spacing.lg,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitles: { flex: 1 },
  heroGreet: { fontSize: 13, color: colors.textTertiary },
  heroName: { fontSize: 24, fontWeight: '700', color: colors.surface, marginTop: 4 },
  bellWrap: { position: 'relative', padding: spacing.sm },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  healthCard: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  healthLeft: { flex: 1, paddingRight: 12 },
  healthLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  healthTime: { fontSize: 12, color: colors.textTertiary, marginTop: 8 },
  healthSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  healthOrbWrap: { width: 64, height: 64 },
  healthOrbGrad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sevPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  sevNone: { backgroundColor: 'rgba(255,255,255,0.12)' },
  sevTextMuted: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' },
  sevTextOn: { fontSize: 12, color: colors.surface, fontWeight: '700' },
  quickCard: {
    marginTop: -20,
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickCell: { flex: 1, alignItems: 'center', gap: 4 },
  quickEmoji: { fontSize: 22 },
  quickTitle: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  quickSub: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: colors.infoLight,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.info,
    gap: 12,
  },
  activeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCenter: { flex: 1 },
  activeTitle: { fontSize: 14, fontWeight: '700', color: colors.info },
  activePreview: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  activeTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  activeResume: { fontSize: 13, fontWeight: '700', color: colors.accent },
  sectionBlock: { marginTop: 20, paddingHorizontal: 16 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { ...typography.h3, fontSize: 17 },
  sectionLink: { fontSize: 13, fontWeight: '600', color: colors.accent },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: { fontSize: 20, fontWeight: '700', color: colors.primary },
  metricValueDanger: { fontSize: 15, color: colors.emergency },
  metricSub: { fontSize: 11, color: colors.textTertiary },
  emptySessions: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  emptyIcon: { fontSize: 32, color: colors.textTertiary, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptySub: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  emptyBtnText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 15 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sessionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionCenter: { flex: 1 },
  sessionPreview: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sessionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  sessionTime: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  sessionRight: { alignItems: 'flex-end', gap: 4 },
  miniBadge: {
    backgroundColor: colors.mild,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  miniBadgeText: { fontSize: 10, fontWeight: '700', color: colors.surface, textTransform: 'capitalize' },
  tipSection: { marginTop: 20, marginHorizontal: 16, marginBottom: spacing.lg },
  tipCard: { borderRadius: 16, padding: 20, marginTop: 12 },
  tipIcon: { fontSize: 28, marginBottom: 8 },
  tipTitle: { fontSize: 16, fontWeight: '700', color: colors.surface, marginBottom: 8 },
  tipBody: { fontSize: 14, color: colors.surface, opacity: 0.95, lineHeight: 20 },
});
