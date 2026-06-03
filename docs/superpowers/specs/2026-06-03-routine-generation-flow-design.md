# Routine Generation Flow + Editor — Design Spec (2 of 2)

**Date:** 2026-06-03
**Branch:** `feature/routine-generation-flow` (off `main`, which has the Spec 1 generation engine)

Spec 2 makes the Spec 1 engine usable: a reusable onboarding-style setup flow that replaces the native `window.confirm`/`window.prompt` dialogs, persistence of a generated routine, onboarding wiring, the routine-editor session grouping, and a template audit that retires `applyVolume`. Performance-based adaptation remains out of scope (later roadmap).

## 1. Goal

Let a user get a generated, session-appropriate routine from the onboarding answers (or a template) through one consistent stepped flow, with no native dialogs, and show multi-session routines grouped by session in the editor.

## 2. `RoutineSetupFlow` (reusable stepped flow)

New component `src/components/pulse/RoutineSetupFlow.tsx`, extracted from the existing `OnboardingModal` step UI (equipment, experience, goal, days/week, specific days, session length). Slate-styled, mobile + desktop.

```ts
interface RoutineSetupFlowProps {
    initial?: Partial<{ equipment: EquipmentKey[]; experience: ExperienceLevel; goal: Goal; days: DaysPerWeek; trainingDays: number[]; sessionTime: SessionTime }>;
    onComplete: (result: { answers: OnboardingAnswers; trainingDays: number[]; sessionTime: SessionTime }) => Promise<void>;
    onClose: () => void;
}
```

- It collects everything `generateRoutine` needs. Any value passed in `initial` is prefilled and its step can be confirmed quickly (or skipped if all needed values are prefilled).
- `OnboardingModal` is refactored to render `RoutineSetupFlow` for its first-run case, so there is one flow, not two.
- No `window.confirm`/`window.prompt` anywhere in the routine-creation path.

## 3. Persistence — server action

New `'use server'` action `generateAndSaveRoutine` in `src/app/pulse/actions.ts`:
- Input: `{ answers: OnboardingAnswers; trainingDays: number[]; sessionTime: SessionTime; name?: string }`.
- Loads the global exercise pool with its metadata (`id, category, equipment, movement_pattern, is_compound`) via `getUserOrThrow`'s client.
- Calls `generateRoutine({ answers, sessionTime, trainingDays, pool })` (pure, from `lib/pulse/generation.ts`).
- Inserts the `workout_routines` row, the `routine_exercises` from `blueprint.exercises`, and the `routine_schedule` from `blueprint.schedule` (same insert shape as `cloneTemplate`), and sets it active on the profile.
- Validates inputs (UUID/enum/day-range) and reuses the existing ownership helpers.
- Exposed through `PulseContext`/`useRoutines` as `generateRoutine(answers, trainingDays, sessionTime)` alongside `cloneTemplate`, with optimistic `mutate()`.

## 4. Entry points

- **Onboarding** (first run): completing `RoutineSetupFlow` calls `generateAndSaveRoutine` (replaces the current `recommendTemplate` -> `cloneTemplate` default). For `general_fitness` (which `recommendTemplate` returned null for), generation now produces a full-body routine instead of nothing.
- **Library → Templates "Use this"**: opens `RoutineSetupFlow` prefilled from the template's metadata (`required_equipment`, `experience_level`, `days_per_week`, `session_time`), then clones the template through the fixed volume model (section 6). No dialogs.
- **Library → "Generate a routine"**: a new button that opens `RoutineSetupFlow` blank (or prefilled from the user's last answers) and calls `generateAndSaveRoutine`.

## 5. Routine-editor session grouping (`RoutinesTab`)

Today the active routine's exercises render as one flat `sortedActiveExercises` list. Change it to **group by session**:
- Group the active routine's exercises by `(workout_type, variant)` in schedule order, each group rendered under a header (e.g. `Upper · A`, `Lower · B`, or just `Upper` when no variant).
- Collapse to a single ungrouped list only when every exercise shares one `(workout_type, variant)` (a single-session routine) — "unless the exercises are the exact same".
- The existing per-exercise controls (edit, move, remove, Pair/Unpair) stay within each group; reordering and pairing operate within the routine as before.

## 6. Template audit + retire `applyVolume`

- Replace `applyVolume` (the slice-to-4 / minus-one-set logic that caused the 30-min and Full Body Tone bugs) with the Spec 1 `volumeFor` model: `cloneTemplate` keeps the template's curated exercises but sets exercise count and sets from `volumeFor(sessionTime, experience)` with the floors (>=3 exercises, >=2 sets). The 30-min path can no longer collapse a routine to one exercise.
- Audit the 17 templates: confirm each clones to a sane routine across `~30 / 45–60 / 90+` and 2-3 / 4 / 5-6 days. Fix any template whose data is wrong (e.g. Full Body Tone), via data corrections in a small migration if needed.
- Remove `applyVolume` once `cloneTemplate` uses `volumeFor`.

## 7. Components / boundaries

- `RoutineSetupFlow.tsx` (presentational stepped flow) + refactored `OnboardingModal.tsx` (wraps it).
- `actions.ts`: `generateAndSaveRoutine` + refactored `cloneTemplate` (uses `volumeFor`, drops `applyVolume`).
- `useRoutines.ts` + `PulseContext.ts`: expose `generateRoutine`.
- `TemplatesTab.tsx`: "Use this" opens the flow (remove the `window.confirm`/`window.prompt`).
- `views/library/RoutinesTab.tsx`: session grouping.
- Optional small migration if any template data needs fixing.

## 8. Testing

- `generateAndSaveRoutine`: validation + that it persists the blueprint shape (mock the supabase client + the generation pool).
- `cloneTemplate` with the new volume model: a 30-min clone yields >=3 exercises (regression test for the reported bug).
- `RoutineSetupFlow`: stepping, prefill, completion payload; no `window.prompt` used.
- `RoutinesTab`: a multi-session routine renders grouped sections (Upper A/B, Lower A/B); a single-session routine renders one list.
- Keep the full suite green.

## 9. Out of scope

- Performance-based adaptation (later roadmap).
- Editing a generated routine's structure beyond the existing per-exercise editor.
- Variants beyond A/B (the two-distinct-versions cap from Spec 1 stands).

## Decisions made here (flag for review)
1. One `RoutineSetupFlow` reused by onboarding, "Use this", and "Generate"; prefill drives which steps need attention.
2. "Use this template" clones the curated template through the new volume model; "Generate" uses the pure engine. Both replace the dialogs.
3. `general_fitness` now generates (full body) instead of returning no template.
4. Editor groups by `(workout_type, variant)`, collapsing only for a true single-session routine.
