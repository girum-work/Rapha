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
5. **Loading UX:** fullscreen **teal** (theme `colors.primary`) + **“Rapha”** + spinner **only until the first `getSession` + profile probe finishes** (`bootstrapDone`). Do **not** tie the overlay to every `onAuthStateChange` profile refetch (that was blanketing onboarding/sign-in and felt like a “refresh”). **`TOKEN_REFRESHED`** updates session only (no profile round-trip). **`INITIAL_SESSION`** still runs **`syncProfileRow`** so React `hasProfile` stays aligned after cold start and password sign-in. When **`session` is still `null` in React** but the user is already on **`/onboarding`**, do **not** `replace('/sign-in')` (avoids a one-frame bounce after login). After onboarding **`profiles` upsert**, emit **`subscribeProfileRowUpdated`** so `hasProfile` updates before navigation (prevents `(drawer)` → forced **`/onboarding`** bounce that remounted the form).
6. **Navigator:** **`Stack`** explicitly lists **`sign-in`**, **`sign-up`**, **`onboarding`**, and **`(drawer)`**. Expo Router requires matching **`app/sign-in.tsx`**, **`app/sign-up.tsx`**, etc.; the stack cannot exist as URLs without those modules.

Profile existence is verified with **`from('profiles').select('id').eq('id', user.id).maybeSingle()`** using the anon client and RLS (user reads own row).

**`profiles` onboarding columns:** migration **`0002_profiles_onboarding_fields.sql`** adds **`display_name`**, **`age`**, and **`chronic_conditions`**. Migration **`0003_profiles_ensure_app_columns.sql`** adds any remaining MVP columns (**`current_medications`**, **`allergies`**, contacts, etc.) with **`IF NOT EXISTS`** so partial / template `profiles` tables match the app upsert (fixes PostgREST **PGRST204** / “column not in schema cache”). Apply with **`supabase db push`** or paste into the Supabase SQL editor. **`saveOnboardingProfile`** calls **`auth.getUser()`** before upsert so the JWT is validated for RLS.

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

---

## 2026-05-04 — Part 1 UI rebuild (tokens, home chat, drawer)

### Theme (`src/theme.ts`)

- **Canonical palette:** deep navy **`#0A1628`** as `primary` (headers, Dr Lucas avatar bubble), teal **`#00C2A8`** as `accent` (CTAs, user bubble, active drawer accents), page canvas **`#F8FAFC`** as `background`, cards **`#FFFFFF`** as `surface`, borders **`#E2E8F0`**, type scale **`textPrimary` / `textSecondary` / `textTertiary`**.
- **Severity:** `emergency` + `emergencyLight`, `urgent` + `urgentLight`, `mild` + `mildLight`; first-aid card uses **`info` / `infoLight`** (`#3B82F6` / `#EFF6FF`); self-care card uses neutral left rail **`#94A3B8`** on **`background`**.
- **Chat bubbles:** user = teal (`userBubble` / white `userText`); assistant copy on white bordered bubble; “DL” avatar on navy circle.
- **Spacing / radius:** adopted Part 1 scale (`xs`–`xxl`, `radius.sm`–`full`); kept **`xxs`** alias (= `xs`) for older component padding; kept **`fonts`** object for root `useFonts` until a later pass drops custom fonts.
- **Legacy aliases** on `colors` preserve older names (`canvas`, `ink`, `hairline`, `danger`, etc.) so screens not yet migrated (sign-in, onboarding, dashboard, …) still typecheck and render sensibly.

### Home / chat (`app/(drawer)/index.tsx`)

- **Layout:** `SafeAreaView` **`edges={['top']}`** + `KeyboardAvoidingView` **`behavior`** `padding` on iOS / `height` on Android; composer **`paddingBottom`** 34 iOS / 16 Android for home indicator.
- **Header:** In-screen only (drawer **`headerShown: false`** on this route); overflow opens drawer via **`DrawerActions.openDrawer()`**; camera control present as UI placeholder (no behavior wired in Part 1).
- **List:** `FlatList` not inverted; **`contentContainerStyle`** includes **`paddingBottom: 16`**; scroll-to-end on new messages / typing footer.
- **Triage cards:** Shown only when latest structured **`action !== 'ask_more'`** and not while **`sending`**; hidden as soon as the user sends the next message (`lastStructured` cleared until the new reply returns). Cards branch on **`emergency`**, **`hospital` / `clinic`**, **`pharmacy`**, **`first_aid`**, **`self_care`** with the Part 1 visual spec (confidence bar = three segments filled to **`confidence`**; condition copy uses **`conditions[0]`** with **`rationale`** as the secondary line). **`Linking.openURL('tel:911')`** on “Call emergency contact” (placeholder number; localize later).
- **Wiring:** Unchanged **`sendChatMessage`** / **`getOrCreateSession`** / **`deferSession`** / **`completeSession`** from **`src/lib/sessionStore.ts`** (still invokes **`chat-triage`** when configured).

### Drawer (`app/(drawer)/_layout.tsx`)

- **Custom drawer content** loads **`profiles.display_name`** and auth email on mount (read-only Supabase client import; no changes under **`src/lib/`**).
- **Chrome:** Drawer background **`primary`** (`#0A1628`); active item **`primaryMid`** + **3px `accent`** left border; inactive icons **`textTertiary`**; active icons **`accent`**; labels white, active label bold.
- **Route order:** index (Dr Lucas) → dashboard → history → learn → accessories → services (Care Options) → settings → account. Emoji suffixes on labels per spec (e.g. Dr Lucas 💬, Dashboard 📊).
- **Footer:** “Rapha v1.0” / “Ethiopia · MVP” in **`#475569`**.
- **`DrawerNotificationBridge`** remains in **`app/_layout.tsx`** (unchanged in Part 1).

### Deferred

- **`android.softwareKeyboardLayoutMode`** / **`windowSoftInputMode`** not changed here (would touch **`app.json`** outside the Part 1 file scope); add if Android keyboard overlaps the composer in QA.
