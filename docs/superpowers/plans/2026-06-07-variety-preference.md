# Variety Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `VarietyPreference` ('consistent' | 'varied') that, when `consistent`, anchors the main compound lifts across sessions during generation while accessories keep rotating; `varied` (the default) reproduces today's output byte-identical.

**Architecture:** Layered exactly like the shipped `training_style` axis. A new pure constant + anchor-map logic in the slot selector (`generation.ts`), a nullable profile column round-tripped through `queries.ts` + the generate action, the value threaded through the hook/context into the generator, and an optional `RoutineSetupFlow` step. Fully orthogonal to training style (different pipeline layer: variety picks *which* exercise fills a slot, style sets *how* it is trained). See `docs/superpowers/specs/2026-06-07-variety-preference-design.md`.

**Tech Stack:** TypeScript (strict), React 19, Supabase, Vitest + Testing Library.

**Grouping for subagent-driven execution** (per the established pattern):
- **G1 = Tasks 1 + 2** (types + generation logic, one lib domain): one implementer, one reviewer over the group diff.
- **G2 = Tasks 3 + 4 + 5** (profile read + generate action + hook/context threading, tightly coupled backend): one implementer, one reviewer.
- **G3 = Task 6** (RoutineSetupFlow step + step-counter math + 3 consumers, the risky integration): full two-stage review (spec compliance, then code quality).
- **G4 = Task 7** (migration + doc sync): done inline by the controller, not a subagent (needs session context).
- Final whole-branch review after all groups.

---

## Task 1: `VarietyPreference` type + profile field

**Files:**
- Modify: `src/lib/pulse/types.ts` (near the `TrainingStyle` type at ~412 and the `Profile` interface at ~49)

- [ ] **Step 1: Add the type next to `TrainingStyle`**

In `types.ts`, immediately after the `TrainingStyle` type (line ~412):

```ts
/** How much the generator rotates exercises across sessions. 'varied' is the
 *  identity (today's behaviour: prefer a not-yet-used exercise per slot).
 *  'consistent' anchors the main compound lifts across sessions (progressive
 *  overload + skill) while accessories keep rotating. Stored nullable on the
 *  profile; null resolves to 'varied' only at the generation boundary. */
export type VarietyPreference = 'consistent' | 'varied';
```

- [ ] **Step 2: Add the profile field**

In the `Profile` interface, immediately after the `training_style` line (line ~59):

```ts
    // How much generation rotates exercises; seeds generation. null = never chosen ('varied').
    variety_preference: VarietyPreference | null;
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS (this will surface that `DEFAULT_PROFILE` / any `Profile` literal needs the new field; fix those in the tasks that own them — `useProfile`'s default is handled in Task 3's note. If typecheck flags `useProfile.ts`'s `training_style: null` default object, add `variety_preference: null` beside it.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/types.ts
git commit -m "feat(pulse): add VarietyPreference type and profile field"
```

---

## Task 2: Anchor logic in the generator (TDD)

**Files:**
- Modify: `src/lib/pulse/generation.ts` (imports ~1-16; new constant near `POWERBUILDING_HEAVY_PATTERNS` ~447; `selectForSession` ~510; `GenerationInput` ~619; `generateRoutine` ~653)
- Test: `src/lib/pulse/__tests__/generation.test.ts` (new describe block at the end, after the `buildRationale trainingStyle clause` block)

- [ ] **Step 1: Write the failing tests**

Append to `generation.test.ts`. The `input`, `deepPool`, and `STYLES` helpers already exist in the file. Use `fb-hmhp-4` (every session is full-body, so `squat` and the other compounds recur across all 4 sessions, the only split where anchoring is observable). Import `COMPOUND_ANCHOR_PATTERNS` at the top of the file (add to the existing `from '@/lib/pulse/generation'` import) and `MovementPattern` is already imported.

