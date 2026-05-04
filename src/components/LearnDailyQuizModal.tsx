import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CURRICULUM_QUIZZES } from '../data/learnCurriculum';
import { colors, radius, spacing, typography } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');

type Props = {
  visible: boolean;
  questionIds: string[];
  onClose: () => void;
};

export function LearnDailyQuizModal({ visible, questionIds, onClose }: Props) {
  const slide = useRef(new Animated.Value(SCREEN_H)).current;
  const questions = questionIds
    .map((id) => CURRICULUM_QUIZZES.find((q) => q.id === id))
    .filter(Boolean) as typeof CURRICULUM_QUIZZES;

  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
      setIdx(0);
      setChoice(null);
      setAnswered(false);
      setScore(0);
      setDone(false);
    } else {
      slide.setValue(SCREEN_H);
    }
  }, [visible, slide]);

  const q = questions[idx];

  const pick = useCallback(
    (i: number) => {
      if (answered || !q) return;
      setChoice(i);
      setAnswered(true);
      if (i === q.answerIndex) setScore((s) => s + 1);
    },
    [answered, q],
  );

  function next() {
    if (idx + 1 >= questions.length) {
      setDone(true);
      return;
    }
    setIdx((i) => i + 1);
    setChoice(null);
    setAnswered(false);
  }

  function close() {
    Animated.timing(slide, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }).start(() =>
      onClose(),
    );
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            {!done && q ? (
              <>
                <View style={styles.head}>
                  <Pressable onPress={close}>
                    <Text style={styles.close}>✕</Text>
                  </Pressable>
                  <Text style={styles.headTitle}>Quick Quiz</Text>
                  <Text style={styles.progress}>
                    Q{idx + 1}/{questions.length}
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.qtext}>{q.question}</Text>
                  {q.options.map((opt, i) => {
                    let bg = colors.background;
                    let border = colors.border;
                    if (answered) {
                      if (i === q.answerIndex) {
                        bg = colors.mildLight;
                        border = colors.mild;
                      } else if (choice === i) {
                        bg = colors.emergencyLight;
                        border = colors.emergency;
                      }
                    }
                    return (
                      <Pressable
                        key={opt}
                        style={[styles.opt, { backgroundColor: bg, borderColor: border }]}
                        onPress={() => pick(i)}
                      >
                        <Text style={styles.optText}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                  {answered && q.explanation ? (
                    <View style={styles.explain}>
                      <Text style={styles.explainTxt}>💡 {q.explanation}</Text>
                    </View>
                  ) : null}
                  {answered ? (
                    <Pressable style={styles.nextBtn} onPress={next}>
                      <Text style={styles.nextTxt}>
                        {idx + 1 >= questions.length ? 'See results' : 'Next question →'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : (
              <Results
                score={score}
                total={questions.length}
                onReview={() => {
                  setIdx(0);
                  setChoice(null);
                  setAnswered(false);
                  setScore(0);
                  setDone(false);
                }}
                onDone={close}
              />
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Results({
  score,
  total,
  onReview,
  onDone,
}: {
  score: number;
  total: number;
  onReview: () => void;
  onDone: () => void;
}) {
  const label =
    score === total
      ? 'Perfect! 🎉'
      : score >= total - 1
        ? 'Excellent! 🌟'
        : score >= Math.ceil(total * 0.6)
          ? 'Good effort! 👍'
          : 'Keep learning! 📚';

  return (
    <View style={styles.results}>
      <Text style={styles.bigScore}>
        {score}/{total}
      </Text>
      <Text style={styles.perf}>{label}</Text>
      <View style={styles.circleWrap}>
        <View style={[styles.circleFill, { width: `${(score / Math.max(1, total)) * 100}%` }]} />
      </View>
      <Pressable style={styles.secondaryBtn} onPress={onReview}>
        <Text style={styles.secondaryTxt}>Review answers</Text>
      </Pressable>
      <Pressable style={styles.doneBtn} onPress={onDone}>
        <Text style={styles.doneTxt}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.92,
    paddingBottom: spacing.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  close: { fontSize: 22, color: colors.textSecondary, padding: spacing.sm },
  headTitle: { ...typography.h3, flex: 1, textAlign: 'center' },
  progress: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  card: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  qtext: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  opt: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
  },
  optText: { fontSize: 15, color: colors.textPrimary },
  explain: {
    backgroundColor: colors.infoLight,
    borderRadius: radius.md,
    padding: 14,
    marginTop: spacing.sm,
  },
  explainTxt: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  nextBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  nextTxt: { color: colors.textOnAccent, fontWeight: '700', fontSize: 15 },
  results: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  bigScore: { fontSize: 56, fontWeight: '800', color: colors.primary },
  perf: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
  circleWrap: {
    height: 12,
    width: '80%',
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  circleFill: {
    height: 12,
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  secondaryBtn: { padding: 12 },
  secondaryTxt: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  doneTxt: { color: colors.textOnAccent, fontWeight: '700', fontSize: 16 },
});
