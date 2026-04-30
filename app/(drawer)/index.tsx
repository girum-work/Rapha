import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Send } from 'lucide-react-native';

import { Badge, Body, Button, Muted, Screen, Section, Title } from '../../src/components/ui';
import { completeSession, deferSession, getOrCreateSession, sendChatMessage } from '../../src/lib/sessionStore';
import { colors, radius, spacing } from '../../src/theme';
import { ChatMessage, ChatSession, TriageResponse } from '../../src/types';

export default function HomeScreen() {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastStructured, setLastStructured] = useState<TriageResponse | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    getOrCreateSession()
      .then(({ session: nextSession, messages: nextMessages }) => {
        setSession(nextSession);
        setMessages(nextMessages);
        const structured = [...nextMessages].reverse().find((message) => message.structuredResponse)?.structuredResponse;
        setLastStructured(structured ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusCopy = useMemo(() => {
    if (!session) return 'Preparing session';
    if (session.status === 'deferred') return `Deferred until ${new Date(session.deferredUntil ?? '').toLocaleString()}`;
    return 'Active triage session';
  }, [session]);

  async function handleSend() {
    if (!session || !input.trim()) return;
    setSending(true);
    const result = await sendChatMessage(session, messages, input.trim());
    setSession(result.session);
    setMessages(result.messages);
    setLastStructured(result.structured);
    setInput('');
    setSending(false);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }

  async function handleDefer() {
    if (!session) return;
    const updated = await deferSession(session);
    setSession(updated);
  }

  async function handleComplete() {
    if (!session) return;
    const updated = await completeSession(session);
    setSession(updated);
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Section>
          <View style={styles.row}>
            <Title>Dr Lucas</Title>
            <Badge tone={session?.status === 'deferred' ? 'warning' : 'success'}>{statusCopy}</Badge>
          </View>
          <Muted>Tell Rapha what you feel. The app will ask follow-up questions before routing care.</Muted>
        </Section>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={
            <Section>
              <Body>Start with symptoms, a first-aid question, or a prescription request.</Body>
              <Muted>Example: "I have chest pain and trouble breathing" or "I need to fill a prescription."</Muted>
            </Section>
          }
          renderItem={({ item }) => (
            <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
              <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>{item.content}</Text>
            </View>
          )}
        />

        {lastStructured ? (
          <Section>
            <View style={styles.row}>
              <Badge tone={lastStructured.severity === 'critical' ? 'danger' : lastStructured.severity === 'urgent' ? 'warning' : 'success'}>
                {lastStructured.severity}
              </Badge>
              <Badge>{lastStructured.action}</Badge>
            </View>
            <Muted>{lastStructured.safety_disclaimer}</Muted>
            {lastStructured.action !== 'ask_more' ? (
              <Button onPress={() => router.push({ pathname: '/services', params: { action: lastStructured.action } })}>
                View care options
              </Button>
            ) : null}
            {lastStructured.action === 'hospital' || lastStructured.action === 'clinic' ? (
              <View style={styles.buttonRow}>
                <Button variant="secondary" onPress={handleDefer}>
                  Remind me in 6h
                </Button>
                <Button variant="secondary" onPress={handleComplete}>
                  Mark handled
                </Button>
              </View>
            ) : null}
          </Section>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Describe symptoms or upload need"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Button onPress={handleSend}>{sending ? 'Sending' : <SendText />}</Button>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function SendText() {
  return (
    <View style={styles.sendLabel}>
      <Send size={16} stroke={colors.surface} />
      <Text style={styles.sendText}>Send</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  messages: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  message: {
    maxWidth: '88%',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    color: colors.surface,
    fontSize: 15,
    lineHeight: 21,
  },
  assistantText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sendLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sendText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