```ts
// ── 11. generateRoutine + varietyPreference ──────────────────────────────────

describe('generateRoutine + varietyPreference', () => {
    const fbStyle = STYLES[4].find((s) => s.key === 'fb-hmhp-4') as ProgramStyle;
    const fbDays = [1, 2, 4, 5];

    // Map exercise_id -> movement_pattern via the pool used by `input()`.
    const patternOf = (pool: ExerciseMeta[]) => new Map(pool.map((e) => [e.id, e.movement_pattern]));
    const distinctFor = (
        bp: ReturnType<typeof generateRoutine>,
        pool: ExerciseMeta[],
        pattern: MovementPattern,
    ) => {
        const pat = patternOf(pool);
        return new Set(bp.exercises.filter((e) => pat.get(e.exercise_id) === pattern).map((e) => e.exercise_id));
    };
    const countFor = (bp: ReturnType<typeof generateRoutine>, pool: ExerciseMeta[], pattern: MovementPattern) => {
        const pat = patternOf(pool);
        return bp.exercises.filter((e) => pat.get(e.exercise_id) === pattern).length;
    };

    it("'varied' and undefined produce identical output (identity)", () => {
        for (const a of [{ days: [1, 3, 5] }, { days: [1, 2, 4, 5] }, { days: [1, 2, 3, 4, 5, 6] }]) {
            const style = STYLES[a.days.length][0] as ProgramStyle;
            const base = generateRoutine(input({ style, trainingDays: a.days }));
            const varied = generateRoutine(input({ style, trainingDays: a.days, varietyPreference: 'varied' }));
            expect(varied).toEqual(base);
        }
    });

    it("'consistent' is deterministic (same input twice -> identical output)", () => {
        const a = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, varietyPreference: 'consistent' }));
        const b = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, varietyPreference: 'consistent' }));
        expect(a).toEqual(b);
    });

    it("'consistent' anchors each recurring compound to one exercise across sessions", () => {
        const pool = deepPool();
        const bp = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }));
        // Every compound anchor pattern that appears more than once uses exactly one exercise.
        for (const p of COMPOUND_ANCHOR_PATTERNS) {
            if (countFor(bp, pool, p) > 1) {
                expect(distinctFor(bp, pool, p).size).toBe(1);
            }
        }
    });

    it("'varied' (default) lets at least one recurring compound rotate across sessions", () => {
        const pool = deepPool();
        const bp = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'varied' }));
        const rotated = [...COMPOUND_ANCHOR_PATTERNS].some(
            (p) => countFor(bp, pool, p) > 1 && distinctFor(bp, pool, p).size > 1,
        );
        expect(rotated).toBe(true);
    });

    it("'consistent' still rotates accessories (isolation is not anchored)", () => {
        const pool = deepPool();
        const bp = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }));
        // At least one isolation pattern that recurs uses more than one exercise.
        const isoRotated = (['biceps_iso', 'triceps_iso', 'chest_iso', 'back_iso', 'shoulder_iso', 'glute_iso'] as MovementPattern[]).some(
            (p) => countFor(bp, pool, p) > 1 && distinctFor(bp, pool, p).size > 1,
        );
        expect(isoRotated).toBe(true);
    });

    it("'consistent' never repeats an exercise within one session", () => {
        const pool = deepPool();
        const bp = generateRoutine(input({ style: fbStyle, trainingDays: fbDays, pool, varietyPreference: 'consistent' }));
        for (const day of fbDays) {
            const variant = bp.schedule.find((s) => s.day_of_week === day)?.variant ?? null;
            const ids = sessionIds(bp, 'full_body', variant);
            expect(new Set(ids).size).toBe(ids.length);
        }
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts -t "varietyPreference"`
Expected: FAIL, `varietyPreference` is not yet a `GenerationInput` field and `COMPOUND_ANCHOR_PATTERNS` is not exported (compile error / behaviour mismatch).

- [ ] **Step 3: Add the `VarietyPreference` import**

In `generation.ts`, add `VarietyPreference` to the type import block (lines 1-16), keeping alphabetical-ish order beside `TrainingStyle`:

```ts
    TrainingStyle,
    VarietyPreference,
```

- [ ] **Step 4: Add the `COMPOUND_ANCHOR_PATTERNS` constant**

In `generation.ts`, immediately after the `POWERBUILDING_HEAVY_PATTERNS` block (ends ~452):

