# Routine generation engine — architecture audit & v2 direction (2026-06-06)

A code-grounded audit of Pulse's routine-generation engine, prompted by two external product reviews (ChatGPT). Both reviews and the audit converged on the same conclusion:

> **The generator is already well-architected and should not be rewritten. The next bottleneck is data richness, not the algorithm. Strengthen the data model (muscle attribution, exercise metadata, session-linked logging), then add style / restriction / variety preferences. Save volume-first generation for when ranked specialization genuinely demands it.**

This doc records how the engine works today, the real limitations, a per-input feasibility table, and the phased plan.

## How exercises are selected today

The pipeline is the layered model both reviews proposed:

```
onboarding profile
  → training archetype (STYLES, keyed by training-day count)
  → movement-pattern slots (EMPHASES: { bias, slots })
  → equipment-filtered exercise selection (slot filler + routine-wide avoid-set)
  → progression rules (periodization + double progression)
```

- A `ProgramStyle` is an ordered list of sessions, each `{ focus, emphasis, variant }`. The emphasis resolves to `{ bias, slots }` where `slots` is an ordered list of `MovementPattern` (compounds first).
- `byPattern(p)` returns usable exercises matching the pattern, sorted by `id.localeCompare` (deterministic).
- `pick(slot)` prefers a candidate not used anywhere in the routine (`fresh ?? candidates[0]`), adds it to the routine-wide avoid-set `used`. One pass per slot, then a bounded backfill loop (`guard < 50`).
- `tiltEmphasis(emphasis, priority)` front-loads the priority muscle's patterns when already present in the session, giving more picks and earlier backfill.
- Fully deterministic, no RNG in selection (the only `randomUUID` is for superset group ids).

## How volume is allocated today

This is the single most important finding.

- Volume is a static lookup: `VOLUME[sessionTime][experience] = { exercises, sets }`, floored at 3 exercises / 3 sets in generation. Every exercise in a session gets the same set count, except the first compound on a strength-bias session gets +1.
- **`VOLUME_TARGETS`, `priorityAdjustedTargets`, `computePerMuscleVolume` are never imported by the generation pipeline.** They feed only the Progress / recovery analytics, after the fact. (Verified by grep: zero hits in `generation.ts`, `actions/routines.ts`, `recommendation.ts`.)
- Generation speaks 15 `MovementPattern`s; the analytics speak 10 `ExerciseCategory`s. **There is no bridge between them.** Weekly per-muscle volume is purely emergent: (slots per session) × (how often the style trains each pattern) × (base sets).

So today: split → exercises → volume emerges (slot-first). A volume-first model (target → allocate → select) would invert this.

## The two real data-model limitations

**1. Exercise metadata is lean.** The generator sees only `(category, movement_pattern, is_compound, equipment)` via `ExerciseMeta`. Per-exercise muscle data lives in `exercise_instructions` (`primary_muscles`, `secondary_muscles`, `cues`) but is **display-only, not read by generation, and incomplete** (seeded by name match with `ON CONFLICT DO NOTHING`; several later-added exercises have no row). No `difficulty`, `unilateral`, `fatigue_cost`, or generation-driving rep hint. ~94 global exercises; `movement_pattern` / `equipment` / `is_compound` are fully populated by design; equipment is the most carefully curated field. `vertical_pull` is intentionally empty for dumbbell-only users.

**2. Behavioral data captures outcomes, not in-the-moment changes.**

| Signal | Status |
|---|---|
| Completed sets (kg/reps/RIR/drops) | Stored (`set_logs`) |
| Exercise swaps | Stored (`exercise_swaps`) |
| Hidden / never-show | Stored (`user_exercise_preferences`) |
| Ramp-back accept/dismiss | Stored (`program_adjustments`) |
| Missed sessions | Derivable (`workout_sessions` + schedule + anchor) |
| Skipped exercises | Not an event; only the unreliable absence of set_logs |
| Added/removed mid-session | Conflated with permanent routine edits, no session trail |
| Plateau auto-deloads | Computed on the fly, never persisted |

Two concrete issues:

