# Smart substitution v2 (#8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reason-tagged swaps (pain / no_equipment / crowded; null = preference) with reason-aware same-stimulus ranking, plus filtering #7 behavior learning to preference-only swaps.

**Architecture:** Add a nullable `exercise_swaps.reason`; enrich `DbExercise` with `substitution_class` + `contraindications` (existing columns); a pure tiered `rankSubstitutes` (same-`substitution_class` dominates every reason, then the reason term, then name); a `captureReason`-gated reason-chip UI in the shared `ExerciseSwapPicker` (LogView persists, ProgramView does not); and a constraint-reason filter in the pure `analyzeSwapBehavior`.

**Tech Stack:** Next.js 15 / TS / Supabase / SWR; Vitest + Testing Library. Spec: `docs/superpowers/specs/2026-06-09-21-54-49-smart-substitution-v2-design.md`.

**Conventions:** bun. Verify with `bun run test:run` + `bun run typecheck`. No em dashes. No server-action test harness (actions hit Supabase); cover via pure fns + hook/component tests. Commit per task; git uses `GIT_CONFIG_GLOBAL=/dev/null` + `-c user.email=christiaanvaneijnsbergen@gmail.com -c user.name="Christiaan van Eijnsbergen"`.

---

## Task 1: Migration, `exercise_swaps.reason`

**Files:** Create `docs/migrations/2026-06-09-21-54-49-exercise-swaps-reason.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Smart substitution v2 (#8): optional reason a swap was made. null = unspecified
-- (treated as preference). Constraint swaps (pain/no_equipment/crowded) are
-- excluded from #7 behavior-learning's demote. Nullable, no default; null passes
-- the CHECK.
alter table exercise_swaps
  add column if not exists reason text check (reason in ('pain', 'no_equipment', 'crowded'));
```

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-06-09-21-54-49-exercise-swaps-reason.sql
git commit -m "feat(pulse): exercise_swaps.reason column for smart substitution (#8)"
```

---

## Task 2: Types + exercises-loader enrichment

**Files:** Modify `src/lib/pulse/types.ts` (`DbExercise` ~253; add `SwapReason` + `SWAP_REASONS`), `src/lib/pulse/queries.ts` (`EXERCISES_SELECT` line 41)

- [ ] **Step 1:** In `types.ts`, add the reason vocabulary (near `RESTRICTION_FLAGS`/`RestrictionFlag` ~478):

```ts
export const SWAP_REASONS = ['pain', 'no_equipment', 'crowded'] as const;
export type SwapReason = (typeof SWAP_REASONS)[number];
```

- [ ] **Step 2:** Enrich `DbExercise` (additive, optional, backward-compatible):

```ts
export interface DbExercise {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_sets: string;
    default_reps: string;
    user_id: string | null;
    equipment?: EquipmentKey[];
    movement_pattern?: MovementPattern | null;
    is_compound?: boolean;
    substitution_class?: string | null; // same-stimulus family (#8 ranking)
    contraindications?: RestrictionFlag[]; // joint-stress flags (#8 pain rank)
}
```

- [ ] **Step 3:** `queries.ts` line 41, add the two columns to `EXERCISES_SELECT`:

```ts
const EXERCISES_SELECT =
    'id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound, substitution_class, contraindications';
```
(`loadExercises` returns rows as-is after a name sort, so the new columns flow through untouched. Leave the generation action's own standalone exercises select at `routines.ts:469` alone, do not unify them in this PR.)

- [ ] **Step 4: Verify** `bun run typecheck`. Expected: 0 errors (optional fields break no existing literal).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/queries.ts
git commit -m "feat(pulse): SwapReason + enrich DbExercise with substitution_class/contraindications (#8)"
```

---

## Task 3: Pure `rankSubstitutes` (TDD)

**Files:** Modify `src/lib/pulse/utils.ts` (after `swapCandidates` ~462); Test `src/lib/pulse/__tests__/utils.test.ts` (new describe block)

- [ ] **Step 1: Write the failing tests** in `utils.test.ts` (add a `describe('rankSubstitutes', ...)`; a local fixture builder with the new fields):

