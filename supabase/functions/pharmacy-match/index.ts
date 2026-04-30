import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.87.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const requested = (Array.isArray(body.drug_names) ? body.drug_names : []).map((drug: string) => drug.toLowerCase());
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data, error } = await supabase.from('pharmacy_stock').select('*, pharmacies(*)');
  if (error) return jsonResponse({ error: error.message }, 500);

  const matches = (data ?? []).filter((stock) =>
    requested.some((drug: string) => stock.drug_name?.toLowerCase().includes(drug) || stock.brand_name?.toLowerCase().includes(drug)),
  );

  return jsonResponse({ matches });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
