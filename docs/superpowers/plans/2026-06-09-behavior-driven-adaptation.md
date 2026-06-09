# Behavior-driven adaptation (#7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Routine generation learns from a user's repeated exercise swaps and soft-deprioritizes exercises they keep swapping away from, on accessory/isolation patterns only, recency-bounded, demote-only.

**Architecture:** Record the swapped-`from` exercise at swap time (`exercise_swaps.from_exercise_id`), load that history (`loadSwapHistory`), tally it in a pure `behavior.ts` module into a `BehaviorSignal { demote }`, thread it through `GenerationInput.behavior` into one guarded sort layer in `byPattern` (non-anchor patterns only), and name the demoted lifts in `buildRationale`. No behavior table (derived each generation). Empty signal is byte-identical to today (golden test).

**Tech Stack:** Next.js 15 / TS / Supabase / SWR; Vitest. Spec: `docs/superpowers/specs/2026-06-09-18-51-56-behavior-driven-adaptation-design.md`.

**Conventions:** bun. Verify with `bun run test:run` + `bun run typecheck`. No em dashes anywhere. No server-action test harness (actions hit Supabase); cover via the pure module + loader + engine tests. Commit per task; git uses `GIT_CONFIG_GLOBAL=/dev/null` + `-c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen"`.

---

## Task 1: Migration, `exercise_swaps.from_exercise_id`

**Files:** Create `docs/migrations/2026-06-09-18-51-56-exercise-swaps-from-exercise.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Behavior-driven adaptation (#7): record what a swap replaced, captured at swap
-- time. routine_exercises.exercise_id is mutable (a permanent swap overwrites it),
-- so it cannot be used to recover the original after the fact. Nullable: historical
-- rows stay null (the signal builds forward) and the loader drops null-from rows.
alter table exercise_swaps
  add column if not exists from_exercise_id uuid references exercises(id) on delete set null;
```

- [ ] **Step 2: Commit** (migrations apply manually; no runner)

```bash
git add docs/migrations/2026-06-09-18-51-56-exercise-swaps-from-exercise.sql
git commit -m "feat(pulse): exercise_swaps.from_exercise_id for behavior learning (#7)"
```

---

## Task 2: Capture `from_exercise_id` in `setExerciseSwap`

**Files:** Modify `src/app/pulse/actions/swaps.ts:23-27`

- [ ] **Step 1: Implement.** Before the upsert, look up the slot's current catalog exercise (the exercise the routine offered, which the user is rejecting) and write it as `from_exercise_id`. Replace the upsert block:

```ts
    // Capture what this swap replaces (the slot's current catalog exercise) so
    // behavior learning has a reliable "from"; routine_exercises.exercise_id is
    // mutable, so it must be snapshotted now, not recovered later.
    const { data: slot } = await supabase
        .from('routine_exercises')
        .select('exercise_id')
        .eq('id', routineExerciseId)
        .single();
    const fromExerciseId = (slot as { exercise_id: string } | null)?.exercise_id ?? null;

    const { error } = await supabase.from('exercise_swaps').upsert(
        {
            user_id: user.id,
            routine_exercise_id: routineExerciseId,
            week,
            exercise_id: exerciseId,
            from_exercise_id: fromExerciseId,
        },
        { onConflict: 'user_id,routine_exercise_id,week' },
    );
    if (error) throw new Error('Failed to save swap');
```

- [ ] **Step 2: Verify** `bun run typecheck`. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pulse/actions/swaps.ts
git commit -m "feat(pulse): capture from_exercise_id when a swap is saved (#7)"
```

---

## Task 3: Constants + pure `behavior.ts` module (TDD)

**Files:** Modify `src/lib/pulse/constants.ts`; Create `src/lib/pulse/behavior.ts`; Test `src/lib/pulse/__tests__/behavior.test.ts`

- [ ] **Step 1: Add constants** to `src/lib/pulse/constants.ts` (end of file):

```ts
// Behavior-driven adaptation (#7).
export const BEHAVIOR_MIN_SWAPS = 3; // recent swap-weeks away from a lift before it is demoted
export const BEHAVIOR_RECENCY_DAYS = 120; // ~one to two training blocks; older swaps decay out
```

- [ ] **Step 2: Write the failing test** `src/lib/pulse/__tests__/behavior.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { analyzeSwapBehavior, EMPTY_BEHAVIOR, type SwapHistoryRow } from '@/lib/pulse/behavior';

