# FitPilot

A React Native (Expo) fitness app built as a **research instrument**: it compares
an **AI-driven** experience against a **non-AI control** to measure whether AI
nudging improves workout-schedule adherence.

- **Auth + data:** Supabase (email/password + Google OAuth, persisted session).
- **Group assignment:** on first login, a Supabase RPC assigns each user to the
  smaller study arm (`ai` / `non_ai`) so the groups stay balanced.
- **AI (on-device, offline):** a bundled Qwen2.5-0.5B GGUF runs via `llama.rn`.
  The `ai` arm gets model-written notification nudges + post-workout
  encouragement. No API, no tokens, works offline.
- **Measurement:** exercise-timer outcomes (`completed` / `partial` / `skipped`
  + minutes) are logged to Supabase. An end-of-trial questionnaire comes later.

---

## 1. Configure Supabase

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   This creates `profiles`, `adherence_logs`, RLS policies, the balanced
   `assign_group_and_create_profile()` RPC, and an `adherence_summary` view.
3. **Auth → Providers → Google:** enable it with your Google OAuth client
   id/secret.
4. **Auth → URL Configuration → Redirect URLs:** add `fitpilot://auth-callback`.
5. Put your keys in [`src/config.ts`](src/config.ts):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Project Settings → API)
   - `GOOGLE_WEB_CLIENT_ID` (optional; enables the Google button)

## 2. Add the on-device model (optional but required for AI features)

The app runs without the model (AI text falls back to sensible defaults), but to
enable the real on-device LLM:

1. Download **Qwen2.5-0.5B-Instruct** in GGUF Q4_K_M format and save it to:
   `models/qwen2.5-0.5b-instruct-q4_k_m.gguf`
   (e.g. from the Qwen GGUF repo on Hugging Face).
2. Split it into bundle-safe chunks:
   ```
   npm run split-model
   ```
   This writes `assets/model/chunk-*.bin`, `manifest.json`, and `chunks.ts`.
   Metro bundles the chunks; the app reassembles the `.gguf` into app storage on
   first launch (Android caps a single asset ~200MB, hence the split).

## 3. Run in development

```
npm install
npx expo run:android      # builds + installs a dev client on device/emulator
```

## 4. Build a release APK

Prereqs on this machine (already present): Android SDK at `C:\Android\Sdk`
(build-tools 34, platforms 31–35, NDK 26/27, cmake), Java 17.

```
npx expo prebuild --platform android      # regenerates android/ if needed
cd android
./gradlew assembleRelease
```

The APK lands at:
`android/app/build/outputs/apk/release/app-release.apk`

> Note: a release build must be signed. For a study/sideload build you can use a
> debug-signed release or generate a keystore; see Expo/RN docs on signing.

## Study analysis

When the trial ends, query in the Supabase SQL editor:

```sql
select * from adherence_summary;          -- completion rate per arm
select * from adherence_logs order by logged_at;  -- raw events
```

## Project layout

```
src/
  config.ts            Supabase/Google keys + model filename
  theme.ts             design tokens (dark, lime accent)
  types.ts             domain types (Goal, Outcome, AdherenceLog, ...)
  navigation.tsx       auth -> consent -> goal -> main tabs
  context/AuthContext  session + profile + group assignment
  lib/
    supabase.ts        client (AsyncStorage-persisted session)
    google.ts          Google OAuth via in-app browser
    db.ts              profile/goal/consent + adherence logging
    templates.ts       goal -> loose weekly workout template
    notifications.ts   weekly reminders (AI nudge vs plain)
  ai/
    model.ts           chunk reassembly (first-launch, offline)
    llm.ts             llama.rn context wrapper
    brain.ts           nudge + encouragement (with fallbacks)
  screens/             Auth, Consent, Goal, Home, Exercise, Profile
scripts/split-model.mjs  build-time GGUF chunker
supabase/schema.sql      database schema + RPC + analysis view
```
