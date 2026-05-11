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
6. **Navigator:** **`Stack`** lists **`sign-in`**, **`sign-up`**, **`verify-otp`**, **`onboarding`**, and **`(drawer)`**. Public routes without a session: **`sign-in`**, **`sign-up`**, **`verify-otp`**. **`/onboarding`** without a session redirects to **`sign-in`**.

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
- **Wiring (updated audit 2026-05-04):** **`sendChatMessage`** calls **`supabase.functions.invoke('chat-triage', …)`** directly (no proxy). On invoke/parse failure the client shows a neutral retry message (not mock clinical triage) and flags **`connectionFallback`** on the assistant message. Each exchange **`upsert`s `chat_sessions`** and **`insert`s two `chat_messages`** rows when the user is signed in and the session id is a UUID.

### Drawer (`app/(drawer)/_layout.tsx`)

- **Custom drawer content** loads **`profiles.display_name`** and auth email on mount (read-only Supabase client import; no changes under **`src/lib/`**).
- **Chrome:** Drawer background **`primary`** (`#0A1628`); active item **`primaryMid`** + **3px `accent`** left border; inactive icons **`textTertiary`**; active icons **`accent`**; labels white, active label bold.
- **Route order:** index (Dr Lucas) → dashboard → history → learn → accessories → services (Care Options) → settings (Account removed from drawer in Part 2 — see Part 2 decisions). Emoji suffixes on labels per spec (e.g. Dr Lucas 💬, Dashboard 📊).
- **Footer:** “Rapha v1.0” / “Ethiopia · MVP” in **`#475569`**.
- **`DrawerNotificationBridge`** remains in **`app/_layout.tsx`** (unchanged in Part 1).

### Deferred

- **`android.softwareKeyboardLayoutMode`** / **`windowSoftInputMode`** not changed here (would touch **`app.json`** outside the Part 1 file scope); add if Android keyboard overlaps the composer in QA.

---

## 2026-05-04 — Part 2 UI rebuild (dashboard, history, settings)

### Dashboard (`app/(drawer)/dashboard.tsx`)

- **Shell:** `ScrollView` on **`#F8FAFC`** (`colors.background`), **`SafeAreaView`** top only.
- **Hero:** Navy **`#0A1628`** with rounded bottom corners; greeting uses **`display_name`** from **`profiles`** (or email local-part); notification bell with teal dot when **remote `chat_sessions.status === 'active'`** or local **`getOrCreateSession()`** is active/deferred.
- **Health card:** Last severity from most recent of the **top 3** sessions returned (same query); pulse animation on gradient orb when a session is active (remote or local).
- **Quick actions:** New Chat → **`/(drawer)/`**; Pharmacy / Find Care → **`/services`** with **`action`** **`pharmacy`** / **`hospital`**.
- **Active card:** Shown when Supabase returns an **`active`** row; preview from first user message in nested **`chat_messages`**.
- **Metrics:** Blood type, **`current_medications`**, **`allergies`**, emergency name — counts / “Not set” from **`profiles`**; all rows navigate to **`/settings`**.
- **Recent sessions:** Last **3** **`chat_sessions`** for **`auth.uid()`**, nested **`chat_messages`**, “See all” → **`/history`**. Session rows tap → **`/history`** (not per-session detail).
- **Daily tip:** **`expo-linear-gradient`** card; copy rotates by weekday (Monday-indexed array).
- **Data:** Requires Supabase for remote sessions/profile; without config, metrics empty and recent list shows empty state.

### History (`app/(drawer)/history.tsx`)

- Grouping: **Today / Yesterday / This week / Earlier** with **`LayoutAnimation`** on expand.
- Rows expand inline (last **6** messages, teal user / white assistant bubbles); **Resume** / **View full** → **`/(drawer)/`** (no session-id routing yet).
- Search filters title/subtitle text.
- **Fetch:** All user **`chat_sessions`** with **`chat_messages(id, content, role, created_at)`** ordered by **`started_at`** desc.