```ts
import { rankSubstitutes } from '@/lib/pulse/utils';
// ... in the new describe:
const ex = (id: string, over: Partial<DbExercise> = {}): DbExercise => ({
    id, name: id, category: 'chest', default_sets: '3', default_reps: '8', user_id: null,
    movement_pattern: 'horizontal_push', equipment: [], is_compound: true,
    substitution_class: null, contraindications: [], ...over,
});

describe('rankSubstitutes', () => {
    const original = ex('orig', { substitution_class: 'horizontal_press', equipment: ['barbell', 'bench'] });

    it('same substitution_class wins over a different class regardless of reason/equipment', () => {
        const sameClass = ex('same', { substitution_class: 'horizontal_press', equipment: [] });
        const diffClass = ex('diff', { substitution_class: 'other', equipment: ['barbell', 'bench'] });
        for (const reason of [undefined, 'pain', 'no_equipment', 'crowded'] as const) {
            expect(rankSubstitutes(original, [diffClass, sameClass], reason)[0].id).toBe('same');
        }
    });

    it('preference (no reason) prefers most equipment overlap within a class tier', () => {
        const more = ex('more', { equipment: ['barbell', 'bench'] });
        const less = ex('less', { equipment: ['dumbbells'] });
        expect(rankSubstitutes(original, [less, more]).map((e) => e.id)).toEqual(['more', 'less']);
    });

    it('no_equipment / crowded prefer the fewest shared equipment keys', () => {
        const shares = ex('shares', { equipment: ['barbell'] });
        const none = ex('none', { equipment: ['dumbbells'] });
        expect(rankSubstitutes(original, [shares, none], 'no_equipment').map((e) => e.id)).toEqual(['none', 'shares']);
        expect(rankSubstitutes(original, [shares, none], 'crowded').map((e) => e.id)).toEqual(['none', 'shares']);
    });

    it('pain prefers the fewest contraindication flags', () => {
        const flagged = ex('flagged', { contraindications: ['shoulder'] });
        const clean = ex('clean', { contraindications: [] });
        expect(rankSubstitutes(original, [flagged, clean], 'pain').map((e) => e.id)).toEqual(['clean', 'flagged']);
    });

    it('name is the deterministic tiebreak regardless of input order', () => {
        const a = ex('a-ex', { name: 'Alpha', equipment: ['barbell', 'bench'] });
        const b = ex('b-ex', { name: 'Beta', equipment: ['barbell', 'bench'] });
        expect(rankSubstitutes(original, [b, a]).map((e) => e.name)).toEqual(['Alpha', 'Beta']);
    });

    it('degrades gracefully when substitution_class is absent', () => {
        const noClassOrig = ex('o2', { substitution_class: null, equipment: ['barbell'] });
        const x = ex('x', { equipment: ['barbell'] });
        const y = ex('y', { equipment: [] });
        expect(rankSubstitutes(noClassOrig, [y, x]).map((e) => e.id)).toEqual(['x', 'y']); // overlap desc
    });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "rankSubstitutes"`
Expected: FAIL (not exported).

- [ ] **Step 3: Implement** in `utils.ts` after `swapCandidates`:

```ts
import type { SwapReason } from './types'; // add to the existing types import

// Reason-aware re-rank of swap candidates (#8). Assumes `candidates` are ALREADY
// same-pattern-filtered (e.g. by swapCandidates); this only reorders. Tiered total
// order so same-stimulus always wins, then the reason term, then name:
//   1. same substitution_class as the original (only when the original has one)
//   2. reason: preference=equipment overlap desc; no_equipment/crowded=overlap asc
//      (prefer different gear); pain=contraindication-flag count asc (gentlest)
//   3. name asc (deterministic; owned here, not reliant on input order)
export function rankSubstitutes(
    original: DbExercise,
    candidates: DbExercise[],
    reason?: SwapReason,
): DbExercise[] {
    const origClass = original.substitution_class ?? null;
    const origEquip = new Set(original.equipment ?? []);
    const overlap = (e: DbExercise) => (e.equipment ?? []).filter((x) => origEquip.has(x)).length;
    const flags = (e: DbExercise) => (e.contraindications ?? []).length;
    return [...candidates].sort((a, b) => {
        if (origClass) {
            const aC = a.substitution_class === origClass ? 0 : 1;
            const bC = b.substitution_class === origClass ? 0 : 1;
            if (aC !== bC) return aC - bC;
        }
        if (reason === 'no_equipment' || reason === 'crowded') {
            if (overlap(a) !== overlap(b)) return overlap(a) - overlap(b);
        } else if (reason === 'pain') {
            if (flags(a) !== flags(b)) return flags(a) - flags(b);
        } else {
            if (overlap(a) !== overlap(b)) return overlap(b) - overlap(a);
        }
        return a.name.localeCompare(b.name);
    });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "rankSubstitutes"`
