import AsyncStorage from '@react-native-async-storage/async-storage';

import { dbgIngestLog } from './debugIngest';
import { makeMockTriage, triageConnectionFallback } from './mockTriage';
import { hasSupabaseConfig, supabase } from './supabase';
import { ChatMessage, ChatSession, TriageResponse } from '../types';

const SESSION_KEY = 'rapha.currentSession';
const MESSAGES_KEY = 'rapha.messages';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function now() {
  return new Date().toISOString();
}

function newSessionId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createLocalSession(): ChatSession {
  const timestamp = now();
  return {
    id: newSessionId(),
    status: 'active',
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function persistChatLocally(session: ChatSession, messages: ChatMessage[]) {
  await Promise.all([
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
    AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)),
  ]);
}

/** Load a remote Supabase session + messages into local storage (e.g. History “View full”). */
export async function hydrateSessionFromRemote(sessionId: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase || !UUID_RE.test(sessionId)) return false;
  const { data: row, error: sErr } = await supabase
    .from('chat_sessions')
    .select('id, status, started_at, updated_at, deferred_until, final_severity, final_action')
    .eq('id', sessionId)
    .maybeSingle();
  if (sErr || !row) return false;

  const { data: msgRows, error: mErr } = await supabase
    .from('chat_messages')
    .select('id, role, content, structured_response, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (mErr) return false;

  const session: ChatSession = {
    id: row.id as string,
    status: row.status as ChatSession['status'],
    startedAt: row.started_at as string,
    updatedAt: row.updated_at as string,
    deferredUntil: (row.deferred_until as string | null) ?? undefined,
    finalSeverity: (row.final_severity as ChatSession['finalSeverity']) ?? undefined,
    finalAction: (row.final_action as ChatSession['finalAction']) ?? undefined,
  };

  const messages: ChatMessage[] = (msgRows ?? []).map((m) => ({
    id: (m.id as string) ?? `db-${sessionId}-${m.created_at}`,
    sessionId,
    role: m.role as ChatMessage['role'],
    content: m.content as string,
    structuredResponse: (m.structured_response as TriageResponse | null) ?? undefined,
    createdAt: m.created_at as string,
  }));

  await persistChatLocally(session, messages);
  return true;
}

export async function getOrCreateSession(): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const [sessionRaw, messagesRaw] = await Promise.all([
    AsyncStorage.getItem(SESSION_KEY),
    AsyncStorage.getItem(MESSAGES_KEY),
  ]);

  if (sessionRaw) {
    const session = JSON.parse(sessionRaw) as ChatSession;
    if (session.id.startsWith('local-')) {
      const newId = newSessionId();
      const messages = messagesRaw ? (JSON.parse(messagesRaw) as ChatMessage[]) : [];
      const migrated = messages.map((m) => ({ ...m, sessionId: newId }));
      const nextSession: ChatSession = { ...session, id: newId };
      await persistChatLocally(nextSession, migrated);
      return { session: nextSession, messages: migrated };
    }
    if (session.status === 'active' || session.status === 'deferred') {
      return {
        session,
        messages: messagesRaw ? (JSON.parse(messagesRaw) as ChatMessage[]) : [],
      };
    }
  }

  const session = createLocalSession();
  await persistChatLocally(session, []);
  return { session, messages: [] };
}

export async function sendChatMessage(
  session: ChatSession,
  existingMessages: ChatMessage[],
  content: string,
): Promise<{ session: ChatSession; messages: ChatMessage[]; structured: TriageResponse }> {
  const userMessage: ChatMessage = {
    id: `msg-${Date.now()}`,
    sessionId: session.id,
    role: 'user',
    content,
    createdAt: now(),
  };

  const triage = await callTriage(session.id, [...existingMessages, userMessage], content);
  const assistantMessage: ChatMessage = {
    id: `msg-${Date.now()}-assistant`,
    sessionId: session.id,
    role: 'assistant',
    content: triage.reply,
    structuredResponse: triage.structured,
    createdAt: now(),
    connectionFallback: triage.connectionError,
  };

  const updatedSession: ChatSession = {
    ...session,
    updatedAt: now(),
    finalAction: triage.structured.action === 'ask_more' ? session.finalAction : triage.structured.action,
    finalSeverity:
      triage.structured.action === 'ask_more' ? session.finalSeverity : triage.structured.severity,
  };
  const messages = [...existingMessages, userMessage, assistantMessage];
  await persistChatLocally(updatedSession, messages);
  void syncChatExchangeToSupabase(updatedSession, userMessage, assistantMessage);
  return { session: updatedSession, messages, structured: triage.structured };
}

export async function deferSession(session: ChatSession, hours = 6) {
  const deferredUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const updated: ChatSession = { ...session, status: 'deferred', deferredUntil, updatedAt: now() };
  await persistChatLocally(updated, await loadMessagesFromStorage());
  void syncSessionRowOnly(updated);
  return updated;
}

