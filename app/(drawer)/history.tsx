import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Muted, Screen, Section, Title } from '../../src/components/ui';
import { getOrCreateSession } from '../../src/lib/sessionStore';
import { colors, spacing } from '../../src/theme';
import { ChatMessage, ChatSession } from '../../src/types';

export default function HistoryScreen() {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    getOrCreateSession().then((result) => {
      setSession(result.session);
      setMessages(result.messages);
    });
  }, []);

  const structuredMessages = messages.filter((message) => message.structuredResponse);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section>
          <Title>History</Title>
          <Muted>Current MVP stores and resumes the active local session. Supabase persistence uses the same shape.</Muted>
        </Section>

        {session ? (
          <Section>
            <View style={styles.row}>
              <Body>{session.id}</Body>
              <Badge tone={session.status === 'completed' ? 'success' : session.status === 'deferred' ? 'warning' : 'default'}>
                {session.status}
              </Badge>
            </View>
            <Muted>Started {new Date(session.startedAt).toLocaleString()}</Muted>
            {session.deferredUntil ? <Muted>Deferred until {new Date(session.deferredUntil).toLocaleString()}</Muted> : null}
          </Section>
        ) : null}

        <Section>
          <Body>Triage events</Body>
          {structuredMessages.length === 0 ? <Muted>No structured triage result yet.</Muted> : null}
          {structuredMessages.map((message) => (
            <View key={message.id} style={styles.item}>
              <Text style={styles.itemTitle}>{message.structuredResponse?.action}</Text>
              <Muted>
                {message.structuredResponse?.severity} - confidence {Math.round((message.structuredResponse?.confidence ?? 0) * 100)}%
              </Muted>
              <Muted>{message.createdAt}</Muted>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  item: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  itemTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
});
