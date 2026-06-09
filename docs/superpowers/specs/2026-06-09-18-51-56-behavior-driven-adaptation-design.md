# Behavior-driven adaptation (v1.5), design

**Status:** drafted + reconciled 2026-06-09 (autonomous build while owner AFK; design calls made decisively, reviewed by an architecture lens + a training-science lens, reconciled below). Roadmap Tier 3 #7. Generation engine Phase 3 (behavior learning).

## Goal

Make routine generation **learn from a user's own repeated exercise swaps** and bias the next generation, the pre-AI, deterministic alternative to "AI generation v2". The principle the engine track follows is **"build trust before more intelligence"**: start with the narrowest signal that is provably *safe* coaching, not the broadest one.

## What v1.5 does (and the safety frame that defines it)

When a user repeatedly swaps **away from** an exercise, future generation **soft-deprioritizes** that exercise within its movement-pattern group, but **only for accessory / isolation patterns**, never for the main compound lifts. That single restriction is the heart of the design: it is what makes learning safe without first knowing *why* a user swapped.

- **demote-only.** Learn from what the user rejects (the trustworthy "from" signal). Do **not** promote what they swap *to*: that side has a comfort-ratchet (it would float the easiest/most-comfortable option and undertrain weak points) and a logistics confound (everyone funnels to the one free machine). Promote is deferred.
- **accessories/isolations only.** Behavior never reorders the six `COMPOUND_ANCHOR_PATTERNS` (squat / hinge / horizontal_push / vertical_push / horizontal_pull / vertical_pull). So the worst case, learning to stop programming the barbell squat because the user swapped it during a rough block, is **structurally impossible**. On accessory/isolation slots (cable fly vs pec deck, lateral-raise and curl variants, leg-curl variants, etc.) a repeated swap is far more likely a genuine preference and the cost of being wrong is tiny.
- **soft, never a filter.** A sort nudge that sinks the exercise within its pattern group; if it is the only candidate for a slot it is still selected. It can never empty a pattern.
- **recency-bounded.** Only swaps from the last `BEHAVIOR_RECENCY_DAYS` count, so a preference from a long-past block (different goal, healed injury) decays out. Matches the "progress for years" promise rather than accumulating a sticky, never-forgetting bias.
- **conservative threshold.** An exercise is demoted only after `BEHAVIOR_MIN_SWAPS` recent swap-weeks away from it.

