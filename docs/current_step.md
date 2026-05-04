# Current step

**As of:** 2026-05-04  

## Latest: Part 1 — Home chat UI + drawer redesign

1. **`src/theme.ts`** — New navy / teal token system (`primary`, `accent`, severity, chat bubble colors, typography scale). Legacy keys (`canvas`, `ink`, `fonts`, etc.) kept so existing routes and root layout keep compiling.
2. **`src/components/ui.tsx`** — Primary buttons use **`accent`** (teal); text colors align with **`textPrimary`** / **`textSecondary`**.
3. **`app/(drawer)/index.tsx`** — Chat-style home: custom header (Dr Lucas + camera / overflow → drawer), empty state + suggestion chips, user / Dr Lucas bubbles, animated typing row while sending, triage action cards by **`action`**, disclaimer, composer with attach + **`KeyboardAvoidingView`**. Triage card clears when a new message is sent, then returns from the latest structured response. Profile **`display_name`** (or email prefix) for greeting via Supabase read only in this screen.
4. **`app/(drawer)/_layout.tsx`** — Custom **`DrawerContentScrollView`**: navy drawer, profile block, ordered nav with active teal left border + **`primaryMid`** fill, footer version string, **`drawerType: 'slide'`**, **`index`** **`headerShown: false`**.

## Quality

- **`npm run typecheck`** — passes (0 errors).

## Verify on device

- Run **`npx expo start --tunnel --clear`**: open **Dr Lucas** home — empty state, chips, send flow, bubbles, triage cards; open drawer — navy chrome, nav states, profile. Optional follow-up: set Android **`softwareKeyboardLayoutMode`** in **`app.json`** if the keyboard overlaps the composer on some devices.

## Earlier work (reference)

- Root auth gating, sign-in/sign-up routes, edge functions, and `src/lib/*` unchanged in this step.
