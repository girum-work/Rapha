import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PADDLE_OCR_HTTP_URL = Deno.env.get('PADDLE_OCR_HTTP_URL');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const imageBase64 =
      typeof body.image_base64 === 'string'
        ? body.image_base64
        : typeof body.image === 'string'
          ? body.image
          : '';

    if (!imageBase64 || !PADDLE_OCR_HTTP_URL) {
      return jsonResponse(demoPayload());
    }

    const ocrRes = await fetch(PADDLE_OCR_HTTP_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        image: imageBase64,
        images: [imageBase64],
      }),
    });

    if (!ocrRes.ok) {
      return jsonResponse({
        error: `Paddle OCR HTTP ${ocrRes.status}`,
        ocr_text: '',
        extracted_medications: [],
      });
    }

    const raw = await ocrRes.json().catch(() => ({}));
    const ocrText = extractTextFromPaddleLikeResponse(raw);
    return jsonResponse({
      ocr_text: ocrText,
      extracted_medications: extractMedicationsFromText(ocrText),
    });
  } catch (e) {
    return jsonResponse(
      {
        error: e instanceof Error ? e.message : 'Unknown error',
        ocr_text: '',
        extracted_medications: [],
      },
      500,
    );
  }
});

function extractTextFromPaddleLikeResponse(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';

  const r = raw as Record<string, unknown>;

  if (typeof r.ocr_text === 'string') return r.ocr_text;
  if (typeof r.text === 'string') return r.text;

  const data = r.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.text === 'string') return d.text;
    if (Array.isArray(d.lines)) return d.lines.map(String).join('\n');
  }

  if (Array.isArray(r.result)) {
    const lines: string[] = [];
    for (const item of r.result) {
      if (Array.isArray(item) && item.length >= 2) {
        const second = item[1];
        if (Array.isArray(second) && typeof second[0] === 'string') lines.push(second[0]);
        else if (typeof second === 'string') lines.push(second);
      } else if (typeof item === 'string') {
        lines.push(item);
      }
    }
    if (lines.length) return lines.join('\n');
  }

  if (Array.isArray(r.boxes)) {
    return (r.boxes as unknown[])
      .map((b) => {
        if (b && typeof b === 'object' && 'text' in (b as object)) return String((b as { text?: string }).text ?? '');
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function extractMedicationsFromText(text: string): { drug_name: string; dosage: string; quantity: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: { drug_name: string; dosage: string; quantity: string }[] = [];
  const doseRe = /(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)\b[^,\n]*)/i;
  const qtyRe = /(\d+\s*(?:tab|tablet|cap|capsule|sachet|amp|vial|bottle)s?\b|\d+\s*x\s*\d+)/i;

  for (const line of lines) {
    if (line.length < 3) continue;
    const lower = line.toLowerCase();
    if (!/[a-z]{3,}/.test(lower)) continue;
    const dose = line.match(doseRe)?.[1] ?? 'not specified';
    const qty = line.match(qtyRe)?.[1] ?? 'not specified';
    const drugName = line
      .replace(doseRe, '')
      .replace(qtyRe, '')
      .replace(/^\W+|\W+$/g, '')
      .trim() || line;
    out.push({
      drug_name: drugName.slice(0, 200),
      dosage: dose,
      quantity: qty,
    });
    if (out.length >= 20) break;
  }
  return out;
}

function demoPayload() {
  return {
    ocr_text: 'Paracetamol 500mg tablets, Oral Rehydration Salts sachets',
    extracted_medications: [
      { drug_name: 'paracetamol', dosage: '500mg', quantity: 'not specified' },
      { drug_name: 'oral rehydration salts', dosage: '1 sachet as directed', quantity: 'not specified' },
    ],
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
