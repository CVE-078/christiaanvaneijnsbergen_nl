# Rich Set Types (drop / failure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drop sets (reduced-weight segments stored on the working set) and a failure tag (RIR 0) to the Pulse set logger.

**Architecture:** One nullable `drops jsonb` column on `set_logs`; `LogEntry` gains an optional `drops` array; validation, persistence (saveLogs + loadLogs), and the set-logger UI carry it through. Failure is purely a UI tag read from the existing `rir === 0`. No change to PR / volume / e1RM logic.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase, Vitest. bun. No em dashes in code/comments. Branch: `feature/rich-set-types`.

**Note on git:** commit after each task with `git -c commit.gpgsign=false commit` (the repo's local user.email is already `christiaanvaneijnsbergen@gmail.com`). Do not push.

---

## Task 1: Migration — `drops` column

**Files:**
- Create: `docs/migrations/2026-06-03-set-logs-drops.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: add drop-set segments to set_logs
-- Date: 2026-06-03
-- Apply via Supabase SQL Editor (no automated runner).
--
-- A set whose `drops` is a non-empty JSON array [{"kg":number,"reps":number}, ...]
-- is a drop set. NULL / absent = a normal set. Existing set_logs RLS policies
-- cover the new column, so no policy change is needed.

ALTER TABLE set_logs ADD COLUMN IF NOT EXISTS drops jsonb;
```

- [ ] **Step 2: Commit**

```bash
git add docs/migrations/2026-06-03-set-logs-drops.sql
git -c commit.gpgsign=false commit -m "feat(pulse): migration add set_logs.drops jsonb"
```

---

## Task 2: Type — `LogEntry.drops`

**Files:**
- Modify: `src/lib/pulse/types.ts` (the `LogEntry` interface at the top)

- [ ] **Step 1: Add the optional field**

Change `LogEntry` to:

```ts
export interface LogEntry {
    kg: number;
    reps: number;
    rir: number;
    saved: boolean;
    drops?: Array<{ kg: number; reps: number }>;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: exit 0 (optional field is backward compatible).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pulse/types.ts
git -c commit.gpgsign=false commit -m "feat(pulse): LogEntry.drops optional field"
```

---

## Task 3: Validation — accept `drops` (TDD)

**Files:**
- Modify: `src/lib/pulse/validation.ts`
- Test: `src/lib/pulse/__tests__/validation.test.ts` (create if absent)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { validateLogs } from '@/lib/pulse/validation';

const KEY = '3-11111111-1111-4111-8111-111111111111-0';
const base = { kg: 80, reps: 8, rir: 2, saved: true };

describe('validateLogs drops', () => {
    it('accepts a set with no drops', () => {
        expect(validateLogs({ [KEY]: base })).toBe(true);
    });
    it('accepts a valid drops array', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [{ kg: 60, reps: 8 }, { kg: 40, reps: 8 }] } })).toBe(true);
    });
    it('accepts an empty drops array as a normal set', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [] } })).toBe(true);
    });
    it('rejects more than 6 drop segments', () => {
        const drops = Array.from({ length: 7 }, () => ({ kg: 40, reps: 8 }));
        expect(validateLogs({ [KEY]: { ...base, drops } })).toBe(false);
    });
    it('rejects a segment with bad kg', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [{ kg: 0, reps: 8 }] } })).toBe(false);
    });
    it('rejects a segment with non-integer reps', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [{ kg: 40, reps: 8.5 }] } })).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/lib/pulse/__tests__/validation.test.ts`
Expected: the drops tests fail (drops currently ignored, so the "rejects" cases return true).

- [ ] **Step 3: Implement**

In `validateLogs`, destructure `drops` and validate after the existing `saved` check:

```ts
const { kg, reps, rir, saved, drops } = entry as Record<string, unknown>;
if (typeof kg !== 'number' || kg <= 0 || kg > 500) return false;
if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 100) return false;
if (typeof rir !== 'number' || !Number.isInteger(rir) || rir < 0 || rir > 10) return false;
if (typeof saved !== 'boolean') return false;
if (drops !== undefined && drops !== null) {
    if (!Array.isArray(drops) || drops.length > 6) return false;
    for (const d of drops) {
        if (typeof d !== 'object' || d === null) return false;
        const { kg: dkg, reps: dreps } = d as Record<string, unknown>;
        if (typeof dkg !== 'number' || dkg <= 0 || dkg > 500) return false;
        if (typeof dreps !== 'number' || !Number.isInteger(dreps) || dreps < 1 || dreps > 100) return false;
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:run src/lib/pulse/__tests__/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/validation.ts src/lib/pulse/__tests__/validation.test.ts
git -c commit.gpgsign=false commit -m "feat(pulse): validate drops in validateLogs"
```

---

## Task 4: Persistence — read and write `drops`

**Files:**
- Modify: `src/lib/pulse/queries.ts` (`LOGS_SELECT` line 12, `loadLogs` mapping)
- Modify: `src/app/pulse/actions.ts` (`saveLogs` upsert row, ~lines 78-88)

- [ ] **Step 1: Add `drops` to the logs select and mapping**

In `queries.ts`, change the constant:

```ts
const LOGS_SELECT = 'week, routine_exercise_id, set_idx, kg, reps, rir, saved, drops';
```

And in `loadLogs`, include drops in the mapped entry (jsonb comes back as an array or null):

```ts
raw[logKey(row.week, row.routine_exercise_id, row.set_idx)] = {
    kg: Number(row.kg),
    reps: row.reps,
    rir: row.rir,
    saved: row.saved,
    ...(Array.isArray(row.drops) && row.drops.length > 0 ? { drops: row.drops } : {}),
};
```

(The `/api/pulse/logs` route and the protected layout both call `loadLogs`, so they need no separate change.)

- [ ] **Step 2: Persist `drops` in saveLogs**

In `actions.ts` `saveLogs`, add `drops` to the upserted row (normalize empty to null so a non-drop set stays null):

```ts
return {
    user_id: user.id,
    week: parsed.week,
    routine_exercise_id: parsed.routineExerciseId,
    set_idx: parsed.setIdx,
    kg: val.kg,
    reps: val.reps,
    rir: val.rir,
    saved: true,
    drops: Array.isArray(val.drops) && val.drops.length > 0 ? val.drops : null,
    updated_at: new Date().toISOString(),
};
```

(The existing `validateLogs(logs)` guard at the top of `saveLogs` already validated `drops`.)

- [ ] **Step 3: Verify**

Run: `bun run typecheck && bun run test:run`
Expected: typecheck clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/queries.ts src/app/pulse/actions.ts
git -c commit.gpgsign=false commit -m "feat(pulse): persist and load set drops"
```

---

## Task 5: UI — failure tag (RIR 0)

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx`
- Test: `src/components/pulse/__tests__/SetLogger.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the SetLogger test (render a saved set, once with `rir: 0`, once with `rir: 2`):

```tsx
it('shows a failure tag when a saved set is logged at RIR 0', () => {
    // render SetLogger with a saved entry { kg: 80, reps: 8, rir: 0, saved: true }
    expect(screen.getByText(/failure/i)).toBeInTheDocument();
});
it('does not show the failure tag at RIR > 0', () => {
    // render SetLogger with a saved entry { kg: 80, reps: 8, rir: 2, saved: true }
    expect(screen.queryByText(/failure/i)).not.toBeInTheDocument();
});
```

Match the existing render/setup helper used by the other tests in this file.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Expected: FAIL (no failure tag yet).

- [ ] **Step 3: Implement**

In `SetLogger`, on a saved row, when `rir === 0` render a small coral tag (Slate styling, e.g. `text-pulse-accent` with the accent-tinted pill used elsewhere):

```tsx
{saved && entry?.rir === 0 && (
    <span className="font-pulse text-[0.625rem] uppercase tracking-[0.08em] text-pulse-accent" title="Taken to failure">
        Failure
    </span>
)}
```

Place it inline with the saved set summary. Read the file for the exact saved-row markup and match it.

- [ ] **Step 4: Run to verify it passes**

Run: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Expected: PASS, and existing SetLogger tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/SetLogger.tsx src/components/pulse/__tests__/SetLogger.test.tsx
git -c commit.gpgsign=false commit -m "feat(pulse): failure tag at RIR 0"
```

---

## Task 6: UI — drop set editor + display

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx` (editor + save)
- Modify: `src/components/pulse/ExerciseCard.tsx`, `src/components/pulse/WorkoutModeScreen.tsx`, `src/components/pulse/views/HistoryView.tsx` (display logged drops)
- Test: `src/components/pulse/__tests__/SetLogger.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('logs a drop set: adding a drop segment and saving includes drops', async () => {
    const onSave = vi.fn();
    // render SetLogger (unsaved) with onSave spy and the standard props helper
    // 1. fill the working set kg/reps
    // 2. click "Add drop", fill the drop kg/reps
    // 3. click save
    expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ saved: true, drops: [expect.objectContaining({ kg: expect.any(Number), reps: expect.any(Number) })] }),
    );
});
```

Use the file's existing interaction helpers (fireEvent/userEvent) and prop setup.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test:run src/components/pulse/__tests__/SetLogger.test.tsx`
Expected: FAIL (no drop editor).

- [ ] **Step 3: Implement the editor**

In `SetLogger`, add local state `const [drops, setDrops] = useState<Array<{ kg: number; reps: number }>>(entry?.drops ?? [])`. Add an "Add drop" control (hidden when not editing / not the working input) that appends `{ kg: 0, reps: 0 }`, with kg/reps number inputs per segment and a remove control, capped at 6. Include the segments in the save payload:

```tsx
onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true, ...(drops.length > 0 ? { drops } : {}) });
```

Filter out incomplete segments (`kg > 0 && reps > 0`) before saving. Style with Slate tokens, matching the existing inputs in the file.

- [ ] **Step 4: Implement display of logged drops**

In `ExerciseCard.tsx`, `WorkoutModeScreen.tsx`, and the history replay in `HistoryView.tsx`, when a saved set has `entry.drops?.length`, render the segments beneath the working set, compact, e.g. `↓ 60 x 8  ·  40 x 8`, using `text-pulse-dim` / `text-pulse-muted`. Read each file's set-row markup and match it.

- [ ] **Step 5: Run to verify it passes**

Run: `bun run typecheck && bun run test:run`
Expected: typecheck clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/SetLogger.tsx src/components/pulse/ExerciseCard.tsx src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/views/HistoryView.tsx src/components/pulse/__tests__/SetLogger.test.tsx
git -c commit.gpgsign=false commit -m "feat(pulse): drop-set editor and display"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full suite**

Run: `bun run typecheck && bun run test:run && bun run lint`
Expected: typecheck clean, all tests pass, lint clean (the 2 pre-existing exhaustive-deps warnings are acceptable).

- [ ] **Step 2: Format**

Run: `bun run format` then re-run `bun run typecheck && bun run test:run`.

- [ ] **Step 3: Manual smoke (optional, requires login + applied migration)**

Log a set at RIR 0 (see Failure tag), and a drop set (working + 2 drops); confirm both persist and render in Train, WorkoutMode, and History.

---

## Self-review

- **Spec coverage:** migration (T1), `LogEntry.drops` (T2), validation (T3), persistence read+write (T4), failure tag (T5), drop editor + display (T6), verify (T7). All spec sections mapped.
- **No DB read/write divergence:** only `queries.ts` `loadLogs` changes for reads (the route + layout call it), matching the audit's centralization.
- **Type consistency:** `drops?: Array<{ kg: number; reps: number }>` used identically in `LogEntry`, `validateLogs`, `loadLogs`, `saveLogs`, and the SetLogger save payload.
- **No PR/volume change:** drop segments are supplementary; `computePRMap`/volume/e1RM read the working set `kg`/`reps` only, untouched.
- **Dependency order for the workflow:** T1, T2 first. T3 needs T2. T4 needs T2 (+ T3 for the validation guard). T5 is independent (reads `rir`). T6 needs T2 + T4. T7 last.