### Settings / Account (`app/(drawer)/settings.tsx`, `account.tsx`)

- **Single settings hub:** Medical profile ( **`display_name`**, **`age`**, **`blood_type`**, **`allergies`**, **`current_medications`**, **`chronic_conditions`**, emergency name/phone ), **`location_consent`** on **`profiles`** with **500ms debounced** **`update()`**.
- **Push notifications** and **fall detection** persist via **`AsyncStorage`** (**`rapha.pref.*`**) — not **`profiles`** columns (schema does not include them).
- **Change password:** **`supabase.auth.updateUser({ password })`** in a modal.
- **Privacy / Terms:** external **`Linking.openURL`** (placeholder WHO URLs).
- **Sign out:** **`supabase.auth.signOut()`** → **`router.replace('/sign-in')`**.
- **`app/(drawer)/account.tsx`** is **`Redirect`** to **`/settings`**; **Account** removed from drawer list (**`ROUTE_META`** / filter **`account`**). Deep link **`/account`** still resolves to redirect.

### Drawer (`app/(drawer)/_layout.tsx`)

- Nav order ends at **Settings** (no Account row); **`account`** route filtered out of custom drawer content.

---

## 2026-05-04 — Part 3 UI rebuild (Learn, Accessories, Care Options)

### Learn (`app/(drawer)/learn.tsx`, `lesson.tsx`, `src/data/learnCurriculum.ts`)

- **Health Academy** navy hero, progress from **`AsyncStorage`** keys **`lesson_complete_{lessonId}`** vs total lessons across **5 tracks** (Emergency First Aid, Infectious, Medications, Maternal & Child, Mental Wellbeing).
- **Tracks:** horizontal cards with per-track color, lesson count, mini progress; selecting a track filters the lesson list below.
- **Sequential unlock:** a lesson stays **locked** until all prior lessons in that track are marked complete.
- **Featured card:** gradient **`primary` → `primaryMid`**; **Continue / Start** opens **`/lesson`**. Completion refreshes on focus via **`useFocusEffect`**.
- **`app/(drawer)/lesson.tsx`:** Scroll-based read progress bar; sections (hero, key facts, body, steps, warnings, related accessories → **`/accessories`**); one embedded quiz from **`CURRICULUM_QUIZZES`**; sticky **Mark complete** writes **`lesson_complete_*`**.
- **Daily challenge:** **`LearnDailyQuizModal`** — bottom sheet animation, 5 questions from **`DAILY_CHALLENGE_IDS`**, results + review reset.
- **Quiz data:** **`CURRICULUM_QUIZZES`** in **`learnCurriculum.ts`**; **`QuizQuestion`** gains optional **`explanation`** (`src/types.ts`). Legacy **`src/data/learn.ts`** unchanged for older imports.

### Accessories / wearables (`app/(drawer)/accessories.tsx`)

- **Positioning:** connected-device UX (demo **Connect** toggles local state), manual vitals form, **`AsyncStorage`** **`rapha.vitals.entries`**, simplified **NEWS-style** aggregate score (not clinical NEWS2), **Share with Dr Lucas** / **Talk to Dr Lucas** → **`/`** with **`prefill`** query for chat composer.
- **Fall detection:** same **`AsyncStorage`** key as Settings (**`rapha.pref.fallDetection`**).

### Care Options (`app/(drawer)/services.tsx`)

- **Context header** colors by **`action`**: **`emergency`** red, **`hospital`** / **`clinic`** amber, **`pharmacy`** green, default navy; optional **`conditionName`** param for subtitles.
- **Facilities:** **`rankFacilities`** / filters from seeded **`facilities`**; cards with recommended banner, tags, call / maps (**`Linking`**), emergency-only **Request ambulance** + transport section (modals).
- **Map:** Compact **`react-native-maps`** preview with user + facility markers (tap alerts for full map — Part 4 hook).
- **Pharmacy:** **`matchPharmacies`**, drug chips, prescription image picker, stock lines per pharmacy.

