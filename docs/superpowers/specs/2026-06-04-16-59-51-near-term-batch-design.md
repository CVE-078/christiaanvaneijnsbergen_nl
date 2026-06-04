# Near-term batch — design

Date: 2026-06-04
Status: Approved-by-directive (user asked to build all four near-term items autonomously; decisions made decisively, open to redirect)

Four near-term roadmap items, built on one branch (`feature/near-term-batch`), one workflow each, sequential, committed between. Order is driven by a real dependency: **Strength Score** needs biological sex + bodyweight for relative-strength standards, so **Gender** ships first.

Shared facts:
- Profile read path: `loadProfile` (`queries.ts`, `PROFILE_SELECT`) → GET `/api/pulse/profile` (try/catch → default) → `useProfile` SWR → `PulseProvider` → `usePulse()`.
- Mutations: `'use server'` actions in `src/app/pulse/actions/*` (re-exported from `src/app/pulse/actions`); optimistic `mutate(next,false)` then revalidate.
- Migrations are hand-written, dated `yyyy-mm-dd-hh-mm-ss`, applied to Supabase manually by the user. Code degrades gracefully if a column is missing (route falls back to default profile) but the user runs the migration first.

---

## 1. Gender in profile

**Goal:** Store the user's biological sex, show/edit it in Profile, collect it in onboarding, and use it to (a) feed the Strength Score and (b) lightly bias the recommended program style.

**Decisions:**
- Column name `sex` (not `gender`): it exists to drive strength standards and training bias, both keyed on biological sex. UI label "Sex".
- Values: `'male' | 'female' | null`. No third option in v1 (strength standards only define male/female; null = unset, fully supported).
- Bias is intentionally light in v1: it nudges the *recommended style pick* only. Deeper per-muscle/emphasis gender tuning is explicitly deferred to the Later "Muscle priority" item (the roadmap already says to fold those together).

**Changes:**
- **Migration** `docs/migrations/2026-06-04-16-59-51-add-sex-to-profiles.sql`:
  `alter table profiles add column if not exists sex text check (sex in ('male','female'));`
- **types.ts**: `export type Sex = 'male' | 'female';` add `sex: Sex | null` to `Profile`.
- **queries.ts**: add `sex` to `PROFILE_SELECT`; in `loadProfile` map `sex: data?.sex === 'male' || data?.sex === 'female' ? data.sex : null`.
- **api/pulse/profile/route.ts** default object: add `sex: null`.
- **actions/profile.ts**: new `updateSex(sex: Sex | null)` (validate in `['male','female',null]`), upsert `{ id, sex }` onConflict `id`, `revalidatePath('/pulse')`. Mirror `updateGoalWeight`. Re-export from `actions/index`.
- **useProfile.ts**: `DEFAULT_PROFILE.sex = null`; add optimistic `updateSex` (mutate `{...profile, sex}` false → await action → revalidate).
- **PulseProvider.tsx / PulseContext.ts**: expose `updateSex: (sex: Sex | null) => Promise<void>`.
- **ProfileView.tsx**: a "Sex" segmented toggle (Male / Female) beside the Weight Unit toggle; calls `updateSex`; success toast.
- **recommendation.ts**: add `sex?: Sex | null` to `OnboardingAnswers`.
- **OnboardingModal.tsx**: add one optional "Sex" step (mirror existing step markup/flow); store the choice; persist via `updateSex` on completion and include it in the `OnboardingAnswers` passed to `generateRoutine`.
- **generation.ts**: `recommendStyle(count, sex?)` — when `sex==='female'` and the count offers a style with more lower/glute focus, prefer it (4-day → `ul-aesthetic-4` over `ul-classic-4`; 3-day → `fb-emphasis-3`); otherwise unchanged. Keep the existing single-arg behavior as the default (sex undefined). Pure, unit-tested.

