import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Send } from 'lucide-react-native';

import { Badge, Body, Button, Muted, Section, Title } from '../../src/components/ui';
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
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.aestheticScreen}>
        <View style={styles.glowA} />
        <View style={styles.glowB} />

        <Section style={styles.heroSection}>
          <View style={styles.identityWrap}>
            <Text style={styles.avatar}>🐶</Text>
            <Title>Rapha L1</Title>
            <Muted>Your AI assistant</Muted>
            <View style={styles.badgeRow}>
              <Badge tone={session?.status === 'deferred' ? 'warning' : 'success'}>{statusCopy}</Badge>
            </View>
          </View>
        </Section>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={
            <View style={styles.emptyHint}>
              <Body>Start with symptoms, a first-aid question, or a prescription request.</Body>
              <Muted>Example: "I have chest pain and trouble breathing" or "I need to fill a prescription."</Muted>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
              <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>{item.content}</Text>
            </View>
          )}
        />

        {lastStructured ? (
          <Section style={styles.structuredCard}>
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
      </View>
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
  loadingScreen: {
    flex: 1,
    backgroundColor: '#efe5f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aestheticScreen: {
    flex: 1,
    backgroundColor: '#eadcf7',
    padding: spacing.lg,
    gap: spacing.md,
  },
  glowA: {
    position: 'absolute',
    left: -20,
    top: 40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  glowB: {
    position: 'absolute',
    right: -40,
    top: 180,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroSection: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(130, 105, 170, 0.28)',
    borderRadius: 18,
  },
  identityWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  avatar: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    marginTop: spacing.xs,
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
    paddingBottom: spacing.sm,
  },
  emptyHint: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    opacity: 0.85,
  },
  message: {
    maxWidth: '88%',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7f5ca8',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(123, 98, 153, 0.3)',
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
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(130, 105, 170, 0.28)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(130, 105, 170, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  structuredCard: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderColor: 'rgba(130, 105, 170, 0.28)',
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