```ts
/** Main bilateral compound patterns anchored across sessions under the
 *  'consistent' variety preference, so the same squat/press/row recurs for
 *  progressive overload and skill. Broader than POWERBUILDING_HEAVY_PATTERNS
 *  (which is about rep ranges, not skill): rows and vertical pulls belong here.
 *  `lunge` is excluded (unilateral accessory). Kept SEPARATE from
 *  POWERBUILDING_HEAVY_PATTERNS so a change to one never silently changes the
 *  other. NOTE: anchors are per-generation and never persisted; generation runs
 *  once at routine creation, so this does not interact with ramp-back today. The
 *  only thing that would reopen that is mid-program regeneration, at which point
 *  reconsider whether the anchor map should be preserved or reset. */
export const COMPOUND_ANCHOR_PATTERNS: ReadonlySet<MovementPattern> = new Set([
    'squat',
    'hinge',
    'horizontal_push',
    'vertical_push',
    'horizontal_pull',
    'vertical_pull',
]);
```

- [ ] **Step 5: Thread `varietyPreference` + anchor map into `selectForSession`**

Replace the `selectForSession` signature and `pick` helper (lines 510-548). New version:

```ts
function selectForSession(
    emphasis: Emphasis,
    count: number,
    usable: ExerciseMeta[],
    used: Set<string>,
    variety: VarietyPreference,
    anchors: Map<MovementPattern, string>,
): Selected[] {
    const byPattern = (p: MovementPattern) =>
        usable.filter((ex) => ex.movement_pattern === p).sort((a, b) => a.id.localeCompare(b.id));

    const chosen: Selected[] = [];
    const chosenIds = new Set<string>();

    const push = (ex: ExerciseMeta, slot: MovementPattern) => {
        chosen.push({ ex, pattern: slot });
        chosenIds.add(ex.id);
        used.add(ex.id);
    };

    const pick = (slot: MovementPattern): boolean => {
        const candidates = byPattern(slot).filter((ex) => !chosenIds.has(ex.id));
        if (candidates.length === 0) return false;

        // Variety 'consistent': anchor the main compound lifts across sessions.
        if (variety === 'consistent' && COMPOUND_ANCHOR_PATTERNS.has(slot)) {
            const anchoredId = anchors.get(slot);
            if (anchoredId) {
                // Anchor lookup takes precedence over the fresh-preference and
                // deliberately bypasses the routine-wide `used` avoid-set. Do not
                // reorder the fresh-preference ahead of this.
                const anchored = candidates.find((ex) => ex.id === anchoredId);
                if (anchored) {
                    push(anchored, slot);
                    return true;
                }
                // Defensive: anchored exercise not selectable here (e.g. a rare
                // second same-pattern slot in one session). Fall through to a
                // fresh pick WITHOUT re-anchoring. Cannot happen on a pattern's
                // first slot within one generation (usable pool is fixed).
            } else {
                // First time this pattern is filled: pick fresh, record the anchor.
                const fresh = candidates.find((ex) => !used.has(ex.id));
                const choice = fresh ?? candidates[0];
                push(choice, slot);
                anchors.set(slot, choice.id);
                return true;
            }
        }

        // Default / accessory path: prefer a candidate not yet used anywhere this
        // routine; otherwise fall back to the first (stable) candidate.
        const fresh = candidates.find((ex) => !used.has(ex.id));
        const choice = fresh ?? candidates[0];
        push(choice, slot);
        return true;
    };

    // First pass: one exercise per slot in emphasis order.
    for (const slot of emphasis.slots) {
        if (chosen.length >= count) break;
        pick(slot);
    }
    // Backfill: walk the slot list again with the same logic until count is
    // reached or no slot can yield another exercise.
    let guard = 0;
    while (chosen.length < count && guard < 50) {
        guard++;
        let added = false;
        for (const slot of emphasis.slots) {
            if (chosen.length >= count) break;
            if (pick(slot)) added = true;
        }
        if (!added) break; // pool exhausted for this emphasis
    }
    return chosen;
}
```

Keep the existing doc comment above the function; append one sentence: `Under 'consistent', a routine-wide anchor map pins the first-chosen exercise for each compound pattern so it recurs across sessions; accessories keep the fresh-preference.`

- [ ] **Step 6: Add the `GenerationInput` field**

In `GenerationInput` (after `trainingStyle?` at ~629):

```ts
    /** How much to rotate exercises across sessions. Absent / 'varied' is the
     *  no-op identity path; 'consistent' anchors the main compounds. */
    varietyPreference?: VarietyPreference;
```

- [ ] **Step 7: Resolve + thread in `generateRoutine`**