Expected: PASS (6 tests). The existing `swapCandidates` test is untouched.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
git commit -m "feat(pulse): pure reason-aware rankSubstitutes (#8)"
```

---

## Task 4: Thread `reason` through the action, hook, context

**Files:** Modify `src/app/pulse/actions/swaps.ts`, `src/hooks/pulse/useSwaps.ts`, `src/context/PulseContext.ts`

- [ ] **Step 1:** `actions/swaps.ts`, change `setExerciseSwap`'s signature + upsert. Add `import { SWAP_REASONS, type SwapReason } from '@/lib/pulse/types';`:

```ts
export async function setExerciseSwap(
    routineExerciseId: string,
    week: number,
    exerciseId: string,
    reason?: SwapReason,
): Promise<void> {
    // ...existing week/uuid validation...
    if (reason !== undefined && !(SWAP_REASONS as readonly string[]).includes(reason)) {
        throw new Error('Invalid swap reason');
    }
    // ...existing ownership + from-capture...
    const { error } = await supabase.from('exercise_swaps').upsert(
        {
            user_id: user.id,
            routine_exercise_id: routineExerciseId,
            week,
            exercise_id: exerciseId,
            from_exercise_id: fromExerciseId,
            created_at: new Date().toISOString(),
            reason: reason ?? null, // un-tagged re-swap clears any prior reason (latest intent wins)
        },
        { onConflict: 'user_id,routine_exercise_id,week' },
    );
    if (error) throw new Error('Failed to save swap');
}
```

- [ ] **Step 2:** `useSwaps.ts`, thread `reason` (the `Swaps` map is unchanged, reason is write-only):

```ts
const setSwap = useCallback(
    async (week: number, routineExerciseId: string, exerciseId: string, reason?: SwapReason): Promise<void> => {
        mutate({ ...swaps, [swapKey(week, routineExerciseId)]: exerciseId }, false);
        await setExerciseSwap(routineExerciseId, week, exerciseId, reason);
        mutate();
    },
    [swaps, mutate],
);
```
Add `import type { SwapReason } from '@/lib/pulse/types';` (extend the existing `Swaps` import).

- [ ] **Step 3:** `PulseContext.ts`, extend the `setSwap` signature (trailing optional, existing 3-arg callers compile unchanged):

```ts
setSwap: (week: number, routineExerciseId: string, exerciseId: string, reason?: SwapReason) => Promise<void>;
```
Add `SwapReason` to the type import in that file.

- [ ] **Step 4: Verify** `bun run typecheck`. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pulse/actions/swaps.ts src/hooks/pulse/useSwaps.ts src/context/PulseContext.ts
git commit -m "feat(pulse): thread swap reason through action/hook/context (#8)"
```

---

## Task 5: ExerciseSwapPicker, reason chips + ranked suggestions (TDD)

**Files:** Modify `src/components/pulse/ExerciseSwapPicker.tsx`, callers `src/components/pulse/views/LogView.tsx` (~313-337) + `src/components/pulse/views/ProgramView.tsx` (~383); Test `src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx`