### Root chat (`app/(drawer)/index.tsx`)

- **`prefill`** search param seeds the composer when navigating from Accessories.

### Drawer (`app/(drawer)/_layout.tsx`)

- **`lesson`** screen registered (**`headerShown: false`**); hidden from custom drawer list alongside **`account`**.

---

## 2026-05-04 — Part 4 (final): Dr Lucas wiring, auth, polish, rules

### AI provider and resilience

- **Groq** remains the model path inside **`supabase/functions/chat-triage`** (see Step 5). **`GROQ_API_KEY`** must be set on the Supabase project for live replies; if missing or the upstream call fails, the function still returns deterministic structured fallback after **one automatic retry** (2s delay) on streaming failure.
- **Client (`src/lib/sessionStore.ts`)**: invokes **`chat-triage`** with **`message`**, **`session_id`**, and **`messages`**. Persists the active session to **`AsyncStorage`** and mirrors each user/assistant pair to **`chat_sessions` / `chat_messages`** when authenticated. On error or malformed JSON, uses **`triageConnectionFallback()`** (neutral retry copy + **`connectionError`**), not **`makeMockTriage`**.

### Auth UI and flow

- **`app/sign-in.tsx`** / **`app/sign-up.tsx`**: navy/teal Rapha shell (logo circle + stethoscope), labeled fields, navy primary CTA, outlined secondary, inline errors (no “Supabase” wording).
- **`app/verify-otp.tsx`**: six-digit OTP entry after email signup when no session is returned; **`verifyOtp`** type **`signup`**; resend via **`auth.resend`**. Success → **`/onboarding`**.
- **`app/onboarding.tsx`**: three-step wizard (dots), optional profile photo (local image only; not persisted to **`profiles`** in this pass), required name/age/blood type, tag-style allergies/meds/conditions, emergency contact + Ethiopian **`09XXXXXXXX`** phone, location consent; **`saveOnboardingProfile`** then **`/(drawer)/dashboard`**. Toasts via **`ToastProvider`**.

### Global polish

- **`useSafeAreaInsets`**: applied to bottom **`contentContainerStyle`** / composer padding on chat, dashboard, history, learn, services; auth screens use insets on scroll roots.
- **Loading:** **`Skeleton`** component used on dashboard and history loading states.
- **Errors:** root **`ScreenErrorBoundary`** wraps the stack; auth/onboarding screens also wrap locally.
- **Toasts:** **`src/context/ToastContext.tsx`** + **`useToast`**; **`ToastProvider`** in **`app/_layout.tsx`** (overlay slide-in, auto-dismiss).

### Theme additions

- **`typography`**: **`authBrand`**, **`authTagline`**, **`authWelcome`**, **`authLead`**, **`authCta`**, **`authSecondaryCta`**, **`otpDigit`** for auth/OTP screens (avoid ad-hoc font sizes in those files).

### Product copy cleanup

- Services default location label **Addis Ababa, Ethiopia**; ambulance/transport alerts and location help text avoid “MVP” / internal jargon. Accessories fall status and map hint rephrased. Settings location hint describes default city when consent is off.

### Cursor rules

- **`.cursorrules`** at repo root encodes identity, design tokens, architecture (including **`chat-triage`** invoke), file layout, user-visible copy rules, and typecheck expectations.

---

## 2026-05-05 — Typography, auth polish, animation / wearables scaffolds, packages

### Typography (`src/theme.ts`, `app/_layout.tsx`)

- **Inter** loads **`Inter_700Bold`**; sans tokens: **`fonts.body`** = **`Inter_500Medium`** (default reading weight), **`fonts.bodyRegular`** = **`Inter_400Regular`** (fine print where needed), **`fonts.bodyBold`** = **`Inter_700Bold`**.
- **`typography`** headings and auth tokens use **`500`/`600`** instead of **`400`** so combined with font families copy reads heavier.

### Sign-up (`app/sign-up.tsx`)

