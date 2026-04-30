import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShieldPlus } from 'lucide-react-native';

import { Badge, Body, Muted, Screen, Section, Title } from '../../src/components/ui';
import { accessories, learnArticles } from '../../src/data/learn';
import { colors, spacing } from '../../src/theme';

export default function AccessoriesScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <Title>Accessories</Title>
          <Muted>Static MVP first-aid catalog. Triage can link back to these items when supplies are needed.</Muted>
        </Section>

        <Section>
          {accessories.map((item) => {
            const related = learnArticles.filter((article) => article.relatedAccessoryIds.includes(item.id));
            return (
              <View key={item.id} style={styles.item}>
                <View style={styles.row}>
                  <ShieldPlus size={20} stroke={colors.primary} />
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                <Body>{item.useCase}</Body>
                <Muted>{item.notes}</Muted>
                <View style={styles.tags}>
                  {related.map((article) => (
                    <Badge key={article.id}>{article.title}</Badge>
                  ))}
                </View>
              </View>
            );
          })}
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
  item: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
