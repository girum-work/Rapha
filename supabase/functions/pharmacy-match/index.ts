import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const requested = (Array.isArray(body.drug_names) ? body.drug_names : [])
      .map((d: string) => String(d).toLowerCase().trim())
      .filter(Boolean);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { data, error } = await supabase.from('pharmacy_stock').select('*, pharmacies(*)');
    if (error) return jsonResponse({ error: error.message, matches: [], pharmacies: [] }, 500);

    const stocks = data ?? [];

    const flatMatches =
      requested.length === 0
        ? []
        : stocks.filter((row: StockRow) =>
            requested.some(
              (drug: string) =>
                String(row.drug_name ?? '').toLowerCase().includes(drug) ||
                String(row.brand_name ?? '').toLowerCase().includes(drug),
            ),
          );

    const grouped = groupByPharmacy(flatMatches, requested);

    return jsonResponse({
      matches: flatMatches,
      pharmacies: grouped,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error', matches: [], pharmacies: [] }, 500);
  }
});

type PharmacyRow = {
  id: string;
  name?: string;
  neighborhood?: string;
  phone?: string;
};

type StockRow = {
  id: string;
  pharmacy_id?: string;
  drug_name?: string;
  brand_name?: string;
  quantity?: number;
  unit?: string;
  pharmacies?: PharmacyRow | PharmacyRow[] | null;
};

function groupByPharmacy(rows: StockRow[], requested: string[]) {
  const map = new Map<
    string,
    {
      pharmacy_id: string;
      pharmacy?: PharmacyRow;
      stocks: StockRow[];
      matched_drug_hints: Set<string>;
      score: number;
    }
  >();

  for (const row of rows) {
    const pid = String(row.pharmacy_id ?? (row.pharmacies as PharmacyRow)?.id ?? '');
    if (!pid) continue;
    let entry = map.get(pid);
    const pharmacySingle = normalizePharmacy(row.pharmacies);
    if (!entry) {
      entry = {
        pharmacy_id: pid,
        pharmacy: pharmacySingle,
        stocks: [],
        matched_drug_hints: new Set(),
        score: 0,
      };
      map.set(pid, entry);
    }
    entry.stocks.push(row);
    const dn = String(row.drug_name ?? '').toLowerCase();
    const bn = String(row.brand_name ?? '').toLowerCase();
    for (const drug of requested) {
      if (dn.includes(drug) || bn.includes(drug)) {
        entry.matched_drug_hints.add(drug);
        entry.score += Number(row.quantity ?? 0) + 10;
      }
    }
    if (!entry.pharmacy && pharmacySingle) entry.pharmacy = pharmacySingle;
  }

  return [...map.values()]
    .map((v) => ({
      pharmacy_id: v.pharmacy_id,
      pharmacy: v.pharmacy ?? null,
      stocks: v.stocks,
      matched_drugs: [...v.matched_drug_hints],
      match_rank_score: v.score + v.matched_drug_hints.size * 50,
      available_units: v.stocks.reduce((t, s) => t + Number(s.quantity ?? 0), 0),
    }))
    .sort((a, b) => b.match_rank_score - a.match_rank_score);
}

function normalizePharmacy(ph: StockRow['pharmacies']): PharmacyRow | undefined {
  if (!ph) return undefined;
  if (Array.isArray(ph)) return ph[0];
  return ph as PharmacyRow;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
