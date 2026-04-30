import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Button, Muted, Screen, Section, Title } from '../../src/components/ui';
import { learnArticles, quizQuestions } from '../../src/data/learn';
import { colors, radius, spacing } from '../../src/theme';

export default function LearnScreen() {
  const [selectedArticleId, setSelectedArticleId] = useState(learnArticles[0].id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const selectedArticle = learnArticles.find((article) => article.id === selectedArticleId) ?? learnArticles[0];
  const score = quizQuestions.filter((question) => answers[question.id] === question.answerIndex).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <Title>Learn</Title>
          <Muted>First-aid articles and a short quiz. Quiz results do not affect medical triage in the MVP.</Muted>
        </Section>

        <Section>
          <Body>Articles</Body>
          <View style={styles.articleGrid}>
            {learnArticles.map((article) => (
              <Pressable
                key={article.id}
                onPress={() => setSelectedArticleId(article.id)}
                style={[styles.articleButton, selectedArticle.id === article.id && styles.articleButtonActive]}
              >
                <Text style={styles.articleButtonText}>{article.title}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section>
          <View style={styles.row}>
            <Title>{selectedArticle.title}</Title>
            <Badge>{selectedArticle.category}</Badge>
          </View>
          <Body>{selectedArticle.summary}</Body>
          {selectedArticle.steps.map((step, index) => (
            <Text key={step} style={styles.step}>
              {index + 1}. {step}
            </Text>
          ))}
          <Body>Warning signs</Body>
          {selectedArticle.warningSigns.map((sign) => (
            <Muted key={sign}>{sign}</Muted>
          ))}
        </Section>

        <Section>
          <View style={styles.row}>
            <Body>First-aid quiz</Body>
            <Badge tone={Object.keys(answers).length === quizQuestions.length ? 'success' : 'default'}>
              {score}/{quizQuestions.length}
            </Badge>
          </View>
          {quizQuestions.map((question) => (
            <View key={question.id} style={styles.question}>
              <Body>{question.question}</Body>
              {question.options.map((option, index) => (
                <Button
                  key={option}
                  variant={answers[question.id] === index ? 'primary' : 'secondary'}
                  onPress={() => setAnswers((current) => ({ ...current, [question.id]: index }))}
                >
                  {option}
                </Button>
              ))}
            </View>
          ))}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  articleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  articleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  articleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  articleButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  step: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  question: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
