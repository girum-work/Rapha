# Current step

**As of:** 2026-05-03  

## Latest: Session 2 + 15 root layout

1. **`app/_layout.tsx`** — Restored Supabase-only auth gating: `getSession`, `onAuthStateChange` (with `TOKEN_REFRESHED` fast-path), profile row check on `profiles`, redirects to **`/sign-in`**, **`/onboarding`**, or **`/(drawer)/dashboard`**, teal **Rapha** loading overlay while auth/profile gate is resolving, root **`Stack`** for auth + drawer, and **`DrawerNotificationBridge`** for notification `data.url` deep links.
2. **`app/sign-in.tsx`** / **`app/sign-up.tsx`** — Added as minimal email/password routes (Expo Router file-based requirement; **`/sign-in`** was already referenced from **`onboarding.tsx`** but had no module).

## Quality

- **`npm run typecheck`** — passes (0 errors).

## Verify on device

- Run **`npx expo start --tunnel --clear`**: unauthenticated users should land on **`/sign-in`** after the teal gate clears; sign-up at **`/sign-up`**; after session + profile, **`/(drawer)/dashboard`**.

## Earlier work (reference)

- Edge functions (Groq triage, Overpass facilities, pharmacy match, Paddle OCR), `account.tsx` `signUp` fix, and `src/lib/supabase.ts` client shape remain as in prior steps.
