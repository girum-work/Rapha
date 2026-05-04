import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  accessoryById,
  CURRICULUM_QUIZZES,
  getLesson,
  LEARNING_TRACKS,
  type CurriculumLesson,
} from '../../src/data/learnCurriculum';
import { colors, radius, spacing, typography } from '../../src/theme';

const COMPLETE_PREFIX = 'lesson_complete_';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LessonDetailScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  const track = lesson ? LEARNING_TRACKS.find((t) => t.id === lesson.trackId) : undefined;

  const [scrollProgress, setScrollProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [showQuizResult, setShowQuizResult] = useState(false);

  const quiz = useMemo(() => {
    if (!lesson?.quizQuestionIds[0]) return undefined;
    return CURRICULUM_QUIZZES.find((q) => q.id === lesson.quizQuestionIds[0]);
  }, [lesson]);

  const loadComplete = useCallback(async () => {
    if (!lessonId) return;
    const v = await AsyncStorage.getItem(COMPLETE_PREFIX + lessonId);
    setCompleted(v === '1');
  }, [lessonId]);

  useEffect(() => {
    void loadComplete();
  }, [loadComplete]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    const p = max > 0 ? contentOffset.y / max : 1;
    setScrollProgress(Math.min(1, Math.max(0, p)));
  }, []);

  async function markComplete() {
    if (!lessonId) return;
    await AsyncStorage.setItem(COMPLETE_PREFIX + lessonId, '1');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCompleted(true);
  }

  if (!lesson || !track) {
    return (
      <SafeAreaView style={styles.miss}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <ArrowLeft size={22} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.missText}>Lesson not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.trackTag, { color: track.color }]}>{track.name}</Text>
      </View>
      <View style={styles.readProgressOuter}>
        <View style={[styles.readProgressFill, { width: `${scrollProgress * 100}%`, backgroundColor: track.color }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <LessonBody lesson={lesson} track={track} />

        {quiz ? (
          <View style={styles.quizBox}>
            <Text style={styles.quizHead}>Test your knowledge</Text>
            <Text style={styles.quizQ}>{quiz.question}</Text>
            {quiz.options.map((opt, i) => {
              const chosen = quizChoice === i;
              const correct = i === quiz.answerIndex;
              let bg = colors.surfaceSoft;
              let border = colors.border;
              if (quizChoice !== null) {
                if (correct) {
                  bg = colors.mildLight;
                  border = colors.mild;
                } else if (chosen && !correct) {
                  bg = colors.emergencyLight;
                  border = colors.emergency;
                }
              }
              return (
                <Pressable
                  key={opt}
                  style={[styles.quizOpt, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setQuizChoice(i);
                    setShowQuizResult(true);
                  }}
                >
                  <Text style={styles.quizOptText}>{opt}</Text>
                </Pressable>
              );
            })}
            {showQuizResult && quizChoice !== null ? (
              <View style={styles.explain}>
                <Text style={styles.explainText}>💡 {quiz.explanation}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.sticky}>
        <Pressable
          disabled={completed}
          onPress={markComplete}
          style={[styles.completeBtn, { backgroundColor: completed ? colors.textTertiary : track.color }]}
        >
          <Text style={styles.completeBtnText}>{completed ? 'Completed ✓' : 'Mark as complete ✓'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LessonBody({
  lesson,
  track,
}: {
  lesson: CurriculumLesson;
  track: { color: string; tint: string; name: string };
}) {
  const router = useRouter();
  const paragraphs = lesson.body.split(/\n\n+/).filter(Boolean);
  return (
    <>
      <View style={[styles.hero, { backgroundColor: track.tint }]}>
        <Text style={styles.heroIcon}>📘</Text>
        <Text style={styles.heroTitle}>{lesson.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{lesson.minutes} min read</Text>
          <View style={[styles.diffPill, lesson.difficulty === 'Intermediate' && styles.diffMid]}>
            <Text style={styles.diffText}>{lesson.difficulty}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHead}>Key facts</Text>
        {lesson.keyFacts.map((fact) => (
          <View key={fact} style={[styles.factCard, { borderLeftColor: track.color }]}>
            <Text style={styles.factText}>{fact}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        {paragraphs.map((p) => (
          <Text key={p.slice(0, 40)} style={styles.bodyText}>
            {p}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHead}>Steps</Text>
        {lesson.steps.map((step, idx) => (
          <View key={step} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: colors.accent }]}>
              <Text style={styles.stepNumText}>{idx + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.warnHead}>⚠️ Seek medical help if:</Text>
        {lesson.warningSigns.map((w) => (
          <View key={w} style={styles.warnRow}>
            <Text style={styles.warnDot}>●</Text>
            <Text style={styles.warnText}>{w}</Text>
          </View>
        ))}
      </View>

      {lesson.relatedAccessoryIds.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionHead}>What you&apos;ll need</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {lesson.relatedAccessoryIds.map((id) => {
              const a = accessoryById(id);
              if (!a) return null;
              return (
                <Pressable key={id} onPress={() => router.push('/accessories')} style={styles.chip}>
                  <Text style={styles.chipText}>🩹 {a.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.chipHint}>Tap items in the full Accessories flow (linked from Learn home).</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  miss: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  missText: { ...typography.body, marginTop: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 16, color: colors.textPrimary },
  trackTag: { fontSize: 12, fontWeight: '600' },
  readProgressOuter: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
    borderRadius: 2,
    overflow: 'hidden',
  },
  readProgressFill: { height: 4, borderRadius: 2 },
  scroll: { paddingBottom: spacing.md },
  hero: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  heroIcon: { fontSize: 48, marginBottom: spacing.sm },
  heroTitle: { ...typography.h2, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  meta: { fontSize: 13, color: colors.textSecondary },
  diffPill: {
    backgroundColor: colors.mildLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  diffMid: { backgroundColor: colors.urgentLight },
  diffText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionHead: { ...typography.label, marginBottom: spacing.sm },
  factCard: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
  },
  factText: { fontSize: 14, color: colors.textPrimary, lineHeight: 22 },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  warnHead: { fontSize: 14, fontWeight: '700', color: colors.urgent, marginBottom: spacing.sm },
  warnRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  warnDot: { color: colors.urgent, fontSize: 12, marginTop: 2 },
  warnText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.accentDark },
  chipHint: { fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs },
  quizBox: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizHead: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  quizQ: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  quizOpt: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  quizOptText: { fontSize: 15, color: colors.textPrimary },
  explain: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    padding: 14,
    marginTop: spacing.sm,
  },
  explainText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  sticky: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completeBtn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeBtnText: { color: colors.textOnAccent, fontWeight: '700', fontSize: 16 },
});
