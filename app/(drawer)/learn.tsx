import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, Lock, Play } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { LearnDailyQuizModal } from '../../src/components/LearnDailyQuizModal';
import {
  DAILY_CHALLENGE_IDS,
  getLesson,
  LEARNING_TRACKS,
  lessonsById,
  totalLessonCount,
  type LearningTrack,
} from '../../src/data/learnCurriculum';
import { colors, radius, spacing, typography } from '../../src/theme';

const COMPLETE_PREFIX = 'lesson_complete_';

type LessonStatus = 'locked' | 'available' | 'done';

function lessonStatus(
  lessonId: string,
  track: LearningTrack,
  orderIndex: number,
  completedIds: Set<string>,
): LessonStatus {
  if (completedIds.has(lessonId)) return 'done';
  for (let j = 0; j < orderIndex; j++) {
    if (!completedIds.has(track.lessonIds[j])) return 'locked';
  }
  return 'available';
}

export default function LearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedTrack, setSelectedTrack] = useState<LearningTrack>(LEARNING_TRACKS[0]);
  const [completedCount, setCompletedCount] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [quizOpen, setQuizOpen] = useState(false);

  const total = totalLessonCount();

  const refresh = useCallback(async () => {
    const keys = await AsyncStorage.getAllKeys();
    const relevant = keys.filter((k) => k.startsWith(COMPLETE_PREFIX));
    const pairs = await AsyncStorage.multiGet(relevant);
    const set = new Set<string>();
    let c = 0;
    for (const [k, v] of pairs) {
      if (v === '1') {
        c += 1;
        set.add(k.replace(COMPLETE_PREFIX, ''));
      }
    }
    setCompletedSet(set);
    setCompletedCount(c);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const progressPct = total > 0 ? completedCount / total : 0;

  const featured = useMemo(() => {
    for (const t of LEARNING_TRACKS) {
      for (let i = 0; i < t.lessonIds.length; i++) {
        const id = t.lessonIds[i];
        if (!completedSet.has(id)) {
          const L = getLesson(id);
          if (L) return { lesson: L, track: t, index: i };
        }
      }
    }
    const t = LEARNING_TRACKS[0];
    const id = t.lessonIds[0];
    return { lesson: getLesson(id)!, track: t, index: 0 };
  }, [completedSet]);

  const trackLessons = selectedTrack.lessonIds.map((id, orderIndex) => ({
    lesson: lessonsById[id],
    orderIndex,
    status: lessonsById[id] ? lessonStatus(id, selectedTrack, orderIndex, completedSet) : 'locked',
  }));

  const dotsFilled = Math.min(
    3,
    Math.max(1, Math.ceil(((featured.index + 1) / featured.track.lessonIds.length) * 3)),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Health Academy</Text>
          <Text style={styles.heroSub}>Learn to protect yourself and others</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Your progress</Text>
            <Text style={styles.progressCount}>
              {completedCount} of {total} lessons
            </Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${progressPct * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tracksScroll}
          style={styles.tracksWrap}
        >
          {LEARNING_TRACKS.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setSelectedTrack(t)}
              style={[
                styles.trackCard,
                selectedTrack.id === t.id && { borderColor: t.color, borderWidth: 2 },
              ]}
            >
              <View style={[styles.trackCorner, { backgroundColor: `${t.color}26` }]}>
                <Text style={[styles.trackEmoji, { color: t.color }]}>{t.emoji}</Text>
              </View>
              <Text style={styles.trackEmojiLarge}>{t.emoji}</Text>
              <Text style={styles.trackName} numberOfLines={2}>
                {t.name}
              </Text>
              <Text style={styles.trackLessons}>{t.lessonIds.length} lessons</Text>
              <View style={styles.trackBarBg}>
                <View
                  style={[
                    styles.trackBarFill,
                    {
                      width: `${(t.lessonIds.filter((id) => completedSet.has(id)).length / t.lessonIds.length) * 100}%`,
                      backgroundColor: t.color,
                    },
                  ]}
                />
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <LinearGradient
          colors={[colors.primary, colors.primaryMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.featured}
        >
          <View style={styles.decor} />
          <Text style={styles.featureLabel}>Continue learning</Text>
          <Text style={styles.featureTitle}>{featured.lesson.title}</Text>
          <Text style={[styles.featureTrack, { color: colors.accentTeal }]}>{featured.track.name}</Text>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < dotsFilled ? { backgroundColor: colors.accent } : { backgroundColor: 'rgba(255,255,255,0.25)' },
                ]}
              />
            ))}
          </View>
          <Pressable
            style={styles.cta}
            onPress={() => router.push({ pathname: '/lesson', params: { lessonId: featured.lesson.id } })}
          >
            <Text style={styles.ctaText}>
              {completedSet.has(featured.lesson.id) ? 'Review lesson →' : 'Start lesson →'}
            </Text>
          </Pressable>
        </LinearGradient>

        <View style={styles.challenge}>
          <View style={styles.challengeLeft}>
            <View style={styles.trophyCircle}>
              <Text style={styles.trophy}>🎯</Text>
            </View>
            <View style={styles.challengeMid}>
              <Text style={styles.challengeTitle}>Daily challenge</Text>
              <Text style={styles.challengeSub}>Test your knowledge in 2 minutes</Text>
            </View>
          </View>
          <Pressable style={styles.startSmall} onPress={() => setQuizOpen(true)}>
            <Text style={styles.startSmallText}>Start</Text>
          </Pressable>
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHead}>
            <Text style={styles.listTitle}>{selectedTrack.name}</Text>
            <Pressable onPress={() => undefined}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {trackLessons.map(({ lesson, status }) =>
            lesson ? (
              <Pressable
                key={lesson.id}
                style={styles.lessonCard}
                onPress={() => {
                  if (status === 'locked') return;
                  router.push({ pathname: '/lesson', params: { lessonId: lesson.id } });
                }}
              >
                <View style={styles.lessonLeft}>
                  {status === 'done' ? (
                    <View style={[styles.lCircle, { backgroundColor: colors.mildLight }]}>
                      <Check size={18} color={colors.mild} strokeWidth={3} />
                    </View>
                  ) : status === 'locked' ? (
                    <View style={[styles.lCircle, { backgroundColor: colors.surfaceSoft }]}>
                      <Lock size={16} color={colors.textTertiary} />
                    </View>
                  ) : (
                    <View style={[styles.lCircle, { backgroundColor: `${selectedTrack.color}22` }]}>
                      <Play size={16} color={selectedTrack.color} fill={selectedTrack.color} />
                    </View>
                  )}
                </View>
                <View style={styles.lessonMid}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  <Text style={styles.lessonMeta}>
                    {lesson.minutes} min · {lesson.difficulty}
                  </Text>
                  <View style={[styles.miniDiff, lesson.difficulty === 'Intermediate' && styles.miniDiffMid]}>
                    <Text style={styles.miniDiffText}>{lesson.difficulty}</Text>
                  </View>
                </View>
              </Pressable>
            ) : null,
          )}
        </View>
      </ScrollView>

      <LearnDailyQuizModal visible={quizOpen} questionIds={DAILY_CHALLENGE_IDS} onClose={() => setQuizOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  heroTitle: { fontSize: 24, fontWeight: '600', color: colors.onDark },
  heroSub: { fontSize: 13, color: colors.onDarkSoft, marginTop: 6 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    alignItems: 'center',
  },
  progressLabel: { fontSize: 11, color: colors.onDarkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
  progressCount: { fontSize: 11, color: colors.onDark, fontWeight: '600' },
  barBg: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  tracksWrap: { marginTop: -16, maxHeight: 200 },
  tracksScroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 0 },
  trackCard: {
    width: 140,
    height: 160,
    marginRight: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackCorner: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackEmoji: { fontSize: 22 },
  trackEmojiLarge: { fontSize: 32, textAlign: 'center', marginTop: 12 },
  trackName: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 8 },
  trackLessons: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  trackBarBg: {
    marginTop: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackBarFill: { height: 4, borderRadius: 2 },
  featured: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  decor: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.07,
    backgroundColor: colors.surface,
    transform: [{ rotate: '12deg' }, { scale: 1.5 }],
  },
  featureLabel: {
    fontSize: 11,
    color: colors.onDarkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  featureTitle: { fontSize: 20, fontWeight: '600', color: colors.onDark, marginTop: 8 },
  featureTrack: { fontSize: 13, marginTop: 6, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cta: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
  },
  ctaText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  challenge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  trophyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophy: { fontSize: 22 },
  challengeMid: { flex: 1 },
  challengeTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  challengeSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  startSmall: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  startSmallText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 13 },
  listSection: { marginTop: 24, paddingHorizontal: 16 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  listTitle: { ...typography.h3, fontSize: 17 },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.accent },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  lessonLeft: {},
  lCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonMid: { flex: 1 },
  lessonTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  lessonMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  miniDiff: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.mildLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  miniDiffMid: { backgroundColor: colors.urgentLight },
  miniDiffText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
});