- [ ] **Step 1: Write failing component tests.** Cover: (a) with `captureReason`, the three chips render and toggle; (b) choosing a constraint reason re-ranks (the suggested top changes); (c) `onSelect` is called with `(exerciseId, reason)`; (d) WITHOUT `captureReason`, no chips render; (e) the existing onSelect/revert/empty/search tests still pass with the new `original` prop. Build `original` as a full `DbExercise`. Mock nothing beyond props (the picker is presentational). Follow the existing `ExerciseSwapPicker.test.tsx` setup (the `mk(id, name)` helper, extend it with `substitution_class`/`equipment`).

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement the picker.** Prop changes: replace `originalName: string` with `original: DbExercise` (derive `const originalName = original.name`); `onSelect: (exerciseId: string, reason: SwapReason | null) => void`; add `captureReason?: boolean` (default false). Internals:
  - `const [reason, setReason] = useState<SwapReason | null>(null);`
  - `const ranked = rankSubstitutes(original, candidates, reason ?? undefined);`
  - When `captureReason`, render a chip row under the subtitle: buttons `Pain` / `No equipment` / `Crowded` (`SWAP_REASONS` labels via a local `REASON_LABELS`), toggle-to-deselect (`setReason(r === reason ? null : r)`), active chip uses `bg-pulse-accent/15 text-pulse-accent`, inactive `bg-pulse-bg text-pulse-dim ring-1 ring-pulse-border`.
  - List: when `query` is empty, show the top 3 of `ranked` under a "Suggested" subheader (each with the `exerciseReason(e)` caption when non-null + the reason-context line), then the rest under an "All alternatives" divider; when searching, show the flat filtered `ranked`. Reuse the existing candidate-button markup; add `exerciseReason` import.
  - Reason-context line over Suggested: `preference -> 'Closest match'`, `no_equipment|crowded -> 'Same movement, different gear'`, `pain -> 'Same movement, gentler on the joints'`.
  - `onClick={() => onSelect(e.id, reason)}`.
  - No new color literals; Pulse tokens only; no em dashes.
- [ ] **Step 4: Update callers.**
  - `LogView.tsx`: pass `original={original}` (drop `originalName`), `captureReason`, and `onSelect={(exId, r) => { setSwap(activeWeek, swapTarget.id, exId, r ?? undefined); setSwapTarget(null); }}`.
  - `ProgramView.tsx`: pass `original={swapTarget.exercise}` (drop `originalName`); leave `captureReason` off; `onSelect={handlePermanentSwap}` stays but its signature widens to `(newExerciseId: string, _reason?: SwapReason | null)` (ignores reason).

- [ ] **Step 5: Run, verify pass.** Run the picker test + `LogView`/`ProgramView` tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/ExerciseSwapPicker.tsx src/components/pulse/views/LogView.tsx src/components/pulse/views/ProgramView.tsx src/components/pulse/__tests__/ExerciseSwapPicker.test.tsx
git commit -m "feat(pulse): reason chips + ranked suggestions in the swap picker (#8)"
```

---

## Task 6: Filter #7 behavior learning to preference-only swaps

**Files:** Modify `src/lib/pulse/behavior.ts` + `src/lib/pulse/__tests__/behavior.test.ts`; `src/lib/pulse/queries.ts` (`loadSwapHistory`) + `src/lib/pulse/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing behavior tests** in `behavior.test.ts` (extend the `row` helper to take an optional reason):