**Tests:** `loadProfile` maps sex; `updateSex` validation; `recommendStyle` female bias vs default; ProfileView toggle renders + calls action; OnboardingModal sex step.

---

## 2. Strength Score (0–100)

**Goal:** One legible 0–100 headline number from main-lift relative strength, with a level label and per-lift breakdown. Shown prominently on Progress.

**Decisions:**
- Standards are **bodyweight-multiple bands** per lift per sex, mapping ratio → 0–100 by piecewise-linear interpolation across levels: Untrained(0) → Novice(25) → Intermediate(50) → Advanced(75) → Elite(100). Clamp 0–100.
- Main lifts recognized by case-insensitive name match: **Bench Press**, **Squat**, **Deadlift**, **Overhead/Shoulder Press (OHP)**. Match the best-e1RM slot whose resolved exercise name contains the keyword.
- Overall score = rounded mean of the available lifts' sub-scores. Requires `sex` + a bodyweight entry + at least one main-lift PR; otherwise returns `null` with a `reason`.
- Bodyweight = latest `bodyweightLogs[0]` (kg).

**Changes:**
- **lib/pulse/strength.ts** (new): the bands table + pure functions.
  - `STRENGTH_STANDARDS: Record<Sex, Record<MainLift, number[]>>` — 5 ascending bodyweight-multiple thresholds per lift (untrained→elite). `MainLift = 'bench'|'squat'|'deadlift'|'ohp'`.
  - `classifyLift(name: string): MainLift | null` — keyword match.
  - `scoreRatio(ratio, thresholds): number` — piecewise-linear 0–100, clamped.
  - `computeStrengthScore({ sex, bodyweightKg, lifts }: { sex: Sex|null; bodyweightKg: number|null; lifts: Array<{name:string; e1rm:number}> }): StrengthScore`
    - `StrengthScore = { score: number|null; level: string|null; reason: string|null; lifts: Array<{ lift: MainLift; label: string; subScore: number; ratio: number }> }`.
    - level label from overall score using the same band boundaries.
