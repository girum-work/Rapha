# Current step

**As of:** 2026-05-04  

## Latest: Part 2 — Dashboard, History, Settings

1. **`app/(drawer)/dashboard.tsx`** — Navy hero, health status + pulse orb, overlapping quick-action card, optional active consultation card, health metric grid ( **`profiles`** ), recent **`chat_sessions`** (nested messages), weekday daily tip with **`expo-linear-gradient`**.
2. **`app/(drawer)/history.tsx`** — Search, date grouping, expandable rows with last 6 messages, status badges, Resume / View full to chat.
3. **`app/(drawer)/settings.tsx`** — Unified profile + preferences + account actions; debounced Supabase **`profiles`** updates; toggles for push/fall via **`AsyncStorage`**; sign-out.
4. **`app/(drawer)/account.tsx`** — Redirect to **`/settings`**.
5. **`app/(drawer)/_layout.tsx`** — Drawer list no longer shows Account (**`account`** route hidden from custom drawer).

## Quality

- **`npm run typecheck`** — passes (0 errors).

## Verify on device

- Dashboard loads profile and session lists when Supabase is configured; History lists and expands sessions; Settings edits persist; drawer shows Settings only (no duplicate Account).

## Earlier work (reference)

- Part 1 tokens, home chat, drawer chrome; root auth and **`sessionStore`** local chat unchanged here.
