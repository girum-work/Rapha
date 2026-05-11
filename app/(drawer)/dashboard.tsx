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
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../../src/components/Skeleton';
import { formatRelative } from '../../src/lib/dateUtils';
import { getOrCreateSession } from '../../src/lib/sessionStore';
import { hasSupabaseConfig, supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme';

type ProfileRow = {
  display_name: string | null; blood_type: string | null; allergies: string[] | null;
  current_medications: string[] | null; chronic_conditions: string[] | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
};
type ChatMsg = { content: string; role: string; created_at: string };
type ChatSessionRow = {
  id: string; status: string; started_at: string;
  final_severity: 'critical' | 'urgent' | 'mild' | null; final_action: string | null;
  chat_messages?: ChatMsg[] | null;
};

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'morning'; if (h < 17) return 'afternoon'; return 'evening';
}
function firstUserPreview(messages: ChatMsg[] | null | undefined): string {
  if (!messages?.length) return '';
  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return sorted.find((m) => m.role === 'user')?.content ?? '';
}
function actionTitle(action: string | null): string {
  const map: Record<string, string> = {
    emergency: 'Emergency care recommended', hospital: 'Hospital visit recommended',
    clinic: 'Clinic visit recommended', pharmacy: 'Pharmacy referral',
    first_aid: 'First aid guidance', self_care: 'Home monitoring advised', ask_more: 'More information needed',
  };
  return map[action ?? ''] ?? 'Consultation';
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
  const d = new Date().getDay(); const mondayIdx = d === 0 ? 6 : d - 1;
  const body = WEEK_TIPS[mondayIdx] ?? WEEK_TIPS[0];
  const emojiEnd = body.indexOf(' ');
  const icon = emojiEnd > 0 ? body.slice(0, emojiEnd) : '💡';
  const rest = emojiEnd > 0 ? body.slice(emojiEnd + 1).trim() : body;
  return { title: `${icon} Daily tip`, body: rest };
}