In `generateRoutine` (after `const used = new Set<string>();` at ~661):

```ts
    const variety = input.varietyPreference ?? 'varied';
    // Routine-wide anchor map (per-generation, never persisted) used only under
    // 'consistent' to keep the main compounds the same across sessions.
    const anchors = new Map<MovementPattern, string>();
```

Then update the `selectForSession` call (line ~675):

```ts
        const selected = selectForSession(emphasis, exCount, usable, used, variety, anchors);
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun run test:run src/lib/pulse/__tests__/generation.test.ts -t "varietyPreference"`
Expected: PASS (all 6). Then run the whole file to confirm no regression: `bun run test:run src/lib/pulse/__tests__/generation.test.ts` — expect all green (the existing identity/equipment/superset suites prove `varied` is unchanged).

- [ ] **Step 9: Typecheck + commit**

```bash
bun run typecheck
git add src/lib/pulse/generation.ts src/lib/pulse/__tests__/generation.test.ts
git commit -m "feat(pulse): anchor main compounds under consistent variety preference"
```

---

## Task 3: Round-trip `variety_preference` through the profile read

**Files:**
- Modify: `src/lib/pulse/queries.ts` (`PROFILE_SELECT` ~28, the `*_VALUES` consts ~30-31, the mapper ~78-85)
- Modify: `src/hooks/pulse/useProfile.ts` ONLY if typecheck flags its default object (add `variety_preference: null`)

- [ ] **Step 1: Add to `PROFILE_SELECT`**

Append `, variety_preference` to the select string (line ~29):

```ts
const PROFILE_SELECT =
    'display_name, unit, length_unit, active_routine_id, onboarding_completed, goal_weight_kg, gender, priority_muscle, timezone, accent_color, training_style, variety_preference';
```

- [ ] **Step 2: Add the value list**

After `const TRAINING_STYLE_VALUES = [...]` (line ~31):

```ts
const VARIETY_PREFERENCE_VALUES = ['consistent', 'varied'];
```

- [ ] **Step 3: Add the guarded mapper field**

In the returned profile object, after the `training_style:` mapper (line ~85), mirroring it exactly:

```ts
        variety_preference:
            data && (VARIETY_PREFERENCE_VALUES as readonly string[]).includes(data.variety_preference as string)
                ? (data.variety_preference as Profile['variety_preference'])
                : null,
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS. If it flags a `Profile` literal missing `variety_preference` (e.g. `DEFAULT_PROFILE` in `useProfile.ts` at ~44 beside `training_style: null`), add `variety_preference: null` there. Make no other `useProfile` changes (no setter, per spec).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/queries.ts src/hooks/pulse/useProfile.ts
git commit -m "feat(pulse): surface variety_preference on the profile read"
```

---

## Task 4: `varietyPreference` param on the generate action

**Files:**
- Modify: `src/app/pulse/actions/routines.ts` (`generateAndSaveRoutine` signature ~378, validation ~395, profile select ~422, resolve ~426, generateRoutine call ~444, profile upsert ~494)
- Import: add `VarietyPreference` to the `types` import in this file

- [ ] **Step 1: Add the param to the signature**

After `trainingStyle?: TrainingStyle,` (line ~384):

```ts
    varietyPreference?: VarietyPreference,
```

- [ ] **Step 2: Validate it**

After the `TRAINING_STYLE_VALUES` guard (line ~396):

```ts
    const VARIETY_PREFERENCE_VALUES = ['consistent', 'varied'] as const;
    if (varietyPreference !== undefined && !VARIETY_PREFERENCE_VALUES.includes(varietyPreference))
        throw new Error('Invalid data');
```

- [ ] **Step 3: Read + resolve from the profile**

Extend the profile select (line ~422) to include the column:

```ts
        .select('priority_muscle, gender, training_style, variety_preference')
```

After `const resolvedTrainingStyle = ...` (line ~426):

```ts
    // Param wins over the stored value, which falls back to 'varied' (identity).
    const resolvedVariety: VarietyPreference =
        varietyPreference ?? (profileRow?.variety_preference as VarietyPreference) ?? 'varied';
```

- [ ] **Step 4: Pass it to the generator**

In the `generateRoutine({ ... })` call (line ~451, after `trainingStyle: resolvedTrainingStyle,`):

