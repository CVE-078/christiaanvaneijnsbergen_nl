# Auto-progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-advance each set's target weight and reps using double progression — climb reps within the rep range, then add weight and reset to the bottom — pre-filled in SetLogger.

**Architecture:** One new pure function `computeProgression` in `utils.ts` replaces the weight-only `computeSuggestion` inside SetLogger. SetLogger pre-fills both weight and reps from it and shows a small target hint. The rep range is threaded in from ExerciseCard and WorkoutModeScreen. Computed on the fly — no persistence, no migration.

**Tech Stack:** TypeScript, React 19, Vitest + Testing Library, Tailwind v4 (Slate tokens).

**Spec:** `docs/superpowers/specs/2026-06-03-auto-progression-design.md`

---

## Task 1: `computeProgression` pure function

**Files:**
- Modify: `src/lib/pulse/utils.ts` (add `computeProgression` near `computeSuggestion`, ~line 130)
- Test: `src/lib/pulse/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/pulse/__tests__/utils.test.ts`. First add `computeProgression` to the import block from `../utils` (the block starting at line 2). Then append this describe block at the end of the file:

```ts
describe('computeProgression', () => {
    it('returns null on week 1 or with no previous entry', () => {
        expect(computeProgression(undefined, '8-12', 3)).toBeNull();
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8-12', 1)).toBeNull();
    });

    it('adds a rep when mid-range and the set met target RIR', () => {
        // week 2 → targetRIR = getRIR(1) = 3; rir 3 >= 3, reps 8 < hi 12 → same kg, reps+1
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8-12', 2)).toEqual({
            kg: 60,
            reps: 9,
        });
    });

    it('adds weight and resets reps to the bottom when the top of the range is reached', () => {
        // rir 3 >= 3, reps 12 >= hi 12 → +2.5 kg, reps reset to lo 8
        expect(computeProgression({ kg: 60, reps: 12, rir: 3, saved: true }, '8-12', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('adds weight when the set was easier than target at the top of the range', () => {
        // rir 4 > 3, reps 12 >= 12 → +2.5, reps 8
        expect(computeProgression({ kg: 60, reps: 12, rir: 4, saved: true }, '8-12', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('deloads weight and resets reps when the set was harder than target', () => {
        // rir 2 < 3 → kg-2.5, reps reset to lo 8
        expect(computeProgression({ kg: 60, reps: 8, rir: 2, saved: true }, '8-12', 2)).toEqual({
            kg: 57.5,
            reps: 8,
        });
    });

    it('clamps the deload to MIN_KG', () => {
        expect(computeProgression({ kg: 2, reps: 8, rir: 1, saved: true }, '8-12', 2)).toEqual({
            kg: 0.5,
            reps: 8,
        });
    });

    it('treats a single-number rep target as linear weight progression', () => {
        // lo === hi === 8; reps 8 >= 8 and rir met → weight bump
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '8', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });

    it('falls back to last-session reps when the range string has no numbers', () => {
        // no numbers → lo = hi = previous reps (8); reps 8 >= 8 → weight bump (backward compatible)
        expect(computeProgression({ kg: 60, reps: 8, rir: 3, saved: true }, '', 2)).toEqual({
            kg: 62.5,
            reps: 8,
        });
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "computeProgression"`
Expected: FAIL — `computeProgression is not a function` (not exported yet).

- [ ] **Step 3: Implement `computeProgression`**

In `src/lib/pulse/utils.ts`, add directly below the existing `computeSuggestion` function (it ends around line 136):

```ts
// Double progression: climb reps inside the rep range first, then add weight and
// reset to the bottom of the range. Compares the current set to the same set's
// previous session (previousEntry). Returns the next target { kg, reps }, or null
// when there is no history to progress from (week 1 / no previous entry).
//   - Harder than planned (rir < targetRIR)      -> deload weight, reps = lo
//   - Met/beat and at the top of the range        -> +2.5 kg, reps = lo
//   - Met/beat and mid-range                       -> same kg, reps + 1 (capped at hi)
// A single-number rep target (lo === hi) reduces to linear weight progression.
export function computeProgression(
    previousEntry: LogEntry | undefined,
    repsRange: string,
    week: number,
): { kg: number; reps: number } | null {
    if (!previousEntry || week <= 1) return null;
    const targetRIR = getRIR(week - 1);
    const nums = (repsRange.match(/\d+/g) ?? []).map(Number);
    const lo = nums.length ? nums[0] : previousEntry.reps;
    const hi = nums.length ? nums[nums.length - 1] : previousEntry.reps;
    if (previousEntry.rir < targetRIR) {
        return { kg: Math.max(previousEntry.kg - 2.5, MIN_KG), reps: lo };
    }
    if (previousEntry.reps >= hi) {
        return { kg: previousEntry.kg + 2.5, reps: lo };
    }
    return { kg: previousEntry.kg, reps: Math.min(previousEntry.reps + 1, hi) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts -t "computeProgression"`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(progression): computeProgression double-progression pure function"
