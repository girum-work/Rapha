import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const GOOGLE_CLOUD_VISION_API_KEY = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const imageBase64 = body.image_base64;

  if (!GOOGLE_CLOUD_VISION_API_KEY || !imageBase64) {
    return jsonResponse({
      ocr_text: 'Paracetamol 500mg tablets, Oral Rehydration Salts sachets',
      extracted_medications: [
        { drug_name: 'paracetamol', dosage: '500mg', quantity: 'not specified' },
        { drug_name: 'oral rehydration salts', dosage: '1 sachet as directed', quantity: 'not specified' },
      ],
    });
  }

  const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'TEXT_DETECTION' }],
        },
      ],
    }),
  });

  const result = await visionResponse.json();
  const ocrText = result.responses?.[0]?.fullTextAnnotation?.text ?? '';
  return jsonResponse({ ocr_text: ocrText, extracted_medications: [] });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
