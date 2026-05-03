import { serve } from 'std/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Default: Addis Ababa centre — Overpass radial search */
const DEFAULT_LAT = 9.0301;
const DEFAULT_LON = 38.7613;
const RADIUS_M = 25_000;

type FacilityRow = {
  id: string;
  name: string;
  facility_type: 'hospital' | 'clinic';
  address: string;
  neighborhood: string;
  phone: string;
  latitude: number;
  longitude: number;
  capability_tags: string[];
  distance_km: number | null;
  source: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const requiredTags: string[] = Array.isArray(body.required_tags) ? body.required_tags : ['general'];
    const lat = typeof body.latitude === 'number' ? body.latitude : DEFAULT_LAT;
    const lon = typeof body.longitude === 'number' ? body.longitude : DEFAULT_LON;
    const radiusM = typeof body.radius_m === 'number' ? body.radius_m : RADIUS_M;

    const overpassUrl = Deno.env.get('OVERPASS_API_URL') ?? 'https://overpass-api.de/api/interpreter';
    const query = buildOverpassQuery(lat, lon, radiusM);

    const res = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      return jsonResponse({ error: `Overpass HTTP ${res.status}`, facilities: [] }, 502);
    }

    const data = (await res.json()) as OverpassResponse;
    const elements = data.elements ?? [];
    const facilities: FacilityRow[] = elements
      .map((el) => elementToFacility(el, lat, lon))
      .filter((f): f is FacilityRow => f !== null)
      .sort((a, b) => {
        const scoreA = tagMatchScore(a.capability_tags, requiredTags);
        const scoreB = tagMatchScore(b.capability_tags, requiredTags);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const da = a.distance_km ?? 999;
        const db = b.distance_km ?? 999;
        return da - db;
      });

    return jsonResponse({ facilities });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error', facilities: [] }, 500);
  }
});

function buildOverpassQuery(lat: number, lon: number, radiusM: number): string {
  return `
[out:json][timeout:25];
(
  node["amenity"="hospital"](around:${radiusM},${lat},${lon});
  way["amenity"="hospital"](around:${radiusM},${lat},${lon});
  relation["amenity"="hospital"](around:${radiusM},${lat},${lon});
  node["healthcare"="hospital"](around:${radiusM},${lat},${lon});
  way["healthcare"="hospital"](around:${radiusM},${lat},${lon});
  node["amenity"="clinic"](around:${radiusM},${lat},${lon});
  way["amenity"="clinic"](around:${radiusM},${lat},${lon});
  node["healthcare"="clinic"](around:${radiusM},${lat},${lon});
  way["healthcare"="clinic"](around:${radiusM},${lat},${lon});
  node["amenity"="doctors"](around:${radiusM},${lat},${lon});
  way["amenity"="doctors"](around:${radiusM},${lat},${lon});
);
out center tags;
`.trim();
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

function elementToFacility(el: OverpassElement, refLat: number, refLon: number): FacilityRow | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags['name:en'] ?? tags.official_name;
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat === undefined || lon === undefined) return null;

  const amenity = tags.amenity ?? '';
  const healthcare = tags.healthcare ?? '';
  const isHospital =
    amenity === 'hospital' || healthcare === 'hospital' || tags.emergency === 'yes';
  const facility_type: 'hospital' | 'clinic' = isHospital ? 'hospital' : 'clinic';

  const capability_tags = buildCapabilityTags(tags, isHospital);
  const address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(' ') || 'Address not in OSM';
  const neighborhood = tags['addr:suburb'] ?? tags['addr:district'] ?? tags['addr:quarter'] ?? tags['addr:neighbourhood'] ?? '';
  const phone = tags.phone ?? tags['contact:phone'] ?? '';

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    facility_type,
    address,
    neighborhood,
    phone,
    latitude: lat,
    longitude: lon,
    capability_tags,
    distance_km: haversineKm(refLat, refLon, lat, lon),
    source: 'openstreetmap_overpass',
  };
}

function buildCapabilityTags(tags: Record<string, string>, isHospital: boolean): string[] {
  const set = new Set<string>();
  if (isHospital) set.add('emergency');
  set.add('general');
  const spec = tags.speciality ?? tags.specialty;
  if (spec) {
    for (const part of spec.split(/[;,]/)) {
      const t = part.trim().toLowerCase().replace(/\s+/g, '_');
      if (t) set.add(t);
    }
  }
  if (tags.emergency === 'yes') set.add('emergency');
  if (/pharmacy/i.test(tags.amenity ?? '')) set.add('pharmacy');
  return [...set];
}

function tagMatchScore(tags: string[], required: string[]): number {
  if (required.includes('general')) return tags.length;
  return required.filter((r) => tags.some((t) => t.includes(r) || r.includes(t))).length;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
