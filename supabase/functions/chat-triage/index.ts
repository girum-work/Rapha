import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const message = String(body.message ?? '');
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!ANTHROPIC_API_KEY) {
      return jsonResponse(mockResponse(message));
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: systemPrompt(),
        messages: messages
          .filter((entry: { role?: string; content?: string }) => entry.role === 'user' || entry.role === 'assistant')
          .map((entry: { role: string; content: string }) => ({ role: entry.role, content: entry.content })),
      }),
    });

    if (!anthropicResponse.ok) {
      return jsonResponse(mockResponse(message), 200);
    }

    const result = await anthropicResponse.json();
    const text = result.content?.map((part: { text?: string }) => part.text ?? '').join('\n') ?? '';
    const parsed = parseJsonBlock(text);
    return jsonResponse({
      reply: parsed.reply,
      structured: parsed.structured,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

function systemPrompt() {
  return `
You are Dr Lucas inside Rapha, a demo-safe medical triage assistant for Ethiopia.
Do not give a final diagnosis. Ask clarifying questions until you have enough information.
When red flags appear, route to emergency.
Return JSON only with this shape:
{
  "reply": "short user-facing response",
  "structured": {
    "conditions": [{"name": "...", "confidence": 0.0, "rationale": "..."}],
    "severity": "critical|urgent|mild",
    "confidence": 0.0,
    "next_question": "...",
    "red_flags": ["..."],
    "action": "ask_more|emergency|hospital|clinic|pharmacy|first_aid|self_care",
    "required_services": ["emergency", "lab", "pharmacy"],
    "safety_disclaimer": "Rapha is not a final diagnosis..."
  }
}
`;
}

function parseJsonBlock(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return parsed;
}

function mockResponse(message: string) {
  const lower = message.toLowerCase();
  const emergency = lower.includes('chest') || lower.includes('breath') || lower.includes('bleeding');
  const action = emergency ? 'emergency' : lower.includes('prescription') ? 'pharmacy' : 'ask_more';
  return {
    reply:
      action === 'ask_more'
        ? 'I need a little more detail: when did this start, how severe is it, and are there any red-flag symptoms?'
        : 'I found a care path for this. Please confirm before Rapha simulates the next step.',
    structured: {
      conditions: emergency
        ? [{ name: 'Potential acute emergency', confidence: 0.82, rationale: 'The message includes red-flag symptoms.' }]
        : [],
      severity: emergency ? 'critical' : 'urgent',
      confidence: emergency ? 0.82 : 0.52,
      next_question: action === 'ask_more' ? 'When did this start and how severe is it from 1 to 10?' : undefined,
      red_flags: ['chest pain', 'trouble breathing', 'heavy bleeding', 'confusion'],
      action,
      required_services: emergency ? ['emergency'] : [],
      safety_disclaimer:
        'Rapha is not a final diagnosis. If symptoms feel severe, worsening, or unsafe, seek professional emergency care now.',
    },
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
