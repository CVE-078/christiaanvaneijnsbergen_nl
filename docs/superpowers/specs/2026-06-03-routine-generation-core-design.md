# Routine Generation Core — Design Spec (1 of 2)

**Date:** 2026-06-03
**Branch:** `feature/routine-generation-core` (off `main`)

This is spec 1 of 2 for dynamic routine generation. It builds the foundation: per-exercise metadata, a pure generation engine, and a volume model. **Spec 2** covers the user-facing setup flow (replacing the `window.confirm`/`window.prompt` dialogs), onboarding wiring, the template audit/fix, and the routine-editor session grouping. **Performance-based adaptation is out of scope** (later roadmap).

## 1. Goal

Generate a balanced, equipment-aware, session-appropriate workout routine purely from the onboarding answers, deterministically and offline. This replaces the blunt "clone a fixed template then trim with `applyVolume`" approach that produced the 30-minute / Full Body Tone bug (one exercise per day).

Chosen approach: **rule-based deterministic generator** + rich exercise metadata. No LLM (that is a later roadmap item). Deterministic so it is fully unit-testable and has no per-call cost.

## 2. Exercise metadata

The generator needs more than the current `category`. Add nullable columns to the `exercises` table (only global exercises, `user_id IS NULL`, need them):

```sql
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern text;        -- slot, see enum below
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_compound boolean NOT NULL DEFAULT false;
```

- **equipment**: subset of `dumbbells | barbell | bench | cables | machines | bodyweight`. Used to honor the onboarding equipment answer.
- **movement_pattern** (the "slot"), an enum used for balanced selection + variation:
  `horizontal_push | vertical_push | horizontal_pull | vertical_pull | squat | hinge | lunge | calf | core | chest_iso | back_iso | shoulder_iso | biceps_iso | triceps_iso | glute_iso`.
- **is_compound**: compounds are picked first per session.
- **primary muscle**: reuse the existing `category` (and `exercise_instructions.primary_muscles` once available); no new column.

**Seeding (hybrid, per the agreed approach):** a migration `2026-06-03-exercise-generation-metadata.sql` derives these for global exercises:
- equipment from the name prefix (`Dumbbell …` → dumbbells, `Barbell …` → barbell+bench where relevant, `Cable …` → cables, `Machine/Lever …` → machines, else bodyweight). Names are explicit after the dumbbell rename.
- movement_pattern + is_compound from category + name keywords (e.g. "Bench Press" → horizontal_push compound; "Row" → horizontal_pull compound; "Lateral Raise" → shoulder_iso isolation; "Curl" → biceps_iso; "Squat"/"Lunge"/"Deadlift" → squat/lunge/hinge).
- The migration ends with explicit `UPDATE … WHERE name = '…'` overrides for any exercise the heuristic gets wrong. The heuristic + override list is authored as part of implementation and reviewed for accuracy.

TypeScript (`src/lib/pulse/types.ts`): extend `DbExercise` with `equipment: EquipmentKey[]`, `movement_pattern: MovementPattern | null`, `is_compound: boolean`; add the `MovementPattern` union and a `BODYWEIGHT` addition to `EquipmentKey` if needed.

## 3. Generation engine (pure)

New file `src/lib/pulse/generation.ts`:

```ts
interface GenerationInput {
    equipment: Set<EquipmentKey>;
    experience: ExperienceLevel;          // beginner | intermediate | advanced
    goal: Goal;                            // strength | hypertrophy | tone | endurance
    daysPerWeek: number;                   // 1..6
    sessionTime: SessionTime;              // '~30 min' | '45–60 min' | '90+ min'
    trainingDays: number[];                // chosen day-of-week numbers
    pool: ExerciseMeta[];                  // global exercises with metadata
}

interface RoutineBlueprint {
    schedule: Array<{ day_of_week: number; workout_type: WorkoutType; variant: WorkoutVariant | null }>;
    exercises: Array<{
        exercise_id: string;
        workout_type: WorkoutType;
        variant: WorkoutVariant | null;
        order: number;
        sets: string;
        reps: string;
    }>;
}

export function generateRoutine(input: GenerationInput): RoutineBlueprint;
```

Algorithm (deterministic — no `Math.random`; any rotation is index-based):

1. **Split selection** from `daysPerWeek` (+ experience): 1–3 → full body; 4 → upper / lower; 5 → push / pull / legs / upper / lower; 6 → push / pull / legs ×2. Produces an ordered list of session focuses, each mapped to a `workout_type`, with **A/B/… variants assigned when the same focus repeats** (so 3× full body is `full_body` A, B, C — distinguishable in the editor and train tabs).
2. **Volume targets** from a table keyed by `sessionTime × experience` → `{ exercisesPerDay, setsPerExercise }`, with `goal` setting the rep range (strength 4–6, hypertrophy 8–12, tone 10–15, endurance 15–20). **Floors enforced**: never fewer than 3 exercises or 2 sets. (~30 min ≈ 3–4 ex × 2–3 sets, 45–60 ≈ 5–6, 90+ ≈ 7–8.)
3. **Per-session exercise selection**: from `pool` filtered to exercises whose `equipment` is satisfied by the user's set, matching the focus's target movement slots; compounds first, then isolation, filling `exercisesPerDay` while covering the focus's major slots (e.g. a full-body day wants a squat/hinge, a push, a pull, plus accessories).
4. **Variation across repeated focuses**: when a focus repeats (3× full body), rotate the candidate pool per occurrence (by index) so each session selects different exercises per slot. Each occurrence carries its A/B/C variant.

Edge handling: thin equipment pool → fall back to fewer exercises but never empty and never below the floor; no duplicate exercise within one session; if a slot has no candidate, skip it and backfill from the next-best slot.

## 4. Volume model

The `sessionTime × experience` volume table lives in `generation.ts` (exported) and is the single source of truth. It supersedes `applyVolume` in `actions.ts` (the actual removal of `applyVolume` and rewiring `cloneTemplate` happens in Spec 2's template audit, but the table is defined here).

## 5. Components / boundaries

- `src/lib/pulse/generation.ts` — pure `generateRoutine`, the volume table, the split table, and helpers. No I/O, no React, no Supabase. Fully unit-testable.
- Types in `src/lib/pulse/types.ts`.
- Migration `docs/migrations/2026-06-03-exercise-generation-metadata.sql` (columns + heuristic seed + overrides).
- **No** server action, UI, or persistence in this spec — that is Spec 2. This spec ends with a tested pure engine and the seeded metadata.

## 6. Testing

Unit tests for `generateRoutine` (`src/lib/pulse/__tests__/generation.test.ts`):
- 30-min floor: returns ≥3 exercises × ≥2 sets per day, never empty, never 1 (the reported bug).
- 3× full body: the three sessions are not identical (variation), each tagged variant A/B/C.
- Equipment filtering: dumbbells-only input excludes barbell/cable/machine exercises.
- Split mapping: 3 → full body, 4 → upper/lower, 5–6 → PPL shapes.
- Goal → rep ranges; experience → volume scaling.
- No duplicate exercise within a session.
- Thin pool: graceful fallback, still respects the floor.

## 7. Out of scope

- The setup-flow UI and replacing the template dialogs (Spec 2).
- Onboarding wiring to call the generator (Spec 2).
- Template audit/fix and `applyVolume` removal at call sites (Spec 2).
- Routine-editor session grouping (Spec 2).
- Performance-based adaptation (later roadmap).