```ts
        varietyPreference: resolvedVariety,
```

- [ ] **Step 5: Write it back to the profile**

In the final profile upsert (line ~494), add the column:

```ts
        .upsert(
            { id: user.id, active_routine_id: routine.id, training_style: resolvedTrainingStyle, variety_preference: resolvedVariety },
            { onConflict: 'id' },
        );
```

- [ ] **Step 6: Typecheck + commit**

```bash
bun run typecheck
git add src/app/pulse/actions/routines.ts
git commit -m "feat(pulse): thread varietyPreference through generateAndSaveRoutine"
```

---

## Task 5: Thread the param through the hook + context

**Files:**
- Modify: `src/hooks/pulse/useRoutines.ts` (`generateRoutine` callback ~208-217)
- Modify: `src/context/PulseContext.ts` (`generateRoutine` signature ~165-171)
- Import: add `VarietyPreference` to the `types` import in both files

- [ ] **Step 1: Extend the `useRoutines` callback**

In the `generateRoutine` `useCallback` (lines ~208-217), add the param after `trainingStyle?: TrainingStyle,` and forward it:

```ts
            trainingStyle?: TrainingStyle,
            varietyPreference?: VarietyPreference,
        ) => {
            const routine = await serverGenerateRoutine(
                answers,
                trainingDays,
                sessionTime,
                styleKey,
                name,
                trainingStyle,
                varietyPreference,
            );
```