function PulseOrb({ active }: { active: boolean }) {
  return (
    <MotiView
      style={{ width: 64, height: 64 }}
      from={{ scale: 1 }}
      animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={active ? { type: 'timing', duration: 1800, loop: true } : { type: 'timing', duration: 150 }}
    >
      <LinearGradient
        colors={[colors.accent, colors.primary]}
        style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Heart size={28} color={colors.textOnAccent} fill="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      </LinearGradient>
    </MotiView>
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
    if (!hasSupabaseConfig || !supabase) { setProfile(null); setSessions([]); setActiveRemote(null); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setProfile(null); setSessions([]); setActiveRemote(null); setLoading(false); return; }
    const { data: profileData } = await supabase.from('profiles')
      .select('display_name, blood_type, allergies, current_medications, chronic_conditions, emergency_contact_name, emergency_contact_phone')
      .eq('id', uid).maybeSingle();
    setProfile((profileData as ProfileRow) ?? null);
    const { data: sessionData } = await supabase.from('chat_sessions')
      .select('id, status, started_at, final_severity, final_action, chat_messages(content, role, created_at)')
      .eq('user_id', uid).order('started_at', { ascending: false }).limit(3);
    const list = (sessionData ?? []) as ChatSessionRow[];
    setSessions(list);
    setActiveRemote(list.find((s) => s.status === 'active') ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const displayName = profile?.display_name?.trim() || 'there';
  const lastSession = sessions[0];
  const lastSeverity = lastSession?.final_severity ?? null;
  const lastTime = lastSession?.started_at;
  const showBellDot = localActive || !!activeRemote;
  const activePreview = firstUserPreview(activeRemote?.chat_messages ?? undefined);
  const tip = useMemo(() => tipForToday(), []);

  const metrics = useMemo(() => [
    { key: 'blood', icon: <Droplets size={20} color={colors.emergency} />, label: 'Blood Type', value: profile?.blood_type?.trim() || null, sub: profile?.blood_type ? 'On record' : undefined, empty: 'Not set' },
    { key: 'meds', icon: <Pill size={20} color={colors.mild} />, label: 'Medications', value: profile?.current_medications && profile.current_medications.length > 0 ? `${profile.current_medications.length} active` : null, sub: undefined, empty: 'None' },
    { key: 'allergy', icon: <AlertTriangle size={20} color={colors.urgent} />, label: 'Allergies', value: profile?.allergies && profile.allergies.length > 0 ? `${profile.allergies.length} recorded` : null, sub: undefined, empty: 'None' },
    { key: 'emergency', icon: <Stethoscope size={20} color={colors.info} />, label: 'Emergency', value: profile?.emergency_contact_name?.trim() || null, sub: profile?.emergency_contact_phone || undefined, empty: 'Not set', danger: true },
  ], [profile]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6 gap-4">
        <Skeleton width="88%" height={28} radius={8} />
        <Skeleton width="100%" height={120} radius={16} />
        <Skeleton width="100%" height={80} radius={12} />
        <Skeleton width="100%" height={72} radius={12} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="px-5 pt-6 pb-7" style={{ backgroundColor: colors.primary, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-[13px]" style={{ color: colors.onDarkSoft }}>Good {greetingWord()},</Text>
              <Text className="text-[24px] font-semibold mt-1" style={{ color: colors.onDark }}>{displayName}</Text>
            </View>
            <View className="relative p-2">
              <Bell size={24} color={colors.surface} strokeWidth={2} />
              {showBellDot ? <View className="absolute top-[10px] right-[10px] w-2 h-2 rounded-full bg-primary" /> : null}
            </View>
          </View>

          <View className="mt-5 flex-row justify-between items-center rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <View className="flex-1 pr-3">
              <Text className="text-[11px] uppercase tracking-[0.6px] mb-2" style={{ color: colors.onDarkSoft }}>Health Status</Text>
              <SeverityBadge severity={lastSeverity} />
              <Text className="text-[12px] mt-2" style={{ color: colors.onDarkSoft }}>{lastTime ? formatRelative(lastTime) : '—'}</Text>
              <Text className="text-[11px] mt-0.5" style={{ color: colors.onDarkSoft }}>{lastTime ? 'Last consultation' : 'No consultations synced yet'}</Text>
            </View>
            <PulseOrb active={!!activeRemote || localActive} />
          </View>
        </View>

        {/* Quick actions */}
        <View className="mx-4 -mt-5 bg-card rounded-2xl p-4 border border-border" style={{ elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
          <View className="flex-row justify-between">
            <QuickAction emoji="💬" title="New Chat" sub="Dr Lucas" onPress={() => router.push('/(drawer)/')} />
            <QuickAction emoji="💊" title="Pharmacy" sub="Stock search" onPress={() => router.push({ pathname: '/services', params: { action: 'pharmacy' } })} />
            <QuickAction emoji="🏥" title="Find Care" sub="Hospitals" onPress={() => router.push({ pathname: '/services', params: { action: 'hospital' } })} />
          </View>
        </View>

        {/* Active session */}
        {activeRemote ? (
          <Pressable
            className="flex-row items-center mx-4 mt-5 p-4 rounded-2xl gap-3 border-[1.5px]"
            style={{ backgroundColor: colors.infoLight, borderColor: colors.info }}
            onPress={() => router.push('/(drawer)/')}
          >
            <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <MessageCircle size={22} color={colors.info} strokeWidth={2} />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold" style={{ color: colors.info }}>Active consultation</Text>
              <Text className="text-[13px] mt-1" style={{ color: colors.textSecondary }} numberOfLines={1}>{activePreview || 'Tap to continue'}</Text>
              <Text className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>{formatRelative(activeRemote.started_at)}</Text>
            </View>
            <Text className="text-[13px] font-bold" style={{ color: colors.accent }}>Resume →</Text>
          </Pressable>
        ) : null}

        {/* Health overview */}
        <View className="mt-5 px-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[17px] font-bold text-foreground">Health Overview</Text>
            <Pressable onPress={() => router.push('/settings')}><Text className="text-[13px] font-semibold text-primary">Edit</Text></Pressable>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {metrics.map((m) => (
              <Pressable key={m.key} className="bg-card rounded-xl p-[14px] gap-1.5 border border-border" style={{ width: '47%' }} onPress={() => router.push('/settings')}>
                {m.icon}
                <Text className="text-[11px] text-muted-foreground uppercase tracking-[0.4px]">{m.label}</Text>
                <Text className="text-[20px] font-bold" style={{ color: (!m.value && m.danger) ? colors.emergency : colors.ink }} numberOfLines={1}>{m.value ?? m.empty}</Text>
                {m.sub ? <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>{m.sub}</Text> : <Text className="text-[11px] text-muted-foreground"> </Text>}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Recent sessions */}
        <View className="mt-5 px-4">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[17px] font-bold text-foreground">Recent consultations</Text>
            <Pressable onPress={() => router.push('/history')}><Text className="text-[13px] font-semibold text-primary">See all →</Text></Pressable>
          </View>
          {sessions.length === 0 ? (
            <View className="items-center py-8 bg-card rounded-xl px-4 border border-border">
              <Text className="text-[32px] text-muted-foreground mb-2">☰</Text>
              <Text className="text-[16px] font-semibold text-muted-foreground">No consultations yet</Text>
              <Text className="text-[14px] text-muted-foreground/70 text-center mt-1">Start a conversation with Dr Lucas</Text>
              <Pressable className="mt-4 bg-primary px-6 py-3 rounded-2xl" onPress={() => router.push('/(drawer)/')}>
                <Text className="text-primary-foreground font-bold text-[15px]">Talk to Dr Lucas</Text>
              </Pressable>
            </View>
          ) : (
            sessions.map((s) => <SessionRow key={s.id} session={s} onPress={() => router.push('/history')} />)
          )}
        </View>

        {/* Daily tip */}
        <View className="mt-5 mx-4 mb-6">
          <Text className="text-[17px] font-bold text-foreground mb-3">Daily health tip</Text>
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 16, padding: 20, marginTop: 0 }}
          >
            <Text style={{ fontSize: 28, marginBottom: 8 }}>{tip.title.split(' ')[0]}</Text>
            <Text className="text-[16px] font-bold mb-2" style={{ color: colors.surface }}>{tip.title}</Text>
            <Text className="text-[14px] leading-5" style={{ color: colors.surface, opacity: 0.95 }}>{tip.body}</Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'urgent' | 'mild' | null }) {
  if (!severity) return (
    <View className="self-start px-[10px] py-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
      <Text className="text-[12px] font-semibold" style={{ color: colors.onDarkSoft }}>No recent sessions</Text>
    </View>
  );
  const map = { critical: { bg: colors.emergency, t: 'Critical' }, urgent: { bg: colors.urgent, t: 'Urgent' }, mild: { bg: colors.accent, t: 'Mild' } }[severity];
  return (
    <View className="self-start px-[10px] py-1.5 rounded-full" style={{ backgroundColor: map.bg }}>
      <Text className="text-[12px] font-bold" style={{ color: colors.surface }}>{map.t}</Text>
    </View>
  );
}

function QuickAction({ emoji, title, sub, onPress }: { emoji: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable className="flex-1 items-center gap-1" onPress={onPress}>
      <Text className="text-[22px]">{emoji}</Text>
      <Text className="text-[11px] font-semibold text-foreground">{title}</Text>
      <Text className="text-[11px] text-muted-foreground text-center">{sub}</Text>
    </Pressable>
  );
}

function SessionRow({ session, onPress }: { session: ChatSessionRow; onPress: () => void }) {
  const preview = firstUserPreview(session.chat_messages ?? undefined) || actionTitle(session.final_action);
  const sev = session.final_severity;
  const badgeBg = sev === 'critical' ? colors.emergency : sev === 'urgent' ? colors.urgent : sev === 'mild' ? colors.accent : colors.borderStrong;
  const circleBg = sev === 'critical' ? colors.emergencyLight : sev === 'urgent' ? colors.urgentLight : colors.mildLight;
  const emoji = session.final_action === 'pharmacy' ? '💊' : session.final_action === 'first_aid' ? '🩹' : sev === 'critical' ? '🚨' : sev === 'urgent' ? '⚠️' : '✓';
  return (
    <Pressable className="flex-row items-center bg-card rounded-xl p-[14px] mb-2 gap-3 border border-border" onPress={onPress}>
      <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: circleBg }}>
        <Text>{emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-bold text-foreground" numberOfLines={1}>{preview}</Text>
        <Text className="text-[12px] text-muted-foreground mt-0.5">{actionTitle(session.final_action)}</Text>
        <Text className="text-[12px] text-muted-foreground/60 mt-1">{formatRelative(session.started_at)}</Text>
      </View>
      <View className="items-end gap-1">
        <View className="px-2 py-1 rounded-full" style={{ backgroundColor: badgeBg }}>
          <Text className="text-[10px] font-bold capitalize" style={{ color: colors.surface }}>{sev ?? '—'}</Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </View>
    </Pressable>
  );
}
