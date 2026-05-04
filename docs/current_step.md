# Current step

**As of:** 2026-05-04

## Status: Part 4 complete (UI rebuild final)

Parts 1–4 of the Rapha UI rebuild are implemented in-repo.

### Part 4 delivered

1. **`supabase/functions/dr-lucas`** — Proxies authenticated requests to **`chat-triage`**.
2. **`supabase/functions/chat-triage`** — Single **2s** retry before mock fallback when Groq streaming fails.
3. **`src/lib/sessionStore.ts`** — **`invoke('dr-lucas')`**, connection fallback + **`connectionFallback`** on messages.
4. **`app/sign-in.tsx`**, **`app/sign-up.tsx`**, **`app/verify-otp.tsx`**, **`app/onboarding.tsx`** — Auth and 3-step onboarding per spec.
5. **`app/_layout.tsx`** — **`verify-otp`** route, public auth gating, **`ToastProvider`**, **`ScreenErrorBoundary`**.
6. **`src/context/ToastContext.tsx`**, **`src/components/Skeleton.tsx`**, **`src/components/ScreenErrorBoundary.tsx`** — Global polish.
7. **Safe area** — Chat, dashboard, history, learn, services bottom padding via **`useSafeAreaInsets`**.
8. **`.cursorrules`** — Project rules for Cursor agents.

### Quality

- **`npm run typecheck`** — passes (0 errors).

### Deploy / ops (manual)

- Deploy **`dr-lucas`** (and updated **`chat-triage`**) to Supabase: e.g. **`supabase functions deploy dr-lucas`** / **`chat-triage`** with project linked.
- Confirm **`GROQ_API_KEY`** is set in Supabase secrets for live Dr Lucas replies.

### Remaining / follow-up (not blocking merge)

- Optional: persist onboarding profile photo to storage + **`profiles`** when a column and policy exist.
- Device QA: keyboard vs composer on low Android devices; full pass on Expo Go tunnel per checklist in Part 4 prompt.

### Earlier reference

- Parts 1–3: theme, drawer, chat, dashboard, history, settings, learn, accessories, services — see **`docs/decisions.md`**.
