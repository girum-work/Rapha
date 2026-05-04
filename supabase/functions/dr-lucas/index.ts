/**
 * Dr Lucas — public entry for the mobile app.
 * Proxies to `chat-triage` so the client always calls `dr-lucas` while Groq logic stays centralized.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';

  const incoming = await req.json().catch(() => ({}));
  const message = String(incoming.message ?? '');
  const messages = Array.isArray(incoming.messages) ? incoming.messages : [];
  const session_id = incoming.sessionId ?? incoming.session_id ?? '';

  const target = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/chat-triage`;

  const upstream = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth,
      apikey: anonKey,
    },
    body: JSON.stringify({ message, messages, session_id }),
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('content-type') ?? 'application/json';

  return new Response(text, {
    status: upstream.status,
    headers: { ...corsHeaders, 'content-type': ct },
  });
});