export async function completeSession(session: ChatSession) {
  const messages = await loadMessagesFromStorage();
  const updated: ChatSession = { ...session, status: 'completed', updatedAt: now() };
  await persistChatLocally(updated, messages);
  void syncSessionRowOnly(updated);
  return updated;
}

async function loadMessagesFromStorage(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
}

async function syncSessionRowOnly(session: ChatSession) {
  if (!hasSupabaseConfig || !supabase || !UUID_RE.test(session.id)) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { error } = await supabase.from('chat_sessions').upsert(
    {
      id: session.id,
      user_id: userData.user.id,
      status: session.status,
      started_at: session.startedAt,
      updated_at: session.updatedAt,
      deferred_until: session.deferredUntil ?? null,
      final_severity: session.finalSeverity ?? null,
      final_action: session.finalAction ?? null,
    },
    { onConflict: 'id' },
  );
  // #region agent log
  dbgIngestLog({
    hypothesisId: 'H6-meta',
    location: 'sessionStore.ts:syncSessionRowOnly',
    message: 'session meta upsert',
    data: { ok: !error, err: error?.message ?? null, chatSessionId: session.id },
  });
  // #endregion
}

async function syncChatExchangeToSupabase(
  session: ChatSession,
  userMessage: ChatMessage,
  assistantMessage: ChatMessage,
) {
  // #region agent log
  dbgIngestLog({
    hypothesisId: 'H6',
    location: 'sessionStore.ts:syncChatExchangeToSupabase:entry',
    message: 'sync start',
    data: {
      hasSupabase: !!supabase,
      sessionId: session.id,
      uuidOk: UUID_RE.test(session.id),
      contentLen: userMessage.content.length,
    },
  });
  // #endregion

  if (!hasSupabaseConfig || !supabase || !UUID_RE.test(session.id)) return;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    // #region agent log
    dbgIngestLog({
      hypothesisId: 'H6',
      location: 'sessionStore.ts:sync:noUser',
      message: 'skip sync no auth user',
      data: { err: userErr?.message ?? null },
    });
    // #endregion
    return;
  }

  const row = {
    id: session.id,
    user_id: userData.user.id,
    status: session.status,
    started_at: session.startedAt,
    updated_at: session.updatedAt,
    deferred_until: session.deferredUntil ?? null,
    final_severity: session.finalSeverity ?? null,
    final_action: session.finalAction ?? null,
  };

  const { error: sessionErr } = await supabase.from('chat_sessions').upsert(row, { onConflict: 'id' });
  if (sessionErr) {
    // #region agent log
    dbgIngestLog({
      hypothesisId: 'H1',
      location: 'sessionStore.ts:sync:sessionUpsert',
      message: 'chat_sessions upsert failed',
      data: { err: sessionErr.message, code: sessionErr.code },
    });
    // #endregion
    return;
  }

  const { error: msgErr } = await supabase.from('chat_messages').insert([
    {
      session_id: session.id,
      role: 'user',
      content: userMessage.content,
      structured_response: null,
    },
    {
      session_id: session.id,
      role: 'assistant',
      content: assistantMessage.content,
      structured_response: assistantMessage.structuredResponse ?? null,
    },
  ]);

  // #region agent log
  dbgIngestLog({
    hypothesisId: 'H2',
    location: 'sessionStore.ts:sync:messagesInsert',
    message: msgErr ? 'chat_messages insert failed' : 'chat_messages insert ok',
    data: { err: msgErr?.message ?? null, code: msgErr?.code ?? null },
  });
  // #endregion
}

async function callTriage(
  sessionId: string,
  messages: ChatMessage[],
  latestMessage: string,
): Promise<{ reply: string; structured: TriageResponse; connectionError?: boolean }> {
  if (hasSupabaseConfig && supabase) {
    const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    const trimmed = latestMessage.trim();

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[Rapha] chat-triage invoke', {
        message: trimmed,
        sessionId,
        messageCount: messages.length,
      });
    }

    const { data, error } = await supabase.functions.invoke('chat-triage', {
      body: {
        message: trimmed,
        session_id: sessionId || undefined,
        messages: conversationHistory,
      },
    });

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[Rapha] chat-triage response',
        error ? { error } : { hasReply: !!(data as { reply?: string })?.reply },
      );
    }

    if (error) {
      // eslint-disable-next-line no-console
      console.error('[Rapha] chat-triage error', error);
      return { ...triageConnectionFallback(), connectionError: true };
    }

    const payload = data as { reply?: string; structured?: TriageResponse } | null;
    if (payload?.reply && payload?.structured) {
      return { reply: payload.reply, structured: payload.structured };
    }

    return { ...triageConnectionFallback(), connectionError: true };
  }

  return makeMockTriage(latestMessage);
}