```

---

## Task 2: SetLogger uses `computeProgression` (pre-fill weight + reps + target hint)

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx`
- Test: `src/components/pulse/__tests__/SetLogger.test.tsx`

- [ ] **Step 1: Write/adjust the failing tests**

In `src/components/pulse/__tests__/SetLogger.test.tsx`, replace the test named `pre-fills kg input with suggested weight when previous RIR exceeded target` (around line 90) with these two tests, and add `repsRange` where needed:

```ts
    it('pre-fills weight and reps and shows the target hint when the top of the range is hit', () => {
        // week 2, targetRIR = getRIR(1) = 3; rir 3 >= 3 and reps 12 >= hi 12 → 62.5 × 8
        const prev: LogEntry = { kg: 60, reps: 12, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(62.5);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(8);
        expect(screen.getByLabelText(/auto-progression target/i)).toHaveTextContent('62.5');
    });

    it('pre-fills a rep bump when mid-range', () => {
        // reps 8 < hi 12 → same weight, reps 9
        const prev: LogEntry = { kg: 60, reps: 8, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(60);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(9);
    });

    it('shows no target hint when there is no previous entry', () => {
        render(<SetLogger {...defaultProps} repsRange="8-12" />);
        expect(screen.queryByLabelText(/auto-progression target/i)).not.toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(null);
    });
```

Note: the existing test `shows previous week reference when previousEntry is provided and set is unsaved` (the `→ 60 kg × 8` hint) stays unchanged — that hint is separate from the target hint and still renders.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Expected: FAIL — `repsRange` not a prop yet / reps input not pre-filled / no `auto-progression target` element.

- [ ] **Step 3: Add the `repsRange` prop and swap to `computeProgression`**

In `src/components/pulse/SetLogger.tsx`:

(a) Update the import on line 3:

```ts
import { getRIR, computeProgression, toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
```

(b) Add `repsRange` to the `Props` interface (after `previousEntry?: LogEntry;`, ~line 13):

```ts
    repsRange?: string;
```

(c) Update the component signature (line 23) to destructure it:

```ts
export default function SetLogger({ setIdx, week, entry, previousEntry, repsRange, isPR, unit, onSave, onDelete }: Props) {
    const progression = computeProgression(previousEntry, repsRange ?? '', week);
```

(d) Replace `initKg` (lines 26–30) and the `reps` initial state (line 33):

```ts
    function initKg() {
        if (entry?.kg !== undefined) return String(toDisplay(entry.kg, unit));
        if (progression) return String(toDisplay(progression.kg, unit));
        return '';
    }

    function initReps() {
        if (entry?.reps !== undefined) return String(entry.reps);
        if (progression) return String(progression.reps);
        return '';
    }

    const [kg, setKg] = useState(initKg);
    const [reps, setReps] = useState(initReps);
```

(e) Update the `[unit]` re-sync effect (lines 45–51) to use `progression` for both fields:

```ts
    useEffect(() => {
        if (!saved || editing) {
            const baseKg = entry?.kg ?? progression?.kg ?? null;
            if (baseKg !== null) setKg(String(toDisplay(baseKg, unit)));
            const baseReps = entry?.reps ?? progression?.reps ?? null;
            if (baseReps !== null) setReps(String(baseReps));
            setDrops(entry?.drops?.map((d) => ({ kg: String(toDisplay(d.kg, unit)), reps: String(d.reps) })) ?? []);
        }
    }, [unit]);
```

- [ ] **Step 4: Add the target hint in the render**

In `src/components/pulse/SetLogger.tsx`, immediately after the `{previousEntry && ( ... )}` block (the `→ {prev} × {reps}` hint, ends ~line 190), add:

```tsx
                            {progression && (
                                <span
                                    aria-label="Auto-progression target"
                                    className="font-pulse text-[0.75rem] text-pulse-accent tracking-[0.04em]">
                                    ↑ target {toDisplay(progression.kg, unit)} {unit} × {progression.reps}
                                </span>
                            )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Expected: PASS (all tests, including the unchanged previous-week reference test).

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/SetLogger.tsx src/components/pulse/__tests__/SetLogger.test.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(progression): SetLogger pre-fills weight+reps and shows the target hint"
```

---

## Task 3: Thread `repsRange` from the call sites

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx` (the `<SetLogger>` at ~line 186)
- Modify: `src/components/pulse/WorkoutModeScreen.tsx` (three `<SetLogger>` blocks: ~line 55, ~line 112, ~line 143)

- [ ] **Step 1: Pass `repsRange` in ExerciseCard**

In `src/components/pulse/ExerciseCard.tsx`, in the `<SetLogger>` props (~line 186), add `repsRange={re.reps}` next to `previousEntry`:

```tsx
                                    previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                    repsRange={re.reps}
