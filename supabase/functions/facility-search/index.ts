import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const requiredTags = Array.isArray(body.required_tags) ? body.required_tags : ['general'];
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data, error } = await supabase.from('facilities').select('*');
  if (error) return jsonResponse({ error: error.message }, 500);

  const ranked = [...(data ?? [])].sort((a, b) => {
    const aMatches = requiredTags.filter((tag: string) => a.capability_tags?.includes(tag)).length;
    const bMatches = requiredTags.filter((tag: string) => b.capability_tags?.includes(tag)).length;
    return bMatches - aMatches;
  });

  return jsonResponse({ facilities: ranked });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