- Removed **“or” divider** and **“Sign in instead”** from create-account so onboarding is signup-only there; **`sign-in`** still links to signup as needed.

### Onboarding photo (`app/onboarding.tsx`)

- **“Add photo (optional)”** sits **below** the dashed avatar circle (icon-only inside circle) so text is not cramped or mis-centered in the circle.

### Animation scaffold (`src/lib/animations.ts`)

- Shared **`react-native-reanimated`** helpers: **`timings`**, **`useFadeIn`**, **`usePressAnimation`**, **`usePulseGlow`**, **`useSlideUp`** (uses **`withDelay`** for fade delay; no `setTimeout` in product paths).

### Wearables scaffold (`src/lib/wearables.ts`)

- **`getLatestVitals`**, **`isWearableConnected`** return **`null` / false** until HealthKit / Health Connect is wired in a dev client.

### Packages

- **`lottie-react-native`** (Expo-aligned) and **`@shopify/react-native-skia`** added for planned Lottie / Skia UI work. **`babel.config.js`** already lists **`react-native-reanimated/plugin`**. Many other libs from the polish prompt (**`expo-blur`**, **`expo-linear-gradient`**, **`react-native-tab-view`**, **`react-native-pager-view`**, **`react-native-svg`**, Reanimated, Gesture Handler) were already present.

### Deferred from “production polish” mega-prompt

- **Bottom tab bar replacing the drawer**, full **dark ChatGPT-style** chat shell (**`#0A0F1C`**), **TabView** scene transitions, **focus glow** on composer, and **drawer only for History/Settings** — not migrated in this pass (large navigation + screen rewrite; **patient app remains `(drawer)`**).
- **Ambulance side**: **`app/(ambulance)/*`**, service key on **sign-in**, and related Supabase tables already exist in-repo; full spec (OSRM polyline, richer duty flow, push overlays) can extend incrementally.
- **Stack `animation: 'fade_from_bottom'`** globally was not applied to avoid surprising transitions on every screen; can be tuned per-route later.

---

## 2026-05-05 — Part 1 UI rebuild (theme + home chat + drawer)

### Theme tokens (`src/theme.ts`)

- Restored the product palette to the requested Part 1 baseline:
  - `primary` `#0A1628`, `primaryMid` `#1B3A6B`
  - `accent` `#00C2A8` + matching light/dark variants
  - `background` `#F8FAFC`, `surface` `#FFFFFF`, subtle slate borders/text
- Kept legacy alias keys for backwards compatibility with unchanged screens.

### Drawer (`app/(drawer)/_layout.tsx`)

- Removed the overlaid bottom tab bar implementation that was blocking chat input access.
- Rebuilt custom drawer content (navy background, profile block, divider, active route highlight, footer badge).
- Kept drawer routing and screen registration intact; `drawerType: 'slide'`.
- Nav labels use the requested emoji suffixes for the listed sections.

### Home chat (`app/(drawer)/index.tsx`)

- Header now follows Part 1 structure: left title + subtitle, right camera + overflow actions.
- Composer row reverted to classic attach/input/send layout with safe bottom padding (`34` iOS / `16` Android).
- Restored static centered disclaimer line above composer.
- Kept existing chat/session/triage wiring logic (no backend flow changes).

---

## 2026-05-08 — Part 2 UI rebuild (dashboard, history, settings)

### Dashboard (`app/(drawer)/dashboard.tsx`)

- Refined severity badge + session severity pills to match the Part 2 spec (critical/red, urgent/amber, mild/teal).
- Bell notification dot uses `colors.accent` (teal) for “active session” state.

### History (`app/(drawer)/history.tsx`)

- Kept grouped sections and inline expand thread; styles are aligned to the Part 2 spacing/border tokens.

### Settings (`app/(drawer)/settings.tsx`)

- Settings header now uses `colors.primary` navy with teal avatar circle and “Edit Profile” button styling per spec.
- Sign-out button uses a light red border (`#FEE2E2`) with red text.