```

- [ ] **Step 2: Pass `repsRange` in WorkoutModeScreen (single-exercise block, ~line 55)**

Add `repsRange={re.reps}` next to `previousEntry`:

```tsx
                            previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                            repsRange={re.reps}
```

- [ ] **Step 3: Pass `repsRange` in WorkoutModeScreen (superset first, ~line 112)**

```tsx
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                repsRange={first.reps}
```

- [ ] **Step 4: Pass `repsRange` in WorkoutModeScreen (superset second, ~line 143)**

```tsx
                                previousEntry={week > 1 && logs[prevKey]?.saved ? logs[prevKey] : undefined}
                                repsRange={second.reps}
```

- [ ] **Step 5: Verify typecheck + the affected component tests pass**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run src/components/pulse/__tests__/ExerciseCard.test.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`
Expected: PASS (no behavioural assertions change; this just confirms nothing broke).

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/ExerciseCard.tsx src/components/pulse/WorkoutModeScreen.tsx
GIT_CONFIG_GLOBAL=/dev/null git commit -m "feat(progression): thread rep range into SetLogger from card and guided mode"
```

---

## Task 4: Remove the now-unused `computeSuggestion`

**Files:**
- Modify: `src/lib/pulse/utils.ts` (delete `computeSuggestion`, ~lines 130–136)
- Modify: `src/lib/pulse/__tests__/utils.test.ts` (delete the `computeSuggestion` describe block, ~lines 250–271, and remove it from the import)

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "computeSuggestion" src/`
Expected: only the definition in `utils.ts`, its export, and the test file — no app/component usage (SetLogger switched in Task 2).

- [ ] **Step 2: Delete `computeSuggestion` and its tests**

In `src/lib/pulse/utils.ts`, delete the entire `computeSuggestion` function:

```ts
export function computeSuggestion(previousEntry: LogEntry | undefined, week: number): number | null {
    if (!previousEntry || week <= 1) return null;
    const prevTargetRIR = getRIR(week - 1);
    if (previousEntry.rir > prevTargetRIR) return previousEntry.kg + 2.5;
    if (previousEntry.rir === prevTargetRIR) return previousEntry.kg;
    return Math.max(previousEntry.kg - 2.5, MIN_KG);
}
```

In `src/lib/pulse/__tests__/utils.test.ts`, remove `computeSuggestion,` from the import block (line ~13) and delete the whole `describe('computeSuggestion', () => { ... })` block (~lines 250–271).

- [ ] **Step 3: Verify**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run test:run src/lib/pulse/__tests__/utils.test.ts`
Expected: PASS (computeProgression tests present, computeSuggestion tests gone).

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts
GIT_CONFIG_GLOBAL=/dev/null git commit -m "refactor(progression): remove unused computeSuggestion"
```

---

## Task 5: Final verification

- [ ] **Step 1:** `bun run typecheck` — no errors.
- [ ] **Step 2:** `bun run test:run` — all suites green.
- [ ] **Step 3:** `bun run lint` — no new warnings (2 pre-existing `exhaustive-deps` warnings in `SetLogger.tsx` and `RoutinesTab.tsx` are acceptable; do not add new ones — the SetLogger `[unit]` effect keeps its existing `eslint-disable` line).
- [ ] **Step 4:** Format only the touched files:

```bash
bunx prettier --write src/lib/pulse/utils.ts src/lib/pulse/__tests__/utils.test.ts src/components/pulse/SetLogger.tsx src/components/pulse/__tests__/SetLogger.test.tsx src/components/pulse/ExerciseCard.tsx src/components/pulse/WorkoutModeScreen.tsx
```

- [ ] **Step 5:** Update `docs/roadmap.md` — move **Auto-progression** from the "Later" table to "Shipped" with a one-line description, then commit:

```bash
git add docs/roadmap.md
GIT_CONFIG_GLOBAL=/dev/null git commit -m "docs(roadmap): mark auto-progression shipped"
```

---

## Self-review notes

- **Spec coverage:** `computeProgression` (Task 1) implements the three-branch double-progression rule, the `null` guards, the single-number/empty-range fallbacks, and the `MIN_KG` clamp. SetLogger pre-fill of weight+reps and the target hint (Task 2). `repsRange` threading from both render paths (Task 3). `computeSuggestion` removal (Task 4). Always-on / no migration is inherent (no persistence touched). Tests in Tasks 1–2.
- **Backward compatibility:** the empty-range fallback (`lo = hi = previousEntry.reps`) keeps the legacy weight-bump behaviour, so the old "62.5" expectation still holds where a single value is used.
- **Type consistency:** `computeProgression(previousEntry, repsRange, week)` returns `{ kg: number; reps: number } | null` everywhere it is referenced; `repsRange?: string` is the prop name in both SetLogger and every call site.