- **types.ts**: export `StrengthScore` (and `MainLift`, `Sex` already added in feature 1).
- **components/pulse/StrengthScoreCard.tsx** (new): big number + level + per-lift mini-bars; when `score===null`, show the `reason` CTA (e.g., "Add your sex and log bodyweight + a main lift to see your strength score").
- **views/HistoryView.tsx**: build `lifts` from `prMap` + routine-exercise names (resolving swaps not needed — use slot's base exercise name via `nameMap`), call `computeStrengthScore`, render `StrengthScoreCard` as a headline near the top (next to / above the Recomp card).

**Tests:** `classifyLift` matches/ignores; `scoreRatio` endpoints + interpolation + clamp; `computeStrengthScore` null reasons (no sex / no bw / no lifts), averaging, level labels; card renders number and CTA states.

---

## 3. Recovery-aware volume nudges

**Goal:** Pair the shipped weekly per-muscle volume targets with RIR data to flag under-trained vs high-fatigue muscles.

**Decisions:** Per targeted muscle, combine weekly sets with the week's average RIR for that muscle:
- `under` — sets < min (room to add volume).
- `overreaching` — sets > max (above target ceiling).
- `high_fatigue` — sets ≥ min AND avgRir ≤ 0.5 (lots of near-failure work; watch recovery).
- `optimal` — within min..max and avgRir > 0.5.
- A muscle with 0 logged sets stays `under` (its existing "to go" already conveys this); no RIR → treat as not high_fatigue.

**Changes:**
- **utils.ts**: `computeRecoveryFlags(logs, routineExercises, week, targets): Partial<Record<ExerciseCategory, RecoveryStatus>>` plus a small map of avgRir per category (internal). Reuse the `computePerMuscleVolume` category-resolution pattern; accumulate sets and RIR sum per category in one pass.
  - `RecoveryStatus = 'under' | 'optimal' | 'high_fatigue' | 'overreaching'` (export from types.ts).
- **MuscleVolumeBars.tsx**: optional `recovery?: Partial<Record<ExerciseCategory, RecoveryStatus>>` prop. In target mode, render a small status chip per row (color-coded: under = dim "add volume", high_fatigue = accent "high fatigue", overreaching = "over target", optimal = muted "on track"). Keep existing layout/markup when `recovery` is absent (shipped behavior unchanged).
- **views/HistoryView.tsx**: compute `recovery` from the bundle's logs + active routine exercises and pass to the per-muscle `MuscleVolumeBars`.

**Tests:** `computeRecoveryFlags` for each status (under, optimal, high_fatigue at avgRir ≤ 0.5, overreaching > max); MuscleVolumeBars renders chips when `recovery` given and is unchanged when absent.

---

## 4. Rest-timer auto-advance (guided mode)

**Goal:** Hands-free progression in guided mode — when your last set's rest completes, auto-advance to the next exercise. Off by default, global toggle.

**Reality:** The rest timer is one shared component pinned in `AppShell` (mobile) and `DesktopLayout` (desktop), fired by `LogView.handleSave` via `fireTrigger`. The guided-mode `WorkoutModeScreen` is a `z-50` overlay that *covers* the pinned timer, so today the timer is invisible during guided workouts (and still firing behind it). Doing this right means showing a timer inside guided mode and not double-running.

**Decisions:**
- `autoAdvance` global toggle, `localStorage` key `pulse_autoadvance`, default `false`.
- Surface the toggle in Profile (a small "Guided mode" / "Auto-advance rest" setting).
- Render a visible `RestTimer` inside the `WorkoutModeScreen` footer; suppress the global pinned timer while guided mode is open so only one timer runs (no double beep).
- Auto-advance fires only when: `autoAdvance` is on, it's not the last step, **and** the current step is fully logged (single: all sets saved; pair: both exercises fully saved). Otherwise the completed timer just resets as today.

**Changes:**
- **RestTimer.tsx**: add optional `onComplete?: () => void`, called once when the countdown transitions to done (inside the existing `remaining === 0` branch, before the 2s clear). Existing beep/behavior unchanged.
- **useUIState.ts**: add `autoAdvance`/`setAutoAdvance` (`useLocalStorage<boolean>('pulse_autoadvance', false)`) and `workoutModeOpen`/`setWorkoutModeOpen` (`useState(false)`).
- **PulseProvider.tsx / PulseContext.ts**: expose `autoAdvance`, `setAutoAdvance`, `workoutModeOpen`, `setWorkoutModeOpen`.
- **LogView.tsx**: drive `workoutModeOpen` through context instead of (or mirrored from) local state — set true on `handleStartWorkout`, false on close/complete.
- **AppShell.tsx + DesktopLayout.tsx**: render the global `RestTimer` only when `!workoutModeOpen`.
- **WorkoutModeScreen.tsx**: render `<RestTimer trigger={timerTrigger} duration={timerDuration ?? undefined} onComplete={handleRestComplete} />` in the footer; `handleRestComplete` advances `stepIdx` when the conditions above hold. Pull `autoAdvance`, `timerTrigger`, `timerDuration` from context. Compute `stepComplete` from saved sets.
- **ProfileView.tsx**: an "Auto-advance rest timer" toggle bound to `autoAdvance`/`setAutoAdvance`.

**Tests:** `RestTimer` calls `onComplete` at 0 (fake timers); auto-advance advances only when on + not last + step complete; global timer hidden when `workoutModeOpen`.

---

## Out of scope (all four)
- Goal-based volume targets, gender-specific emphasis/volume tuning (→ Muscle priority, Later).
- Strength-score history/trend over time (v1 is the current snapshot).
- Auto-advance in the non-guided train list (no linear current-exercise there).
- A third sex option / detailed gender identity (strength standards are male/female).
