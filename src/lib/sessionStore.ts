import AsyncStorage from '@react-native-async-storage/async-storage';

import { makeMockTriage } from './mockTriage';
import { hasSupabaseConfig, supabase } from './supabase';
import { ChatMessage, ChatSession, TriageResponse } from '../types';

const SESSION_KEY = 'rapha.currentSession';
const MESSAGES_KEY = 'rapha.messages';

function now() {
  return new Date().toISOString();
}

function createLocalSession(): ChatSession {
  const timestamp = now();
  return {
    id: `local-${Date.now()}`,
    status: 'active',
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getOrCreateSession(): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const [sessionRaw, messagesRaw] = await Promise.all([
    AsyncStorage.getItem(SESSION_KEY),
    AsyncStorage.getItem(MESSAGES_KEY),
  ]);

  if (sessionRaw) {
    const session = JSON.parse(sessionRaw) as ChatSession;
    if (session.status === 'active' || session.status === 'deferred') {
      return {
        session,
        messages: messagesRaw ? (JSON.parse(messagesRaw) as ChatMessage[]) : [],
      };
    }
  }

  const session = createLocalSession();
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify([]));
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

  const { reply, structured } = await callTriage(session.id, [...existingMessages, userMessage], content);
  const assistantMessage: ChatMessage = {
    id: `msg-${Date.now()}-assistant`,
    sessionId: session.id,
    role: 'assistant',
    content: reply,
    structuredResponse: structured,
    createdAt: now(),
  };

  const updatedSession: ChatSession = {
    ...session,
    updatedAt: now(),
    finalAction: structured.action === 'ask_more' ? session.finalAction : structured.action,
    finalSeverity: structured.action === 'ask_more' ? session.finalSeverity : structured.severity,
  };
  const messages = [...existingMessages, userMessage, assistantMessage];
  await persistSession(updatedSession, messages);
  return { session: updatedSession, messages, structured };
}

export async function deferSession(session: ChatSession, hours = 6) {
  const deferredUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const updated: ChatSession = { ...session, status: 'deferred', deferredUntil, updatedAt: now() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export async function completeSession(session: ChatSession) {
  const updated: ChatSession = { ...session, status: 'completed', updatedAt: now() };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

async function persistSession(session: ChatSession, messages: ChatMessage[]) {
  await Promise.all([
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
    AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messages)),
  ]);
}

async function callTriage(sessionId: string, messages: ChatMessage[], latestMessage: string) {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.functions.invoke('chat-triage', {
      body: { session_id: sessionId, messages, message: latestMessage },
    });

    if (!error && data?.reply && data?.structured) {
      return data as { reply: string; structured: TriageResponse };
    }
  }

  return makeMockTriage(latestMessage);
}
