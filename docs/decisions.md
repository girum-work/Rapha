# Rapha engineering decisions log

This file was missing from the repo; it is recreated to record the authoritative behavior agreed for core plumbing. Session numbers reference the original decision log wherever it existed outside git.

---

## Session 2 — Root auth gating (`app/_layout.tsx`)

The root layout is responsible for Supabase-backed navigation (no Clerk, no OAuth helpers, no in-app magic-link URLs):

1. **`import { supabase, hasSupabaseConfig }`** from **`src/lib/supabase.ts`** (client is initialized when the module loads).
2. On mount, call **`supabase.auth.getSession()`** (skipped when Supabase env is missing).
3. Subscribe with **`supabase.auth.onAuthStateChange`**. **`TOKEN_REFRESHED`** must update the session reference only — do **not** re-run profile gating or block the UI for token rotation.
4. **Routing**
   - **No session** → **`/sign-in`** (public **`/sign-up`** stays reachable).
   - **Session present, no row in **`public.profiles`** for `auth.uid()`** → **`/onboarding`**.
   - **Session present and profile exists** → **`/(drawer)/dashboard`** whenever the user would otherwise sit on **`sign-in`**, **`sign-up`**, or **`onboarding`**.
5. **Loading UX:** fullscreen **teal** (`theme `colors.primary`) + **“Rapha”** + spinner while **`getSession`/initial profile probe** completes (and whenever a profile re-fetch gate is intentionally active).
6. **Navigator:** **`Stack`** explicitly lists **`sign-in`**, **`sign-up`**, **`onboarding`**, and **`(drawer)`**. Expo Router requires matching **`app/sign-in.tsx`**, **`app/sign-up.tsx`**, etc.; the stack cannot exist as URLs without those modules.

Profile existence is verified with **`from('profiles').select('id').eq('id', user.id).maybeSingle()`** using the anon client and RLS (user reads own row).

---

## Session 15 — Push notification routing (`DrawerNotificationBridge`)

- **`DrawerNotificationBridge`** runs at the root (alongside `Stack`): on cold start **`getLastNotificationResponseAsync`** and at runtime **`addNotificationResponseReceivedListener`**.
- When notification **`content.data`** includes **`url`** as a string, **`router.push(url as Href)`** so deferred-care (or other) pushes deep-link into the correct screen.
- Keep handlers minimal: no auth providers; assume session already restored by Supabase before navigation if the link targets a protected area.

---

## Authentication (mobile)

- Email confirmation redirect URLs are configured in the **Supabase dashboard** only. The app must not pass `signUp(..., redirectTo)` variants that break the TypeScript SDK.
- **`src/lib/supabase.ts`**: single `createClient` using `AsyncStorage`, `persistSession: true`, `autoRefreshToken: true`. No Clerk, OAuth, magic-link handling, `detectSessionInUrl`, or in-code redirect URL manipulation.

---

## Session 10 — Prescription OCR (edge)

- **`supabase/functions/prescription-ocr`**: primary path is **`PADDLE_OCR_HTTP_URL`** — JSON POST with `{ image_base64, image, images }` for compatibility with common PaddleOCR HTTP wrappers.
- Parses multiple response shapes (`result` boxes, `data.lines`, plain `text`, etc.).
- If the URL or image is absent, returns a deterministic **demo OCR + medications** payload (same as legacy mock copy).

Google Cloud Vision is **not** the primary path here.

---

## Session 12 — Facility search (edge)

- **`supabase/functions/facility-search`**: uses **OpenStreetMap via Overpass** (`OVERPASS_API_URL`, default `https://overpass-api.de/api/interpreter`).
- Request body supports `latitude`, `longitude`, `radius_m`, `required_tags`; defaults centred on Addis Ababa demo coordinates when lat/lon omitted.
- Responses are ranked by **`required_tags` match score**, then **`distance_km`**.

Supabase-table-only facility listing was superseded by this OSM-backed flow.

---

## Session 13 — Pharmacy match (edge)

- **`supabase/functions/pharmacy-match`**: still reads **`pharmacy_stock`** (+ `pharmacies`) with the caller JWT on the anon key.
- Returns **`matches`** (flat filtered rows) plus **`pharmacies`** grouped/ranked list for richer clients.

---

## Step 5 — Chat triage (edge)

- **`supabase/functions/chat-triage`**:
  - **Groq** OpenAI-compatible streaming **`POST /openai/v1/chat/completions`** (default base `https://api.groq.com`) with **`GROQ_API_KEY`** and model **`GROQ_MODEL`** (default **`llama-3.3-70b-versatile`** — Llama on Groq).
  - Override URL with **`GROQ_CHAT_COMPLETIONS_URL`** only if Groq documents a different endpoint.
  - Server consumes the SSE stream, then parses output.
  - **Profile injection**: with **`SUPABASE_SERVICE_ROLE_KEY`** and `Authorization` bearer JWT — loads **`profiles`** for `auth.getUser` id and injects anonymized snippets into the system prompt (allergies, meds, blood type, emergency contact).
  - **`<rapha_action>...</rapha_action>`** line: JSON `{ action, severity, confidence }` merged into structured output.
  - **`symptom_clusters`**, **`news2_score`**, **`news2_band`**: heuristic from transcript text (informative only when vitals aren’t reliably measured).
  - **Tripwire**: hard escalation to **`emergency`** + critical severity when text or NEWS2-like score crosses thresholds; prefixes the assistant reply with a safety line.
  - Fallback when Groq fails or **`GROQ_API_KEY`** is unset: deterministic mock structured triage (+ tripwire overlays).

OpenRouter/DeepSeek and Anthropic Claude are **not** used here.

---

## 2026-05-03 — Recover from broken auth/signUp client call

- **`app/(drawer)/account.tsx`**: `signUp` restored to **`signUp({ email, password })`** (single-arg form for `@supabase/supabase-js`), removing invalid second-argument redirects.