```ts
const rowR = (fromExerciseId: string, d: number, reason: string | null = null): SwapHistoryRow =>
    ({ fromExerciseId, createdAt: daysAgo(d), reason });

it('excludes constraint-reason swaps from demote', () => {
    const rows = [rowR('a', 1, 'pain'), rowR('a', 2, 'no_equipment'), rowR('a', 3, 'crowded')];
    expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
});
it('a single constraint row keeps an exercise under the threshold', () => {
    const rows = [rowR('a', 1), rowR('a', 2), rowR('a', 3, 'pain')]; // only 2 count
    expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
});
it('null-reason (preference) rows still count', () => {
    const rows = [rowR('a', 1), rowR('a', 2), rowR('a', 3)];
    expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a'] });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement.** In `behavior.ts`, add `reason` to `SwapHistoryRow` and a constraint skip in `analyzeSwapBehavior`:

```ts
export interface SwapHistoryRow {
    fromExerciseId: string;
    createdAt: string;
    reason?: string | null; // #8: pain/no_equipment/crowded excluded from demote; null = preference (counts)
}
// ...inside the loop, before counting:
const CONSTRAINT_REASONS = new Set(['pain', 'no_equipment', 'crowded']);
for (const r of rows) {
    if (r.reason != null && CONSTRAINT_REASONS.has(r.reason)) continue; // #8: constraints don't teach
    const age = opts.nowMs - Date.parse(r.createdAt);
    if (Number.isNaN(age) || age > opts.recencyMs) continue;
    counts.set(r.fromExerciseId, (counts.get(r.fromExerciseId) ?? 0) + 1);
}
```
(Define `CONSTRAINT_REASONS` at module scope, not inside the fn.)

- [ ] **Step 4:** `queries.ts` `loadSwapHistory`: add `reason` to the select + map:

```ts
.select('from_exercise_id, created_at, reason')
// ...
.map((r) => ({ fromExerciseId: r.from_exercise_id as string, createdAt: r.created_at as string, reason: (r.reason ?? null) as string | null }));
```

- [ ] **Step 5:** Update the pinned `queries.test.ts` assertion (~line 270) and its mapped-row expectation:

```ts
expect(calls.select).toBe('from_exercise_id, created_at, reason');
// add reason: null (or a value) to the mock data rows + expected mapped rows
```

- [ ] **Step 6: Run, verify pass.** Run `behavior.test.ts` + `queries.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pulse/behavior.ts src/lib/pulse/__tests__/behavior.test.ts src/lib/pulse/queries.ts src/lib/pulse/__tests__/queries.test.ts
git commit -m "feat(pulse): behavior learning ignores constraint-reason swaps (#8)"
```

---

## Task 7: Full verification

- [ ] **Step 1: Full suite + typecheck**

Run: `bun run test:run && bun run typecheck`
Expected: all green (was 1014; +~12 new). Fix straggler fixtures inline (any full `DbExercise` literal a stricter type flags, any context mock missing the widened `setSwap`, any `ExerciseSwapPicker` render passing `originalName`).

- [ ] **Step 2: em-dash sweep**

Run: `git diff main...HEAD --name-only | grep -E '\.(ts|tsx|md|sql)$' | xargs grep -l "[em-dash]"` (none in newly authored prose/code).

---

## Task 8: Code review + second opinion, then FINISH

- [ ] **Step 1:** Code review the full diff (code-reviewer subagent) + an adversarial second opinion (focus: the tiered ranking correctness + "class wins", the #7 filter, the picker prop changes, no behavior regression for un-tagged swaps). Address findings (commit fixes).
- [ ] **Step 2: FINISH ritual.** Move #8 to Shipped in `docs/roadmap.md` (dated bullet, mark the Tier 3 #8 row shipped), set `In progress:` -> `(none)`, refresh the test count. Update `CLAUDE.md`'s "Routine generation" section: the swap-reason model, `rankSubstitutes` tiers, the `DbExercise` enrichment, the `captureReason`-gated picker, and the #7 preference-only filter; note the named follow-ons (contraindication-aware pain across profile restrictions, no_equipment -> equipment profiles, substitution.ts extraction, cross-pattern same-stimulus).
- [ ] **Step 3: Commit** the FINISH sync.

```bash
git add docs/roadmap.md CLAUDE.md
git commit -m "docs(roadmap): ship smart substitution v2 (#8)"
```

---

## Self-review (spec coverage)

- Reason capture (data + action + hook + context): Tasks 1, 4.
- DbExercise enrichment (substitution_class + contraindications): Task 2.
- Tiered reason-aware ranking, same-stimulus dominates, pain = contraindication-aware: Task 3.
- Reason chips gated to LogView, ranked Suggested top-3 + why-caption: Task 5.
- #7 preference-only filter (pure, null counts) + pinned-test update: Task 6.
- Out-of-scope items (cross-pattern, contraindication-aware-across-restrictions pain, no_equipment->profiles, substitution.ts extraction, stored-reason read-back): not implemented, by design.
- Tests: "class wins" + per-reason + tiebreak + graceful degradation (Task 3); constraint-excluded + single-constraint-under-threshold + null-counts (Task 6); chips render/toggle/re-rank/onSelect-carries-reason + gating (Task 5).