const NOW = Date.parse('2026-06-09T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const row = (fromExerciseId: string, d: number): SwapHistoryRow => ({ fromExerciseId, createdAt: daysAgo(d) });
const opts = { minCount: 3, recencyMs: 120 * 86400000, nowMs: NOW };

describe('analyzeSwapBehavior', () => {
    it('empty input -> EMPTY_BEHAVIOR', () => {
        expect(analyzeSwapBehavior([], opts)).toEqual(EMPTY_BEHAVIOR);
    });
    it('demotes an exercise swapped away from >= minCount recent times', () => {
        const rows = [row('a', 1), row('a', 5), row('a', 9)];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a'] });
    });
    it('does not demote below the threshold', () => {
        expect(analyzeSwapBehavior([row('a', 1), row('a', 5)], opts)).toEqual({ demote: [] });
    });
    it('excludes stale swaps outside the recency window', () => {
        const rows = [row('a', 1), row('a', 5), row('a', 200)]; // third is stale
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
    });
    it('returns a sorted, deterministic demote list', () => {
        const rows = [
            row('z', 1), row('z', 2), row('z', 3),
            row('a', 1), row('a', 2), row('a', 3),
        ];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a', 'z'] });
    });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `bun run test:run src/lib/pulse/__tests__/behavior.test.ts`
Expected: FAIL (module not found / not exported).

- [ ] **Step 4: Implement** `src/lib/pulse/behavior.ts`

```ts
// Behavior-driven adaptation (#7): turn a user's swap history into a generation
// bias. v1.5 is demote-only (learn what they reject); promote/skip/volume are
// documented follow-ons. Pure: callers pass the rows + clock, no IO here.

export interface SwapHistoryRow {
    fromExerciseId: string; // the catalog exercise the user swapped away from
    createdAt: string; // ISO timestamp of the swap row
}

export interface BehaviorSignal {
    demote: string[]; // exercise_ids to soft-deprioritize (sorted, deterministic)
}

export const EMPTY_BEHAVIOR: BehaviorSignal = { demote: [] };

// An exercise is demoted when it was swapped AWAY FROM at least `minCount` times
// within the recency window (nowMs - createdAt <= recencyMs). Output is sorted so
// the result is a pure function of the input set (no row-order dependence).
export function analyzeSwapBehavior(
    rows: SwapHistoryRow[],
    opts: { minCount: number; recencyMs: number; nowMs: number },
): BehaviorSignal {
    const counts = new Map<string, number>();
    for (const r of rows) {
        const age = opts.nowMs - Date.parse(r.createdAt);
        if (Number.isNaN(age) || age > opts.recencyMs) continue;
        counts.set(r.fromExerciseId, (counts.get(r.fromExerciseId) ?? 0) + 1);
    }
    const demote = [...counts.entries()]
        .filter(([, n]) => n >= opts.minCount)
        .map(([id]) => id)
        .sort();
    return { demote };
}
```

- [ ] **Step 5: Run, verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/behavior.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pulse/constants.ts src/lib/pulse/behavior.ts src/lib/pulse/__tests__/behavior.test.ts
git commit -m "feat(pulse): pure swap-behavior analysis module (#7)"
```

---

## Task 4: `loadSwapHistory` loader

**Files:** Modify `src/lib/pulse/queries.ts`; Test `src/lib/pulse/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing test** in `queries.test.ts` (add a describe block; mirror the existing `loadSwaps` test's `makeClient`/`calls` pattern in that file):

```ts
describe('loadSwapHistory', () => {
    it('selects from_exercise_id + created_at scoped to the user, drops null-from rows', async () => {
        const { client, calls } = makeClient({
            data: [
                { from_exercise_id: 'ex-a', created_at: '2026-06-01T00:00:00Z' },
                { from_exercise_id: 'ex-b', created_at: '2026-06-02T00:00:00Z' },
            ],
            error: null,
        });
        const rows = await loadSwapHistory(client, UID);
        expect(calls.table).toBe('exercise_swaps');
        expect(calls.select).toBe('from_exercise_id, created_at');
        expect(rows).toEqual([
            { fromExerciseId: 'ex-a', createdAt: '2026-06-01T00:00:00Z' },
            { fromExerciseId: 'ex-b', createdAt: '2026-06-02T00:00:00Z' },
        ]);
    });
});
```

Add `loadSwapHistory` to the existing `queries.ts` import at the top of the test file.

- [ ] **Step 2: Run, verify fail**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts -t "loadSwapHistory"`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement** in `queries.ts` (near `loadSwaps`). Import the type from behavior:

```ts
import type { SwapHistoryRow } from './behavior';

// Swap history for behavior learning (#7): the recorded from-exercise of each
// swap, user-scoped. Drops rows with a null from (historical rows pre-dating the
// from_exercise_id column).
export async function loadSwapHistory(
    supabase: SupabaseServerClient,
    userId: string,
): Promise<SwapHistoryRow[]> {
    const { data, error } = await supabase
        .from('exercise_swaps')
        .select('from_exercise_id, created_at')
        .eq('user_id', userId)
        .not('from_exercise_id', 'is', null);
    if (error) throw error;
    return (data ?? [])
        .filter((r) => r.from_exercise_id != null)
        .map((r) => ({ fromExerciseId: r.from_exercise_id as string, createdAt: r.created_at as string }));
}
```

(Check the existing `SupabaseServerClient` type name used by sibling loaders in `queries.ts` and match it. If `loadSwaps`'s test mock chains `.not(...)`, confirm the test `makeClient` builder returns `this` from `.not`; if not, extend the mock builder to support `.not` returning the data, mirroring how it already supports `.eq`/`.order`.)

- [ ] **Step 4: Run, verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/queries.test.ts -t "loadSwapHistory"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/queries.ts src/lib/pulse/__tests__/queries.test.ts
git commit -m "feat(pulse): loadSwapHistory loader for behavior learning (#7)"
```

---

## Task 5: Generation engine, the guarded demote sort layer (TDD)

**Files:** Modify `src/lib/pulse/generation.ts` (`GenerationInput` ~862, `generateRoutine` selectForSession call ~961, `selectForSession` signature ~598 + `byPattern` ~650, `buildRationale` ~1048); Test `src/lib/pulse/__tests__/generation.test.ts`

- [ ] **Step 1: Write the failing tests** in `generation.test.ts` (append; reuse the existing `meta`, `deepPool`, `input`, `dumbbellsOnly` helpers). `biceps_iso` is a non-anchor pattern with two pool options (`biceps_iso-1`, `biceps_iso-2`); `squat` is an anchor pattern.

```ts
import { EMPTY_BEHAVIOR } from '@/lib/pulse/behavior';

describe('behavior-driven demote (#7)', () => {
    const ids = (bp: ReturnType<typeof generateRoutine>) => bp.exercises.map((e) => e.exercise_id);

    it('GOLDEN: empty behavior and omitted behavior are byte-identical to base', () => {
        const base = JSON.stringify(generateRoutine(input()));
        expect(JSON.stringify(generateRoutine(input({ behavior: EMPTY_BEHAVIOR })))).toBe(base);
        expect(JSON.stringify(generateRoutine(input({ behavior: { demote: [] } })))).toBe(base);
    });

    it('sinks a demoted exercise on a NON-anchor pattern', () => {
        // baseline picks biceps_iso-1 before biceps_iso-2 (alphabetical tiebreak)
        const base = generateRoutine(input());
        expect(ids(base)).toContain('biceps_iso-1');
        const demoted = generateRoutine(input({ behavior: { demote: ['biceps_iso-1'] } }));
        // with -1 demoted, the slot that took it now takes -2 instead
        expect(ids(demoted)).toContain('biceps_iso-2');
        expect(ids(demoted)).not.toContain('biceps_iso-1');
    });

    it('does NOT reorder an ANCHOR pattern even if the exercise is demoted', () => {
        const base = JSON.stringify(generateRoutine(input()));
        const demoted = JSON.stringify(generateRoutine(input({ behavior: { demote: ['squat-1', 'horizontal_push-1'] } })));
        expect(demoted).toBe(base);
    });

    it('still selects a demoted exercise when it is the only candidate for its slot', () => {
        // a thin pool with a single biceps_iso option, demoted
        const thin: ExerciseMeta[] = [];
        for (const p of ALL_PATTERNS) thin.push(meta(`${p}-only`, p, ['dumbbells'], !p.endsWith('_iso') && p !== 'calf' && p !== 'core'));
        const bp = generateRoutine(input({ pool: thin, behavior: { demote: ['biceps_iso-only'] } }));
        // it is still present if the chosen style requests that pattern; assert it is not dropped from the pool's reach
        const all = generateRoutine(input({ pool: thin }));
        if (all.exercises.some((e) => e.exercise_id === 'biceps_iso-only')) {
            expect(bp.exercises.some((e) => e.exercise_id === 'biceps_iso-only')).toBe(true);
        }
    });
});
```

NOTE: the second test assumes the Classic Upper/Lower style requests a `biceps_iso` slot and that with two equal candidates the alphabetical tiebreak picks `-1`. If the style does not surface `biceps_iso`, switch to a non-anchor pattern the style does use (inspect a `generateRoutine(input())` blueprint's patterns first via a scratch assertion, then pick a non-anchor pattern present in it, e.g. `triceps_iso` or `shoulder_iso`). Keep the anchor test on a guaranteed anchor pattern (`squat`/`horizontal_push`).

- [ ] **Step 2: Run, verify fail**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts -t "behavior-driven demote"`
Expected: FAIL (`behavior` not on `GenerationInput`).

- [ ] **Step 3: Implement.** Four edits in `generation.ts`:

(a) `GenerationInput` (after `restrictions`, ~line 881), add:
```ts
    /** Behavior-learned bias (#7). `demote` exercise_ids sink within their
     *  movement-pattern group, but ONLY on non-anchor patterns. Absent / empty
     *  demote is the no-op identity path (output byte-identical to base). */
    behavior?: BehaviorSignal;
```
Add the import at the top of `generation.ts`: `import type { BehaviorSignal } from './behavior';` and `import { EMPTY_BEHAVIOR } from './behavior';`

(b) `selectForSession` signature (line 598-607), add a param:
```ts
    loadingLean?: LoadingPreference | null,
    behavior: BehaviorSignal = EMPTY_BEHAVIOR,
): Selected[] {
    const demoteSet = new Set(behavior.demote);
```
(add the `const demoteSet` as the first line of the body, beside `preferredKey`).

(c) `byPattern` comparator (inside the `.sort((a, b) => {` at line 652), add as the FIRST `if` block, before the `preferredKey` block:
```ts
            // Behavior demote (#7): sink rejected exercises within their pattern
            // group, but only on NON-anchor patterns so the main compounds are
            // never learned away. Empty demoteSet or an anchor pattern -> 0,
            // falls through, base ordering preserved (golden test).
            if (!anchorPattern) {
                const aDemote = demoteSet.has(a.id) ? 1 : 0;
                const bDemote = demoteSet.has(b.id) ? 1 : 0;
                if (aDemote !== bDemote) return aDemote - bDemote;
            }
```
(`anchorPattern` is already in scope at line 651.)

(d) Pass `behavior` from `generateRoutine` into the `selectForSession` call (line 961-970): add `input.behavior ?? EMPTY_BEHAVIOR` as the final argument after `input.loadingLean`.

(e) `buildRationale` (line 1048-1062): add a param and clause:
```ts
export function buildRationale(
    answers: OnboardingAnswers,
    sessionTime: SessionTime,
    style: ProgramStyle,
    priority?: PriorityMuscle | null,
    trainingStyle?: TrainingStyle,
    demotedNames: string[] = [],
): string {
    // ... existing body up to `const withPriority = ...`
    const styleClause = TRAINING_STYLE_CLAUSE[trainingStyle ?? 'balanced'];
    const behaviorClause =
        demotedNames.length > 0
            ? ` Tuned to your history: leans away from ${demotedNames.join(', ')} (you keep swapping them out).`
            : '';
    return `${withPriority}${styleClause}${behaviorClause}`;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts`
Expected: PASS (all existing + new). If the non-anchor demote test picked the wrong pattern, adjust per the Step 1 note.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): guarded behavior-demote sort layer in generation (#7)"
```

---

## Task 6: Wire behavior into `generateAndSaveRoutine`

**Files:** Modify `src/app/pulse/actions/routines.ts:464-523`

- [ ] **Step 1: Implement.** Three edits:

(a) Add `name` to the pool select (line 466) so demoted ids can be named:
```ts
        .select('id, name, category, equipment, movement_pattern, is_compound, fatigue, substitution_class, unilateral, contraindications')
```

(b) After the `pool` is built (after line 508) and BEFORE `buildRationale` is called, compute behavior + names. Move the `const rationale = buildRationale(...)` line (currently 489) to here, and add:
```ts
    // Behavior-driven adaptation (#7): learn from recent repeated swaps. Never
    // block generation on the learning layer.
    let behavior = EMPTY_BEHAVIOR;
    try {
        const swapRows = await loadSwapHistory(supabase, user.id);
        behavior = analyzeSwapBehavior(swapRows, {
            minCount: BEHAVIOR_MIN_SWAPS,
            recencyMs: BEHAVIOR_RECENCY_DAYS * 86400000,
            nowMs: Date.now(),
        });
    } catch {
        behavior = EMPTY_BEHAVIOR;
    }
    const nameById = new Map(((poolData ?? []) as { id: string; name?: string }[]).map((r) => [r.id, r.name ?? '']));
    const demotedNames = behavior.demote.map((id) => nameById.get(id)).filter((n): n is string => !!n);
    const rationale = buildRationale(answers, sessionTime, style, priority, resolvedTrainingStyle, demotedNames);
```
Remove the original `const rationale = buildRationale(...)` at line 489.

(c) Pass `behavior` into the `generateRoutine({...})` call (after `restrictions: resolvedRestrictions,`):
```ts
        behavior,
```

Add imports at the top of `routines.ts`: `import { loadSwapHistory } from '@/lib/pulse/queries';` (or extend the existing queries import), `import { analyzeSwapBehavior, EMPTY_BEHAVIOR } from '@/lib/pulse/behavior';`, and `import { BEHAVIOR_MIN_SWAPS, BEHAVIOR_RECENCY_DAYS } from '@/lib/pulse/constants';` (extend existing constants import if present). If `ExercisePoolRow` is a declared type, add `name?: string` to it.

- [ ] **Step 2: Verify** `bun run typecheck`. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/pulse/actions/routines.ts
git commit -m "feat(pulse): apply swap-behavior bias when generating a routine (#7)"
```

---

## Task 7: Full verification

- [ ] **Step 1: Full suite + typecheck**

Run: `bun run test:run && bun run typecheck`
Expected: all green (was 1003; +~10 new behavior/engine/loader tests). Fix any straggler fixtures inline (e.g. a test constructing `GenerationInput` that a stricter type now flags, or a queries mock builder lacking `.not`).

- [ ] **Step 2: em-dash sweep** on changed files

Run: `git diff main...HEAD --name-only | grep -E '\.(ts|tsx|md|sql)$' | xargs grep -l "—"` (expect: only pre-existing placeholder/test lines, none in newly authored prose/code).

- [ ] **Step 3:** (No commit; verification only.)

---

## Task 8: Code review + second opinion, then FINISH

- [ ] **Step 1:** Code review the full diff (code-reviewer subagent) + a second-opinion adversarial review; address findings (commit fixes).
- [ ] **Step 2: FINISH ritual.** Move #7 to Shipped in `docs/roadmap.md` (dated bullet, mark the Tier 3 row shipped), set `In progress:` back to `(none)`, refresh the test count. Update `CLAUDE.md`'s "Routine generation" section: the behavior seam (`behavior.ts`, `loadSwapHistory`, `from_exercise_id`, the guarded `byPattern` demote layer, demote-only / non-anchor / recency, the rationale clause), and note skips + promote + volume->emphasis as v1.6 follow-ons.
- [ ] **Step 3: Commit** the FINISH sync.

```bash
git add docs/roadmap.md CLAUDE.md
git commit -m "docs(roadmap): ship behavior-driven adaptation (#7)"
```

---

## Self-review (spec coverage)

- Data-model fix (`from_exercise_id`, captured at swap time): Tasks 1-2.
- Pure analysis (threshold, recency, sorted/deterministic, demote-only): Task 3.
- Loader (flat select, null-from filter, user-scoped): Task 4.
- Engine (guarded non-anchor demote layer, byte-identical empty path, soft/never-empties, named rationale): Task 5.
- Wiring (derive each generation, name resolution, EMPTY on failure, no profile write-back): Task 6.
- Out-of-scope items (promote, skips, volume->emphasis, DecisionEvent, opt-out): not implemented, by design.
- Golden identity + anchor-protection + only-candidate + threshold + recency: covered by Task 3 + Task 5 tests.