This is the reconciliation of the two review lenses: the architecture lens showed the "from" exercise must be recorded at swap time to be correct; the science lens showed the "from" signal is the trustworthy half but is unsafe on compounds and without a reason. Restricting to non-anchor patterns + demote-only + recency is what lets v1.5 ship a *correct and safe* slice now, with promote, anchor-pattern learning, and reason-awareness (#8) as the documented follow-ons.

## Data-model fix (the correctness prerequisite)

`exercise_swaps` records `(user_id, routine_exercise_id, week) -> exercise_id` (the swapped-**to** id). It does **not** record what was swapped **from**. Recovering "from" via `routine_exercises.exercise_id` is wrong: that column is **mutable** (a permanent swap overwrites it at `routines.ts:223`), so a historical swap row would report whatever sits in the slot *now*, teaching false demotes.

**Fix:** add a nullable `from_exercise_id uuid` to `exercise_swaps`, captured at swap time.

- **Migration** `docs/migrations/<ts>-exercise-swaps-from-exercise.sql`: `alter table exercise_swaps add column if not exists from_exercise_id uuid references exercises(id) on delete set null;`
- **`setExerciseSwap`** (`actions/swaps.ts`) looks up the slot's current `routine_exercises.exercise_id` (ownership-scoped) and writes it as `from_exercise_id` in the upsert. That captures the exercise the *routine offered* and the user rejected, immutable on the row thereafter.
- **Historical rows** keep `from_exercise_id = null` (the original cannot be reliably reconstructed). The signal builds forward, which is correct and honest; `loadSwapHistory` drops null-from rows.

This also removes the need for any PostgREST FK embed: `loadSwapHistory` becomes a flat select, so its unit test is meaningful (the mock can validate a real select string).

## Architecture (slot-first engine, one added sort layer)

`exercise_swaps.from_exercise_id` -> `loadSwapHistory` (queries.ts) -> `analyzeSwapBehavior` (behavior.ts, pure) -> `BehaviorSignal` -> `GenerationInput.behavior` -> a guarded sort layer in `byPattern` (generation.ts) + a `buildRationale` clause. No behavior-profile table (derived each generation from the durable swap log).

### New pure module `src/lib/pulse/behavior.ts`
```ts
export interface SwapHistoryRow { fromExerciseId: string; createdAt: string }
export interface BehaviorSignal { demote: string[] } // promote is a v1.6 field
export const EMPTY_BEHAVIOR: BehaviorSignal = { demote: [] };

// Tally how many recent swap-weeks each exercise was swapped AWAY FROM. An
// exercise is `demote` when that count >= minCount within the recency window
// (now - createdAt <= recencyMs). Output array is sorted (deterministic). Empty
// input or all-stale -> EMPTY_BEHAVIOR.
export function analyzeSwapBehavior(
    rows: SwapHistoryRow[],
    opts: { minCount: number; recencyMs: number; nowMs: number },
): BehaviorSignal
```
Pure, no IO, fully unit-testable. The anchor-pattern protection lives in `byPattern` (which knows the slot pattern), not here, so this module needs no exercise metadata. Test: `src/lib/pulse/__tests__/behavior.test.ts`.

### Loader `loadSwapHistory` (queries.ts)
```ts
// .from('exercise_swaps').select('from_exercise_id, created_at')
//   .eq('user_id', userId).not('from_exercise_id', 'is', null)
// -> SwapHistoryRow[] { fromExerciseId, createdAt }
export async function loadSwapHistory(supabase, userId): Promise<SwapHistoryRow[]>
```
Flat select, user-scoped (RLS + explicit `user_id`), no embed.

### Generation engine (`generation.ts`)
- `GenerationInput` gains `behavior?: BehaviorSignal` (optional; absent/empty = today's behavior).
- `selectForSession` gains a `behavior: BehaviorSignal` param (default `EMPTY_BEHAVIOR`); convert `demote` to a `Set` once for O(1) lookup.
- `byPattern` gets ONE new comparison, added as the **first `if` block inside the existing comparator** (not a second `.sort()` pass), and **guarded by pattern**:
  ```ts
  // Behavior demote: sink rejected accessories within their pattern group.
  // Guarded to NON-anchor patterns so the main compounds are never learned away.
  if (!COMPOUND_ANCHOR_PATTERNS.has(p)) {
      const aD = demoteSet.has(a.id) ? 1 : 0;
      const bD = demoteSet.has(b.id) ? 1 : 0;
      if (aD !== bD) return aD - bD;
  }
  // ...then the existing chain (loadingLean, fresh sub-class, front-delt, fatigue, alpha)
  ```
  **Byte-identical guarantee:** with an empty `demote` set, or on any anchor pattern, this block returns nothing and falls through, so the existing single-pass comparator runs unchanged. (Node/V8 `Array.prototype.sort` is spec-stable, and the engine's terminal alphabetical tiebreak keeps determinism.) Pinned by a golden identity test for both `behavior: EMPTY_BEHAVIOR` and `behavior` omitted.
- Because it is a sort layer (not a filter) and demote ties at +1, a pattern whose candidates are all demoted still fills.
- `buildRationale` gains an optional `demotedNames: string[]` arg and, when non-empty, appends a **specific, soft-worded** clause naming the lifts, e.g. `Tuned to your history: leans away from Cable Fly, Leg Extension (you keep swapping them out).` "leans away from", not "dropped" (matches the soft behavior; no overclaim, no em dashes).

### Server action (`generateAndSaveRoutine`, routines.ts)
Before `generateRoutine(...)`:
```ts
let behavior = EMPTY_BEHAVIOR;
try {
    const rows = await loadSwapHistory(supabase, user.id);
    behavior = analyzeSwapBehavior(rows, {
        minCount: BEHAVIOR_MIN_SWAPS,
        recencyMs: BEHAVIOR_RECENCY_DAYS * 86400000,
        nowMs: Date.now(),
    });
} catch { /* never block generation on the learning layer */ }
```
Pass `behavior` into `generateRoutine({ ..., behavior })`. Resolve `behavior.demote` ids to names from the loaded `pool` exercise rows (the action already loads exercise rows; it needs `name` in that select) and pass `demotedNames` into `buildRationale`. **No profile write-back** (behavior is derived, not a stored preference). On any load/analyze failure, `EMPTY_BEHAVIOR`.

### `setExerciseSwap` (actions/swaps.ts)
Before the upsert, fetch `routine_exercises.exercise_id where id = routineExerciseId` (the call is already ownership-scoped via RLS / user_id) and include `from_exercise_id` in the upserted row. One extra read in an infrequent user action.

### Constants (`constants.ts`)
```ts
export const BEHAVIOR_MIN_SWAPS = 3;   // recent swap-weeks away from a lift before it is demoted
export const BEHAVIOR_RECENCY_DAYS = 120; // ~one to two training blocks; older swaps decay out
```

## Edge cases
- **No / below-threshold / all-stale history:** `EMPTY_BEHAVIOR`, generation byte-identical (golden test).
- **Anchor-pattern slot:** behavior never applies, even if the exercise is in `demote`.
- **Demoted exercise is the only candidate for a (non-anchor) pattern:** still selected (soft sort).
- **Historical swap rows (null from):** dropped by the loader filter.
- **Swap rows for deleted routine_exercises:** the swap row cascades away; `from_exercise_id` survives only on live rows.
- **`from_exercise_id` exercise later deleted from the catalog:** FK `on delete set null` clears it; the row drops out of the signal.
- **Load/analyze failure:** caught, `EMPTY_BEHAVIOR`, generation proceeds.

## Out of scope (v1.5), honest phasing
- **Promote (swap-to) learning.** Deferred: comfort-ratchet + logistics confound. v1.6, ideally gated behind reason-tagged swaps (#8).
- **Anchor-pattern learning** (e.g. barbell bench -> dumbbell bench within horizontal_push). Safe only once swap *reasons* (#8) let us exclude constraint-swaps; until then the anchor patterns are protected wholesale.
- **Skip signal.** Extends the `demote` set on the same seam, but needs `workout_sessions` + schedule attribution and a trust model. v1.6.
- **Volume -> emphasis.** A **separate signal path**: it must tilt `tiltEmphasis` weights per muscle/pattern, not reorder exercise ids in `byPattern`. It will add a sibling field/path, NOT reuse `demote`. (Correcting the earlier claim that all three share one seam: swaps + skips share the demote seam; volume does not.)
- **A generation-time `DecisionEvent`.** Generation writes none by design, and the `swap` `DecisionEventType` is sourced from `exercise_swaps`. v1.5 inspectability is the specific named rationale clause; a Coach-Timeline "learned-preference" event is a documented follow-on (it is a different event from the raw swap).
- **A user opt-out toggle.** Not needed for a conservative, soft, accessory-only, decaying nudge; an opt-out is a future add if it ever surprises a user. The change is inspectable (named in the rationale) and reversible in practice (the user can swap the lift back; demote-only means doing so does not ratchet a counter-preference).

CSP / i18n untouched (no new origin; plain English, no em dashes).

## Testing
- **Pure (`behavior.test.ts`):** threshold gating (below / at / above `minCount`); recency window (a stale row outside `recencyMs` is excluded, a fresh one counted); output array sorted/deterministic; empty input and all-stale -> `EMPTY_BEHAVIOR`; multiple exercises crossing the threshold.
- **Engine (`generation.test.ts` additions):** on a NON-anchor pattern, a demoted exercise sinks behind a neutral same-pattern peer; on an ANCHOR pattern, a demoted exercise is unaffected (ordering identical to no-behavior); a demoted exercise is still selected when it is the only candidate for its (non-anchor) slot; **GOLDEN**: `behavior: EMPTY_BEHAVIOR` and `behavior` omitted both produce byte-identical blueprints to current output (extend the existing identity/determinism tests).
- **Loader (`queries.test.ts`):** `loadSwapHistory` selects `from_exercise_id, created_at`, scopes to `user_id`, filters null-from, maps rows (a shape/`select` assertion like the sibling loaders; now meaningful because the query is a flat select, no embed).
- **Full suite + typecheck** green. No server-action test harness (the swap + generate actions hit Supabase); coverage lives in the pure module + loader + engine tests.

## Decisions log (made decisively while AFK), with the alternatives weighed
1. **demote-only.** Alt: demote + promote. Promote dropped for v1.5 (comfort-ratchet, logistics confound, lower trust). [Science C2]
2. **Non-anchor patterns only.** Alt: all patterns, or an is_compound tier clamp. The tier clamp does not protect squat -> leg press (both compound); whole-anchor protection does, and is simpler. This is the core safety guarantee. [Science C1]
3. **Record `from_exercise_id` at swap time (migration + write-path change).** Alt: recover "from" via `routine_exercises.exercise_id` (broken: mutable) or ship promote-only (reliable data but unsafe coaching). Recording from is the only correct option and also kills the FK embed. [Architecture C1, I2]
4. **Recency window (`BEHAVIOR_RECENCY_DAYS`).** Alt: count all history. A never-forgetting signal fights the "for years" promise and compounds any mistake. [Science I1]
5. **Soft sort layer, first-in-comparator, empty = byte-identical.** Alt: a hard pool filter, or a second sort pass. Soft preserves the pool; one comparator block preserves determinism + the golden tests. [Architecture I1]
6. **Derive each generation, no behavior table.** The swap log is the durable source of truth. [Architecture M1]
7. **Specific named rationale; DecisionEvent deferred.** Inspectability without expanding the generation/decision-event contract. [Science I3]
8. **Threshold = 3 recent swap-weeks** (a calibration guess, easy to tune; note it can be "1 slot held 3 weeks" or "3 slots once", both acceptable as a preference proxy). [Architecture M5, Science I1]
9. **Stay on #7 (not pivot to #8 first).** The science lens noted reason-tagged swaps (#8) are the proper precursor. Restricting v1.5 to accessory/isolation + soft + decay defuses the constraint-vs-preference ambiguity enough to ship #7 safely now, with #8 as the gate for expanding to anchors/promote. Documented so the sequencing is deliberate, not accidental.