(Adjust to match the existing call's exact argument layout; the new arg is last.)

- [ ] **Step 2: Sync the context type**

In `PulseContext.ts`, the `generateRoutine` member signature (lines ~165-171), add after `trainingStyle?: TrainingStyle,`:

```ts
        varietyPreference?: VarietyPreference,
```

- [ ] **Step 3: Typecheck + commit**

Run: `bun run typecheck`
Expected: PASS (the context contract and the hook now agree; consumers that don't pass the optional arg still compile).

```bash
git add src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts
git commit -m "feat(pulse): thread varietyPreference through hook and context"
```

---

## Task 6: `RoutineSetupFlow` variety step + consumers (integration)

**Files:**
- Modify: `src/components/pulse/RoutineSetupFlow.tsx`
- Modify: `src/components/pulse/GenerateRoutineButton.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`
- Modify: `src/components/pulse/views/TemplatesTab.tsx`
- Test: `src/components/pulse/__tests__/RoutineSetupFlow.test.tsx` (extend if present; otherwise add a focused step test)

This is the delicate task: the step-counter math is computed relative to `total`. Read the spec's Decision 1 and 5 first. The new `variety` step sits **after** `train_style` and **before** `length` (both how-to-train choices precede the two shape-your-program choices). It is gated by a new `collectVariety` prop (default true; `TemplatesTab` passes false, like `collectTrainingStyle`).

- [ ] **Step 1: Add imports + the options list**

Add `VarietyPreference` to the `types` import (line 7). After `TRAINING_STYLE_OPTIONS` (line ~109):

```tsx
const VARIETY_OPTIONS: { key: VarietyPreference; label: string; desc: string }[] = [
    { key: 'varied', label: 'Varied', desc: 'Rotate exercises across sessions for fresh stimulus.' },
    { key: 'consistent', label: 'Consistent', desc: 'Keep your main lifts the same each week, rotate the accessories.' },
];
```

- [ ] **Step 2: Add the step to the `Step` union + the step-sequence comment**

Update the comment block (lines 10-16) to mention `'variety'` between `'train_style'` and `'length'`, then the union (line 17):

```tsx
type Step = 'gender' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'train_style' | 'variety' | 'length' | 'start';
```

- [ ] **Step 3: Add the prop + state**

Add to `Props` (after `collectTrainingStyle?` at ~161):

```tsx
    /** Show the "How varied?" step. Default true; template cloning sets this
     *  false because a fixed template can't be re-varied. */
    collectVariety?: boolean;
```

Destructure it in the component params (after `collectTrainingStyle = true,` at ~171): `collectVariety = true,`. Add state beside `trainingStyle` (~189):

```tsx
    const [varietyPreference, setVarietyPreference] = useState<VarietyPreference>('varied');
```

- [ ] **Step 4: Update the `total` formula + the result type/payload**

`total` (line ~212), add one optional step:

```tsx
    const total = 8 + genderOffset + (showStyleStep ? 1 : 0) + (collectTrainingStyle ? 1 : 0) + (collectVariety ? 1 : 0);
```

Update the comment above it to list the training-style AND variety steps as optional. Add to `RoutineSetupResult` (after `trainingStyle` at ~138):

```tsx
    /** Chosen variety preference; always set (defaults to 'varied'). Generate
     *  consumers pass it to generateRoutine; the template consumer ignores it. */
    varietyPreference: VarietyPreference;
```

In `handleComplete`'s `onComplete({ ... })` (after `trainingStyle,` at ~246):

```tsx
                    varietyPreference,
```

- [ ] **Step 5: Fix the tail-step navigation chain + numbers**

The tail order is now: session-time(7) -> [train_style?] -> [variety?] -> length -> start. Update these exact spots:

1. **Session-time `Header` stepNum** (line ~642) and its **Next** (line ~672). The session-time step is the render fall-through at the bottom. Change its Header to subtract the variety step too, and its Next to route to the first present tail step:

```tsx
                <Header
                    stepNum={total - 2 - (collectTrainingStyle ? 1 : 0) - (collectVariety ? 1 : 0)}
                    total={total}
                    onBack={() => setStep(showStyleStep ? 6 : 5)}
                />
```

```tsx
                <button
                    onClick={() => setStep(collectTrainingStyle ? 'train_style' : collectVariety ? 'variety' : 'length')}
                    disabled={!sessionTime}
                    className={BTN_PRIMARY_BLOCK}>
                    Next
                </button>
```

2. **`train_style` step** (lines ~525-550): its Header is `total - 2`; with variety after it, it becomes `total - 2 - (collectVariety ? 1 : 0)`. Its Next routes to `variety` when present, else `length`:

```tsx
                    <Header stepNum={total - 2 - (collectVariety ? 1 : 0)} total={total} onBack={() => setStep(7)} />
```

```tsx
                    <button onClick={() => setStep(collectVariety ? 'variety' : 'length')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
```

3. **New `variety` step** — insert immediately after the `train_style` block (after line ~550), mirroring its shape. Its number is `total - 2` (only length + start follow it). Back goes to `train_style` when present, else session-time (7):

```tsx
    if (step === 'variety')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 2}
                        total={total}
                        onBack={() => setStep(collectTrainingStyle ? 'train_style' : 7)}
                    />
                    <p className={Q}>How varied should it be?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Consistency builds your main lifts; variety keeps training fresh. You can change this anytime you regenerate.
                    </p>
                    <div className="flex flex-col gap-2">
                        {VARIETY_OPTIONS.map((o) => (
                            <OptionRow
                                key={o.key}
                                label={o.label}
                                desc={o.desc}
                                active={varietyPreference === o.key}
                                onClick={() => setVarietyPreference(o.key)}
                            />
                        ))}
                    </div>
                    <button onClick={() => setStep('length')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );
```

4. **`length` step** (line ~556): its **Back** must reach the nearest present prior tail step (variety, else train_style, else session-time 7). Number stays `total - 1`:

```tsx
                    <Header
                        stepNum={total - 1}
                        total={total}
                        onBack={() => setStep(collectVariety ? 'variety' : collectTrainingStyle ? 'train_style' : 7)}
                    />
```

`start` step (line ~579) is unchanged (Back -> length, number `total`).

- [ ] **Step 6: Verify the numbering by hand before testing**

Trace each branch (with the four combinations of collectTrainingStyle x collectVariety) and confirm the visible step numbers run 1..total with no gap or repeat, and Back/Next form a clean chain. Note in a comment near `total` that variety = `total - 2`, train_style = `total - 2 - (collectVariety?1:0)`, length = `total - 1`, start = `total`.

- [ ] **Step 7: Thread `varietyPreference` through the two generate consumers**

`GenerateRoutineButton.tsx` (onComplete ~27): add `varietyPreference` to the destructure and pass it as the new last arg to `generateRoutine(...)` (after `trainingStyle`):

```tsx
                    onComplete={async ({ answers, trainingDays, sessionTime, styleKey, startAnchor, programWeeks, trainingStyle, varietyPreference }) => {
                        const routine = await generateRoutine(
                            answers,
                            trainingDays,
                            sessionTime,
                            styleKey,
                            undefined,
                            trainingStyle,
                            varietyPreference,
                        );
```

(Match the existing argument list; `name` is the 5th arg, keep whatever it currently passes there.)

`OnboardingModal.tsx` (onComplete ~28): same, add `varietyPreference` to the destructure and as the last arg to `generateRoutine(...)`.

- [ ] **Step 8: Opt the template consumer out**

`TemplatesTab.tsx` (line ~181, beside `collectTrainingStyle={false}`):

```tsx
                    collectVariety={false}
```

Its `onComplete` destructure (line ~182) does not need `varietyPreference` (cloneTemplate ignores it).

- [ ] **Step 9: Test the step**

Extend `RoutineSetupFlow.test.tsx` (or add it). A focused test: render the flow, walk to the variety step, assert both options render and selecting "Consistent" then completing passes `varietyPreference: 'consistent'` to `onComplete`; and that with `collectVariety={false}` the step never appears and `onComplete` still receives `varietyPreference: 'varied'`. Match the file's existing render/advance helpers.

Run: `bun run test:run src/components/pulse/__tests__/RoutineSetupFlow.test.tsx`
Expected: PASS.

- [ ] **Step 10: Typecheck, lint, commit**

```bash
bun run typecheck && bun run lint
git add src/components/pulse/RoutineSetupFlow.tsx src/components/pulse/GenerateRoutineButton.tsx src/components/pulse/OnboardingModal.tsx src/components/pulse/views/TemplatesTab.tsx src/components/pulse/__tests__/RoutineSetupFlow.test.tsx
git commit -m "feat(pulse): variety preference step in routine setup flow"
```

---

## Task 7: Migration + doc sync (controller, inline)

**Files:**
- Create: `docs/migrations/<full-timestamp>-variety-preference.sql`
- Modify: `docs/roadmap.md`, `CLAUDE.md`

- [ ] **Step 1: Write the migration** (timestamp `yyyy-mm-dd-hh-mm-ss` per the dated-file convention)

```sql
-- Variety preference: how much generation rotates exercises across sessions.
-- Nullable; null means "never chosen" and resolves to 'varied' (identity) only
-- at the generation boundary. Mirrors profiles.training_style.
alter table public.profiles
    add column if not exists variety_preference text
    check (variety_preference in ('consistent', 'varied'));
```

- [ ] **Step 2: Roadmap workflow**

Mark `In progress:` -> variety preference at START (this should already be committed as `docs(roadmap): start variety preference` before Task 1). At FINISH: move Tier 2 #4 variety to Shipped, clear `In progress:` to `(none)`, set the In-review line to the branch, bump the test count, and sync the `CLAUDE.md` generation section (add `VarietyPreference` + `COMPOUND_ANCHOR_PATTERNS` + the anchor mechanism beside the training-style description).

- [ ] **Step 3: Full verification + commit**

```bash
bun run test:run && bun run typecheck && bun run lint
git add docs/migrations docs/roadmap.md CLAUDE.md
git commit -m "docs(roadmap): ship variety preference generation input"
```

Then hand off via superpowers:finishing-a-development-branch. Remind the user to apply the migration in the Supabase SQL editor (no automated runner in this repo).

---

## Self-Review

- **Spec coverage:** type + field (T1), anchor logic + COMPOUND_ANCHOR_PATTERNS + identity/determinism tests (T2), profile round-trip (T3), action param/resolve/writeback (T4), hook+context (T5), UI step + consumers + opt-out (T6), migration + docs (T7). The golden identity + `consistent`-determinism tests are in T2, built with the behaviour (TDD), satisfying the "test first / hard gate" requirement before the feature is wired into the action and UI. Every spec "Files touched" entry maps to a task. No standalone Profile editor and no `useProfile`/`PulseContext` setter, matching the spec's "not built" list.
- **Type consistency:** `VarietyPreference` (type), `varietyPreference` (param/field/state), `variety_preference` (DB column + Profile field + mapper) used consistently. `COMPOUND_ANCHOR_PATTERNS` named identically everywhere. The `generateRoutine` arg order (the new arg is always appended last) is consistent across action, hook, and context.
- **No placeholders:** every code step shows the code; `<full-timestamp>` resolves at migration creation per the dated-file convention.