- **Bug (fixed 2026-06-06):** `exercise_swaps.week` was `CHECK BETWEEN 1 AND 12`, but the program now repeats to week 52, so swaps past week 12 silently failed. Raised to 52 to match `set_logs` (migration `2026-06-06-00-30-19-exercise-swaps-week-cap-52.sql` + `setExerciseSwap`/`clearExerciseSwap` validation).
- **Gap:** `set_logs` has no `session_id` and no workout date (only `updated_at`, a mutation time). So sets cannot be reliably tied to a session, which makes "skipped" untrustworthy and limits time-series adaptation.

## Feasibility per proposed input

| Input | Fits current slot-first? | Where it hooks in |
|---|---|---|
| Training style (strength / bodybuilding / powerbuilding / general) | Clean | `Bias` already exists; map style → bias in `EMPHASES` / `STYLES` |
| Injury restrictions | Clean | Pool filter, same mechanism as `hasEquipment` / hidden exercises |
| Loading lean (prefer barbell / dumbbell / machine) | Clean | Stable equipment-preference secondary sort in `byPattern` |
| Variety preference (stable / moderate / high) | Clean | Tune avoid-set strictness in `selectForSession` (keep deterministic) |
| Ranked multi-priority | Partial redesign | Slot reordering cannot weight proportionally; wants volume-first |
| Volume-first allocation | Full redesign | New `allocateWeeklyVolume` planner + the pattern ↔ muscle bridge |

## Phased plan (foundations before features)

**Phase 0 — data foundations (highest leverage, no visible feature):**
- Build the weighted **MovementPattern ↔ muscle-group bridge** (e.g. `horizontal_push` → chest 0.7 / front delts 0.2 / triceps 0.1). One investment that unlocks accurate per-muscle volume, restrictions, recovery analysis, volume-first generation, and adaptation. Also fixes the analytics, which today credit a whole set to one category.
- Expand exercise metadata: promote primary/secondary muscles into the generation path (lift onto `exercises` or join `exercise_instructions` and backfill gaps), add `fatigue_cost`, `unilateral`, per-exercise `difficulty`.
- Add `session_id` + a workout date to `set_logs` so skip detection, adherence, and behavior learning become trustworthy.
- (Done) Raise the `exercise_swaps.week` cap from 12 to 52.

**Phase 1 — personalization (biggest gain per onboarding question, all clean slot-first hooks):**
- Training style (general / bodybuilding / strength / powerbuilding) → session `bias` + `repRange`.
- Injury restrictions (shoulder / knee / lower back / wrist) → pool filter.
- Equipment preference (prefer barbell / dumbbell / machine, distinct from owned) → `byPattern` secondary sort.
- Variety preference → avoid-set strictness.

**Phase 2 — behavior learning:** trustworthy skip tracking (needs Phase 0 session linkage), behavior-driven adaptation (bias future blocks' avoid-set + emphasis from logged swaps/skips), smarter substitution.

**Phase 3 — advanced programming (only when ranked specialization genuinely demands it):** ranked multi-priority + the volume-first planner, built on the Phase 0 bridge. Single `priority_muscle` already covers ~80% of real users ("bigger glutes / shoulders / arms"), so this is deliberately last.

## What NOT to do

Both reviews agreed: do not chase more splits (Arnold, bro split), more templates, or AI generation. The leverage is metadata richness, muscle attribution, and behavioral data quality. The generator is already ahead of most fitness apps and resists the template-sprawl trap by construction.

## Key files

- `src/lib/pulse/generation.ts` — `STYLES`, `EMPHASES`, `selectForSession`, `byPattern`/`pick`, `tiltEmphasis`, `VOLUME`, `repRange`, `volumeFor`, `buildSupersets`.
- `src/app/pulse/actions/routines.ts` — `generateAndSaveRoutine`, the pool query, `cloneTemplate`.
- `src/lib/pulse/utils.ts` — `VOLUME_TARGETS` consumers, `priorityAdjustedTargets`, `computePerMuscleVolume`, `computeRecoveryFlags`.
- `src/lib/pulse/types.ts` — `ExerciseMeta`, `Emphasis`, `MovementPattern`, `PriorityMuscle`.
- Migrations: `2026-06-03-exercise-generation-metadata*.sql`, `2026-06-04-exercise-equipment-correction.sql`, `2026-05-31-exercise-instructions*.sql`.
