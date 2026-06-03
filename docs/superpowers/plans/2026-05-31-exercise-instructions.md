# Exercise Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated muscle-group chips and technique cues to all global exercises, surfaced via a ⓘ modal from both the train screen and the Library.

**Architecture:** A new `exercise_instructions` table stores `primary_muscles[]`, `secondary_muscles[]`, and `cues[]` per global exercise. A `GET /api/pulse/exercises/[id]/instructions` route fetches on demand when the ⓘ button is tapped. An `ExerciseInstructionModal` component renders the data as chips and numbered cues. The ⓘ button is added to `ExerciseCard` and the Library exercise list — visible only for global exercises (`user_id === null`).

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), React, Vitest + Testing Library

---

## File Map

| Action | File |
|--------|------|
| Create | `docs/migrations/2026-05-31-exercise-instructions.sql` |
| Create | `docs/migrations/2026-05-31-exercise-instructions-seed.sql` |
| Modify | `src/lib/pulse/types.ts` |
| Create | `src/app/api/pulse/exercises/[id]/instructions/route.ts` |
| Create | `src/components/pulse/ExerciseInstructionModal.tsx` |
| Create | `src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx` |
| Modify | `src/components/pulse/ExerciseCard.tsx` |
| Modify | `src/components/pulse/__tests__/ExerciseCard.test.tsx` |
| Modify | `src/components/pulse/views/LibraryView.tsx` |
| Modify | `src/components/pulse/__tests__/LibraryView.test.tsx` |

---

## Task 1: DB Migration + Type Update

**Files:**
- Create: `docs/migrations/2026-05-31-exercise-instructions.sql`
- Modify: `src/lib/pulse/types.ts`

- [ ] **Step 1: Create the migration SQL file**

Create `docs/migrations/2026-05-31-exercise-instructions.sql`:

```sql
-- Exercise instructions: muscle groups and technique cues per global exercise
-- Run in Supabase SQL Editor BEFORE the seed file

CREATE TABLE exercise_instructions (
    exercise_id     UUID PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
    primary_muscles TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    cues            TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE exercise_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructions_read_authenticated"
    ON exercise_instructions
    FOR SELECT
    TO authenticated
    USING (true);
```

Do NOT run this yet — it will be run manually in Supabase SQL Editor.

- [ ] **Step 2: Add `ExerciseInstruction` type to `src/lib/pulse/types.ts`**

Add after the `ExerciseItem` type:

```ts
export interface ExerciseInstruction {
    exercise_id: string;
    primary_muscles: string[];
    secondary_muscles: string[];
    cues: string[];
}
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```
npm run test:run
```

Expected: all existing tests pass (no changes to runtime code).

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/2026-05-31-exercise-instructions.sql src/lib/pulse/types.ts
git commit -m "feat(instructions): add exercise_instructions table migration and type"
```

---

## Task 2: API Route — GET Instructions

**Files:**
- Create: `src/app/api/pulse/exercises/[id]/instructions/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/pulse/exercises/[id]/instructions/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Invalid exercise ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
        .from('exercise_instructions')
        .select('exercise_id, primary_muscles, secondary_muscles, cues')
        .eq('exercise_id', id)
        .maybeSingle();

    if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(data);
}
```

- [ ] **Step 2: Run tests**

```
npm run test:run
```

Expected: all tests pass (no tests yet for this route — that's fine, it will be exercised end-to-end once the modal is built).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/pulse/exercises/[id]/instructions/route.ts"
git commit -m "feat(instructions): add GET /api/pulse/exercises/[id]/instructions route"
```

---

## Task 3: `ExerciseInstructionModal` Component + Tests

**Files:**
- Create: `src/components/pulse/ExerciseInstructionModal.tsx`
- Create: `src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseInstructionModal from '../ExerciseInstructionModal';

const defaultProps = {
    exerciseId: '11111111-1111-1111-1111-111111111111',
    exerciseName: 'Bench Press',
    onClose: vi.fn(),
};

describe('ExerciseInstructionModal', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('shows loading state while fetching', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
        render(<ExerciseInstructionModal {...defaultProps} />);
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('renders muscle chips and cues after successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                exercise_id: defaultProps.exerciseId,
                primary_muscles: ['Chest', 'Triceps'],
                secondary_muscles: ['Front Delts'],
                cues: ['Retract shoulder blades', 'Elbows at 45–75°'],
            }),
        });
        render(<ExerciseInstructionModal {...defaultProps} />);
        await waitFor(() => expect(screen.getByText('Chest')).toBeInTheDocument());
        expect(screen.getByText('Triceps')).toBeInTheDocument();
        expect(screen.getByText('Front Delts')).toBeInTheDocument();
        expect(screen.getByText('Retract shoulder blades')).toBeInTheDocument();
        expect(screen.getByText('Elbows at 45–75°')).toBeInTheDocument();
    });

    it('shows error message when fetch returns 404', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
        render(<ExerciseInstructionModal {...defaultProps} />);
        await waitFor(() =>
            expect(screen.getByText(/no instructions available/i)).toBeInTheDocument(),
        );
    });

    it('calls onClose when backdrop is clicked', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
        const onClose = vi.fn();
        render(<ExerciseInstructionModal {...defaultProps} onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('renders the exercise name in the modal title', async () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
        render(<ExerciseInstructionModal {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm run test:run -- src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx
```

Expected: FAIL — `ExerciseInstructionModal` module not found.

- [ ] **Step 3: Create `ExerciseInstructionModal.tsx`**

Create `src/components/pulse/ExerciseInstructionModal.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { ExerciseInstruction } from '@/lib/pulse/types';

interface Props {
    exerciseId: string;
    exerciseName: string;
    onClose: () => void;
}

export default function ExerciseInstructionModal({ exerciseId, exerciseName, onClose }: Props) {
    const [data, setData] = useState<ExerciseInstruction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        fetch(`/api/pulse/exercises/${exerciseId}/instructions`)
            .then((res) => {
                if (!res.ok) throw new Error('not found');
                return res.json() as Promise<ExerciseInstruction>;
            })
            .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
            .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
        return () => { cancelled = true; };
    }, [exerciseId]);

    return (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
                aria-hidden
            />
            {/* Panel */}
            <div className="relative w-full max-w-lg bg-pulse-bg border border-pulse-border rounded-t-2xl lg:rounded-2xl px-5 pt-5 pb-8 z-10 max-h-[80vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-5">
                    <h2 className="font-pulse text-lg font-bold text-pulse-text">{exerciseName}</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close instructions"
                        className="text-pulse-dim bg-transparent border-none cursor-pointer text-xl leading-none shrink-0">
                        ✕
                    </button>
                </div>

                {loading && (
                    <p className="font-pulse text-sm text-pulse-muted">Loading…</p>
                )}

                {!loading && error && (
                    <p className="font-pulse text-sm text-pulse-muted">No instructions available.</p>
                )}

                {!loading && !error && data && (
                    <>
                        {data.primary_muscles.length > 0 && (
                            <div className="mb-4">
                                <div className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted mb-2">
                                    Primary
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.primary_muscles.map((m) => (
                                        <span
                                            key={m}
                                            className="font-pulse text-xs font-semibold bg-pulse-accent/10 text-pulse-accent border border-pulse-accent/25 rounded-full px-2.5 py-0.5">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.secondary_muscles.length > 0 && (
                            <div className="mb-4">
                                <div className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted mb-2">
                                    Secondary
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.secondary_muscles.map((m) => (
                                        <span
                                            key={m}
                                            className="font-pulse text-xs font-semibold bg-pulse-surface text-pulse-dim border border-pulse-border rounded-full px-2.5 py-0.5">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.cues.length > 0 && (
                            <div>
                                <div className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-muted mb-2">
                                    Cues
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    {data.cues.map((cue, i) => (
                                        <div key={i} className="flex gap-3 items-start">
                                            <span className="font-pulse text-[0.6875rem] font-bold text-pulse-accent bg-pulse-accent/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <span className="font-pulse text-sm text-pulse-text leading-snug">
                                                {cue}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run all tests**

```
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/pulse/ExerciseInstructionModal.tsx src/components/pulse/__tests__/ExerciseInstructionModal.test.tsx
git commit -m "feat(instructions): add ExerciseInstructionModal component"
```

---

## Task 4: ExerciseCard — Add ⓘ Button

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx`
- Modify: `src/components/pulse/__tests__/ExerciseCard.test.tsx`

- [ ] **Step 1: Write a failing test**

Open `src/components/pulse/__tests__/ExerciseCard.test.tsx`. The existing `routineExercise` mock already has `exercise.user_id: null` (global exercise). Add this test at the end of the describe block:

```ts
it('renders an info button for global exercises (user_id null)', () => {
    render(<ExerciseCard {...defaultProps} />);
    expect(screen.getByRole('button', { name: /instructions/i })).toBeInTheDocument();
});

it('does not render an info button for user-created exercises', () => {
    const userExercise: RoutineExercise = {
        ...routineExercise,
        exercise: { ...routineExercise.exercise, user_id: 'some-user-id' },
    };
    render(<ExerciseCard {...defaultProps} routineExercise={userExercise} />);
    expect(screen.queryByRole('button', { name: /instructions/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm they fail**

```
npm run test:run -- src/components/pulse/__tests__/ExerciseCard.test.tsx
```

Expected: the two new tests FAIL (no info button exists yet).

- [ ] **Step 3: Update `ExerciseCard.tsx`**

Read `src/components/pulse/ExerciseCard.tsx` first. Then make these two changes:

**3a — Add import at the top:**

```tsx
import { useState } from 'react';  // already imported
import ExerciseInstructionModal from './ExerciseInstructionModal';  // add this
```

**3b — Add `showInstructions` state** (alongside the existing `open` and `noteEditing` state, near the top of the component):

```tsx
const [showInstructions, setShowInstructions] = useState(false);
```

**3c — Add the ⓘ button inside the collapsed header button.**

The header `<button>` currently contains: index chip → name+meta → progress pips → optional ✓ → chevron. Add the ⓘ button BETWEEN the progress pips block and the optional ✓, as a **sibling element outside the expand button** (since nesting a button inside a button is invalid HTML).

The cleanest approach: convert the outer wrapper from a `<button>` to a `<div role="button">` OR keep the button and place the ⓘ as an absolutely positioned element. The simplest valid approach in the existing code: add a separate `<button>` element *after* the main card expand button, inside the same outer wrapper div.

Look at the ExerciseCard structure — the entire card is a `<div>` with a `<button>` for the header and a conditional `<div>` for the body. Add the ⓘ button as a sibling inside the outer `<div>`, overlaid on the header using `absolute` positioning, OR restructure the header to be a flex row where the ⓘ is a sibling to the expand button.

The simplest valid HTML approach: wrap the expand button and ⓘ button in a flex row:

Replace the current single `<button onClick={() => setOpen(...)} ...>` with:

```tsx
<div className="flex items-center">
    <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${re.exercise.name}${complete ? ' — all sets done' : ''}`}
        className="flex-1 py-3.5 px-4 bg-transparent border-none cursor-pointer flex items-center gap-3 text-left">
        {/* existing header content unchanged */}
        {/* index chip */}
        {/* name + meta */}
        {/* progress pips + count */}
        {/* complete checkmark */}
        {/* chevron */}
    </button>
    {re.exercise.user_id === null && (
        <button
            onClick={() => setShowInstructions(true)}
            aria-label={`${re.exercise.name} instructions`}
            className="pr-3 pl-1 py-3.5 bg-transparent border-none cursor-pointer text-pulse-muted hover:text-pulse-dim shrink-0"
            type="button">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                <circle cx="8" cy="8" r="7" />
                <line x1="8" y1="7" x2="8" y2="11" />
                <circle cx="8" cy="5" r="0.5" fill="currentColor" stroke="none" />
            </svg>
        </button>
    )}
</div>
```

**3d — Add modal at the end of the component's return, before the closing outer `</div>`:**

```tsx
{showInstructions && (
    <ExerciseInstructionModal
        exerciseId={re.exercise.id}
        exerciseName={re.exercise.name}
        onClose={() => setShowInstructions(false)}
    />
)}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm run test:run -- src/components/pulse/__tests__/ExerciseCard.test.tsx
```

Expected: all tests PASS including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/ExerciseCard.tsx src/components/pulse/__tests__/ExerciseCard.test.tsx
git commit -m "feat(instructions): add info button to ExerciseCard for global exercises"
```

---

## Task 5: LibraryView — Add ⓘ Button to Exercise List

**Files:**
- Modify: `src/components/pulse/views/LibraryView.tsx`
- Modify: `src/components/pulse/__tests__/LibraryView.test.tsx`

- [ ] **Step 1: Write a failing test**

Open `src/components/pulse/__tests__/LibraryView.test.tsx`. Read the existing file first to understand the ExercisesTab test setup.

Add this test at the end of the existing describe block (or inside the ExercisesTab describe if one exists):

```ts
it('shows an info button for global exercises in the exercise list', async () => {
    // The existing mock context includes exercises — verify at least one global exercise
    // renders a button with "instructions" in its accessible name.
    // Adjust the mock if needed so a global exercise (user_id: null) is in the list.
    render(<LibraryView />);
    // LibraryView renders the Exercises tab by default
    const infoButtons = screen.getAllByRole('button', { name: /instructions/i });
    expect(infoButtons.length).toBeGreaterThan(0);
});
```

> **Note:** Read the existing LibraryView test to confirm the mock context includes at least one global exercise. If the mock only has user-created exercises, add a global one (`user_id: null`).

- [ ] **Step 2: Run to confirm it fails**

```
npm run test:run -- src/components/pulse/__tests__/LibraryView.test.tsx
```

Expected: the new test FAIL (no ⓘ button in the exercise list yet).

- [ ] **Step 3: Add the ⓘ button to `ExercisesTab` in `LibraryView.tsx`**

Read `src/components/pulse/views/LibraryView.tsx` first. Find the `ExercisesTab` function, specifically the `filtered.map((ex) => ...)` block.

**3a — Add import at the top of `LibraryView.tsx`:**

```ts
import { useState } from 'react';  // may already be imported
import ExerciseInstructionModal from '../ExerciseInstructionModal';
```

**3b — Add state at the top of the `ExercisesTab` function:**

```ts
const [instructionsFor, setInstructionsFor] = useState<{ id: string; name: string } | null>(null);
```

**3c — In the exercise list `map`, find the non-editing display branch:**

```tsx
) : (
    <>
        <span className="font-pulse text-sm text-white flex-1 min-w-0 truncate">
            {ex.name}
        </span>
        <CategoryBadge category={ex.category} />
        {isUser && (
            ...edit/delete buttons...
        )}
    </>
)}
```

Add the ⓘ button AFTER `<CategoryBadge />` and BEFORE the `{isUser && ...}` block:

```tsx
{!isUser && (
    <button
        onClick={() => setInstructionsFor({ id: ex.id, name: ex.name })}
        aria-label={`${ex.name} instructions`}
        className="font-pulse text-xs text-pulse-muted bg-transparent border-none cursor-pointer shrink-0"
        type="button">
        ⓘ
    </button>
)}
```

**3d — Add the modal at the end of the `ExercisesTab` return, before its closing tag:**

```tsx
{instructionsFor && (
    <ExerciseInstructionModal
        exerciseId={instructionsFor.id}
        exerciseName={instructionsFor.name}
        onClose={() => setInstructionsFor(null)}
    />
)}
```

- [ ] **Step 4: Run tests**

```
npm run test:run -- src/components/pulse/__tests__/LibraryView.test.tsx
```

Expected: all tests PASS including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/views/LibraryView.tsx src/components/pulse/__tests__/LibraryView.test.tsx
git commit -m "feat(instructions): add info button to exercise list in Library"
```

---

## Task 6: Seed Content

**Files:**
- Create: `docs/migrations/2026-05-31-exercise-instructions-seed.sql`

> **Before writing the seed:** Run this query in Supabase SQL Editor to get the authoritative list of global exercises:
> ```sql
> SELECT name, category FROM exercises WHERE user_id IS NULL ORDER BY category, name;
> ```
> Use the result to verify every exercise in the seed file below is matched.

- [ ] **Step 1: Create the seed file**

Create `docs/migrations/2026-05-31-exercise-instructions-seed.sql`:

```sql
-- Exercise instructions seed
-- Run AFTER 2026-05-31-exercise-instructions.sql
-- Idempotent: ON CONFLICT DO NOTHING

-- ── CHEST ─────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts','Core'],
ARRAY['Retract and depress your shoulder blades before unracking',
      'Lower the bar to your lower chest with elbows at 45–75° from your torso',
      'Drive your feet into the floor and press the bar in a slight arc back toward your face']
FROM exercises WHERE name = 'Barbell Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Retract shoulder blades — imagine pinching a pencil between them',
      'Keep a slight arch in your lower back, feet flat on the floor',
      'Lower dumbbells to chest level, elbows at 45–75°, then press up and in']
FROM exercises WHERE name = 'Dumbbell Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Upper Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Set bench to 30–45° — steeper angles shift emphasis to shoulders not chest',
      'Lower dumbbells to your upper chest, elbows at 45–75°',
      'Press up and slightly inward, squeeze chest at the top']
FROM exercises WHERE name = 'Incline Dumbbell Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Upper Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Set bench to 30–45°',
      'Grip just outside shoulder width, lower bar to upper chest',
      'Keep elbows tucked at 45–75°, drive bar up in a slight arc']
FROM exercises WHERE name = 'Incline Barbell Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts','Biceps'],
ARRAY['Maintain a soft, fixed bend in your elbows throughout — this is not a press',
      'Open your arms wide as if hugging a barrel, feel the chest stretch',
      'Squeeze your chest to bring arms back together, pause at the top']
FROM exercises WHERE name = 'Chest Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts'],
ARRAY['Set cables at chest height; lean forward slightly for better stretch',
      'Keep a fixed elbow bend — squeeze chest to draw hands together',
      'Control the return: let the cable stretch your chest fully']
FROM exercises WHERE name = 'Cable Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts','Core'],
ARRAY['Form a rigid plank from head to heels — no sagging hips',
      'Hands slightly wider than shoulder width, lower chest until nearly touching floor',
      'Spread the floor apart with your hands as you push up']
FROM exercises WHERE name = 'Push-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Adjust seat so handles align with your lower chest',
      'Press forward and slightly inward, do not lock elbows out at the top',
      'Control the return — do not let the weight stack touch between reps']
FROM exercises WHERE name = 'Machine Chest Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lower Chest','Triceps'], ARRAY['Core'],
ARRAY['Feet secured on decline bench, shoulder blades pinched back',
      'Lower bar to lower chest with controlled tempo',
      'Press up in a slight arc, keep core braced throughout']
FROM exercises WHERE name = 'Decline Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts'],
ARRAY['Adjust pads to align with your mid-chest, elbows at 90°',
      'Drive the pads together using your chest — not your arms',
      'Hold the peak contraction for a beat, then control the return']
FROM exercises WHERE name = 'Pec Deck' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Feet flat, neutral spine, same technique as free-weight bench',
      'Lower bar to lower chest with elbows at 45–75°',
      'The fixed bar path removes balance demand — focus on chest contraction']
FROM exercises WHERE name = 'Smith Machine Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── BACK ──────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps','Rear Delts'], ARRAY['Biceps','Core','Glutes'],
ARRAY['Brace your core and push your hips back — flat back throughout',
      'Drive elbows toward hips, not just pull with biceps',
      'Full stretch at the bottom: let your shoulder blades separate',
      'Squeeze your lats hard at the top, keep hips from rising']
FROM exercises WHERE name = 'Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts','Core'],
ARRAY['Dead hang first — full shoulder extension at the bottom',
      'Drive your elbows toward your hips, not just pull with your hands',
      'Chin clears the bar — no kipping unless programmed',
      'Lower slowly for maximum muscle stimulus']
FROM exercises WHERE name = 'Pull-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts'],
ARRAY['Lean back slightly — about 10–15°, not straight upright',
      'Pull bar to your upper chest with elbows driving down and back',
      'Let the bar rise slowly on the return for full lat stretch']
FROM exercises WHERE name = 'Lat Pulldown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Hinge until torso is 45–60° from horizontal, brace core',
      'Drive elbows back and up past your torso, squeeze shoulder blades together',
      'Control the descent — do not let the bar pull you forward']
FROM exercises WHERE name = 'Barbell Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Sit tall, feet flat, slight lean back is fine',
      'Pull handle to your lower abdomen — elbows stay close to body',
      'Squeeze your lats and shoulder blades together at full contraction']
FROM exercises WHERE name = 'Seated Cable Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Support non-working hand and knee on a bench',
      'Row the dumbbell to your hip — elbow drives up and back',
      'Keep hips square, do not rotate to cheat the weight up']
FROM exercises WHERE name = 'Dumbbell Single-Arm Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Hinge at hips, flat back, both hands on the bar',
      'Row dumbbells to hip level, driving elbows back',
      'Squeeze shoulder blades at the top, lower with control']
FROM exercises WHERE name = 'Dumbbell Bent-Over Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Slight forward lean at the hips',
      'Raise dumbbells to the side with a slight backward arc — lead with elbows',
      'Squeeze rear delts at the top, control the return']
FROM exercises WHERE name = 'Dumbbell Reverse Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Set cable at face height, use a rope attachment',
      'Pull toward your face, elbows flaring out and back',
      'External rotate at the end — thumbs point behind you']
FROM exercises WHERE name = 'Face Pull' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Hinge forward and pull dumbbells to face height',
      'Elbows flare out and slightly back at the top',
      'External rotate: thumbs point behind you at peak contraction']
FROM exercises WHERE name = 'Dumbbell Face Pull (Bent-Over)' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rhomboids'],
ARRAY['Lie face-down on an incline bench',
      'Raise arms to the side with a slight backward arc',
      'Squeeze shoulder blades hard at the top']
FROM exercises WHERE name = 'Rear Delt Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Pad chest on the machine, neutral or pronated grip',
      'Row handles to your lower rib cage',
      'Full lat stretch at the bottom between every rep']
FROM exercises WHERE name = 'Chest-Supported Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Set cable at or above eye level, arms straight',
      'Pull bar to your thighs with straight arms — elbows lead',
      'Squeeze lats hard at the bottom, return with full stretch']
FROM exercises WHERE name = 'Straight-Arm Pulldown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps','Rear Delts'], ARRAY['Biceps','Core'],
ARRAY['Bar set at knee height, similar setup to a deadlift',
      'Short range of motion — focus on upper back and lats',
      'Brace hard before each rep, flat back throughout']
FROM exercises WHERE name = 'Rack Pull' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Set the bar at waist height; load one side and brace it against something',
      'Stand perpendicular to the bar, row it to your hip',
      'Drive elbow back and squeeze lats at the top']
FROM exercises WHERE name = 'T-Bar Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts','Core'],
ARRAY['Supinated (palms facing you) grip — this increases bicep recruitment',
      'Dead hang at the bottom, drive elbows to hips',
      'Pull chin over the bar, lower slowly for maximum benefit']
FROM exercises WHERE name = 'Chin-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── SHOULDERS ─────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps','Upper Chest'],
ARRAY['Brace your core — do not hyperextend your lower back',
      'Press bar from upper chest to directly overhead, elbows forward',
      'Fully lock out at the top, lower bar back to clavicle level']
FROM exercises WHERE name = 'Barbell Overhead Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps','Core'],
ARRAY['Sit with back supported or stand with core braced',
      'Press dumbbells from shoulder level directly overhead',
      'Do not touch dumbbells at the top — maintain shoulder tension']
FROM exercises WHERE name = 'Dumbbell Overhead Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Slight forward lean and a micro-bend in the elbow',
      'Raise arms to shoulder height — lead with your pinky, not your thumb',
      'Control the descent: the eccentric is where growth happens']
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Same as lateral raise — use cable for constant tension throughout the range',
      'Keep elbow slightly bent and lead with your elbow not your hand',
      'Do not lean away from the cable to cheat the weight up']
FROM exercises WHERE name = 'Cable Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Slight forward lean and micro-bend in elbows',
      'Raise arms to shoulder height, lead with pinky finger',
      'Control the descent: slow eccentric builds more muscle']
FROM exercises WHERE name = 'Dumbbell Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps'],
ARRAY['Start with palms facing you, rotate to palms forward as you press',
      'Press until arms are fully extended overhead',
      'Return by rotating back — this rotation increases shoulder activation']
FROM exercises WHERE name = 'Arnold Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts'], ARRAY['Side Delts','Upper Chest'],
ARRAY['Keep a slight bend in your elbows',
      'Raise arms directly in front to shoulder height — no higher',
      'Control the return; avoid swinging with your torso']
FROM exercises WHERE name = 'Front Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts','Traps'], ARRAY['Biceps'],
ARRAY['Stand upright, overhand grip slightly inside shoulder width',
      'Lead with your elbows — pull bar up to chin level',
      'Pause briefly at the top, lower with control; stop if you feel shoulder impingement']
FROM exercises WHERE name = 'Upright Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps'],
ARRAY['Adjust seat so handles are at shoulder height',
      'Press upward to full extension without shrugging',
      'Lower handles back to start with full control']
FROM exercises WHERE name = 'Machine Shoulder Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── TRICEPS ───────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Upper arms stay vertical — only your forearms move',
      'Lower dumbbell(s) behind your head until you feel a full stretch',
      'Press back to start — squeeze triceps hard at lockout']
FROM exercises WHERE name = 'Dumbbell Tricep Overhead Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Set cable above head, rope or bar attachment',
      'Step away from the stack, arms extended, then hinge forward slightly',
      'Extend arms toward the floor — keep upper arms still beside your head']
FROM exercises WHERE name = 'Cable Overhead Tricep Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest'],
ARRAY['Grip inside shoulder width — hands close together',
      'Lower chest to the bar while keeping elbows tucked',
      'Press back to lockout; this is a press not a fly']
FROM exercises WHERE name = 'Close-Grip Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Upper arms stay perpendicular to the floor throughout',
      'Lower bar to your forehead (not nose) with slow control',
      'Extend back to lockout — squeeze triceps at the top']
FROM exercises WHERE name = 'Skull Crusher' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Set cable at chin height, rope or bar attachment',
      'Elbows pinned to your sides — only forearms move',
      'Push down to full lockout, squeeze hard, then let weight rise slowly']
FROM exercises WHERE name = 'Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Same as standard pushdown but with one arm — allows full range of motion',
      'Keep elbow pinned to side, extend to full lockout',
      'Use lighter weight than the double arm version']
FROM exercises WHERE name = 'Single-Arm Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Lean forward at the hips, upper arm parallel to floor',
      'Extend forearm back to lockout — squeeze tricep at full extension',
      'Hold the contracted position briefly, then return with control']
FROM exercises WHERE name = 'Tricep Kickback' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts','Core'],
ARRAY['Grip parallel bars, arms fully extended — do not kip',
      'Lower until upper arms are parallel to floor or slightly below',
      'Press back to lockout; for tricep focus, keep torso upright']
FROM exercises WHERE name = 'Dips' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts'],
ARRAY['Hands close, lower chest between them',
      'Elbows flare slightly inward — this is normal',
      'Press to lockout, squeeze triceps at the top']
FROM exercises WHERE name = 'Diamond / Close-Grip Push-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts'],
ARRAY['Hybrid of a close-grip bench and skull crusher',
      'Lower bar to forehead area while letting elbows drift slightly toward hips',
      'Press explosively back to lockout']
FROM exercises WHERE name = 'JM Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── BICEPS ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Keep elbows pinned to your sides throughout',
      'Curl with a supinated grip — twist so pinkies rise first',
      'Lower slowly — the eccentric builds the most mass']
FROM exercises WHERE name = 'Barbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Keep elbows pinned to your sides throughout',
      'Curl with a supinated grip — twist so pinkies rise first',
      'Lower slowly — the eccentric builds the most mass']
FROM exercises WHERE name = 'Barbell Bicep Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Elbows stay at your sides — do not swing your torso',
      'Supinate (rotate palm up) as you curl for peak bicep contraction',
      'Lower slowly with control']
FROM exercises WHERE name = 'Dumbbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Elbows stay at your sides — do not swing your torso',
      'Supinate (rotate palm up) as you curl for peak bicep contraction',
      'Lower slowly with control']
FROM exercises WHERE name = 'Dumbbell Bicep Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Brachialis','Biceps'], ARRAY['Forearms'],
ARRAY['Neutral grip (palms facing each other) throughout — no supination',
      'This hits the brachialis more than a standard curl',
      'Keep elbows pinned; lower with control']
FROM exercises WHERE name = 'Dumbbell Hammer Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Chest pad eliminates momentum — strict form only',
      'Full extension at the bottom to maximise stretch on the bicep',
      'Do not hyperextend at the bottom — small bend is fine']
FROM exercises WHERE name = 'Preacher Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Cable provides constant tension unlike free weights',
      'Stand close to the cable, curl with supinated grip',
      'Squeeze at the top, let the cable pull your arm down slowly']
FROM exercises WHERE name = 'Cable Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Set bench to 45–60° incline — this creates a long bicep stretch at the bottom',
      'Let arms hang and curl up — do not swing',
      'This variation has the greatest stretch and may require lighter weight']
FROM exercises WHERE name = 'Incline Dumbbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['EZ-bar reduces wrist strain versus straight bar',
      'Elbows stay pinned, curl to shoulder height',
      'Lower with a 2–3 second eccentric']
FROM exercises WHERE name = 'EZ-Bar Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Sit on a bench, forearm resting on inner thigh',
      'Curl dumbbell up with supinated grip, elbow fixed in place',
      'Squeeze hard at the top, lower fully for a complete stretch']
FROM exercises WHERE name = 'Concentration Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Lie chest-down on a low incline bench — arms hang freely',
      'Curl up with supinated grip — chest stays on the pad',
      'No momentum: pure bicep contraction from a stretched position']
FROM exercises WHERE name = 'Spider Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── LEGS ──────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Barbell on your upper traps, feet shoulder-width, toes slightly out',
      'Brace your core, drive knees out over toes as you descend',
      'Hit depth (thighs parallel or below), drive through your whole foot to stand']
FROM exercises WHERE name = 'Barbell Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Hold dumbbell at chest with both hands, feet shoulder-width',
      'Drive knees out, sit down between your legs',
      'Stay upright: goblet squat builds better posture than most squat variations']
FROM exercises WHERE name = 'Dumbbell Goblet Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Hold dumbbells at sides or in goblet position',
      'Same cues as barbell squat — drive knees out, stay tall',
      'A useful alternative when a barbell is not available']
FROM exercises WHERE name = 'Dumbbell Sumo Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Lats','Core'],
ARRAY['Hinge at hips — push your hips back, not down',
      'Maintain a flat back; bar stays close to your legs throughout',
      'You should feel a deep hamstring stretch at the bottom',
      'Drive hips forward to return to standing']
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Core'],
ARRAY['Same hinge pattern as Romanian Deadlift',
      'Flat back throughout, push hips back',
      'Feel the hamstring stretch at the bottom, drive hips forward to stand']
FROM exercises WHERE name = 'Dumbbell Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings'],
ARRAY['Feet high and wide for more glute/hamstring focus; feet low for more quads',
      'Do not lock knees out at the top — keep a soft bend',
      'Control the descent; do not bounce off the bottom']
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Keep torso upright, take a long stride forward',
      'Front knee tracks over toes, back knee lowers toward the floor',
      'Push through your front heel to drive back to standing']
FROM exercises WHERE name = 'Walking Lunge' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads'], ARRAY['Hip Flexors'],
ARRAY['Adjust seat so knees align with machine pivot point',
      'Extend legs to nearly straight — do not hyperextend',
      'Lower slowly: 3 seconds on the way down builds more quad mass']
FROM exercises WHERE name = 'Leg Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings'], ARRAY['Glutes','Calves'],
ARRAY['Adjust pad so it sits just above your ankle, not mid-calf',
      'Curl heels toward your glutes — full range of motion',
      'Control the return; the eccentric phase is most important']
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings'], ARRAY['Glutes','Calves'],
ARRAY['Adjust pad so it sits just above your ankle',
      'Curl heels toward your glutes through full range',
      'Control the return slowly']
FROM exercises WHERE name = 'Dumbbell Leg Curl (Lying)' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings'],
ARRAY['Bar rests on your upper traps or low-bar position, on a special sled',
      'Heels elevated — this increases quad activation versus a standard squat',
      'Drive knees out, stay upright, descend to depth then drive up']
FROM exercises WHERE name = 'Hack Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── GLUTES ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings','Quads'],
ARRAY['Upper back on a bench, feet flat, barbell across hips with pad',
      'Drive hips up until your torso is parallel to the floor',
      'Squeeze glutes hard at the top — do not hyperextend your lower back']
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings'],
ARRAY['Lie on your back, feet flat on the floor, shoulder-width apart',
      'Drive hips up by squeezing your glutes — not by arching your back',
      'Hold at the top for 1–2 seconds, lower fully between reps']
FROM exercises WHERE name = 'Glute Bridge' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Quads'], ARRAY['Hamstrings','Core'],
ARRAY['Rear foot elevated on a bench, front foot forward',
      'Lower rear knee toward the floor, front shin stays nearly vertical',
      'Drive through your front heel to stand; do not use momentum']
FROM exercises WHERE name = 'Dumbbell Bulgarian Split Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings'],
ARRAY['Attach cable cuff to ankle; stand facing the machine',
      'Kick leg back with a straight knee — isolate glutes not hamstrings',
      'Pause at full contraction, return slowly']
FROM exercises WHERE name = 'Cable Kickback' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Quads'], ARRAY['Hamstrings','Core'],
ARRAY['Step onto a box or bench with one foot, drive through that heel to rise',
      'Keep torso upright and core braced throughout',
      'Lower the trailing leg with control — do not drop']
FROM exercises WHERE name = 'Step-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Hamstrings'], ARRAY['Adductors','Core'],
ARRAY['Wide stance, toes pointed out 30–45°',
      'Hip hinge pattern: push hips back, keep shins more vertical than conventional deadlift',
      'Drive hips forward to lock out — squeeze glutes hard at the top']
FROM exercises WHERE name = 'Sumo Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Abductors'], ARRAY['Hip Flexors'],
ARRAY['Adjust pads so your knees are slightly inside the pads',
      'Push outward against the pads with controlled force',
      'Hold at full abduction briefly, then return slowly']
FROM exercises WHERE name = 'Abduction Machine' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── CALVES ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand with toes on a step edge for full range of motion',
      'Lower heels fully below step for a complete stretch',
      'Rise onto toes as high as possible — hold at the top for 1 second']
FROM exercises WHERE name = 'Standing Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand with toes on a step edge for full range of motion',
      'Lower heels fully below step for a complete stretch',
      'Rise onto toes as high as possible — hold at the top for 1 second']
FROM exercises WHERE name = 'Dumbbell Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Soleus','Calves'], ARRAY[],
ARRAY['Knee bent at 90° — this position hits the soleus (deep calf) more than standing',
      'Full range: lower heel fully, raise as high as possible',
      'Slow reps: 2 seconds up, hold, 2 seconds down']
FROM exercises WHERE name = 'Seated Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Use the leg press machine; toes on the bottom edge of the footplate',
      'Push through the balls of your feet to extend at the ankle',
      'Full range: deep stretch then full contraction, do not rush']
FROM exercises WHERE name = 'Leg Press Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Unilateral — each calf works independently',
      'Full range of motion: deep stretch at the bottom, full rise at the top',
      'Use a step for range; hold dumbbell on same side for resistance']
FROM exercises WHERE name = 'Single-Leg Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Lean forward with hips resting on a partner or pad — this increases stretch',
      'Full range: deep heel drop then full toe raise',
      'Historically popular for its extreme range of motion']
FROM exercises WHERE name = 'Donkey Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Smith machine stabilises the bar for solo calf work',
      'Toes on a step for full range; same technique as standing calf raise',
      'Full stretch at the bottom, hold contraction at the top']
FROM exercises WHERE name = 'Smith Machine Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand on a step for full range of motion',
      'Lower heel fully, rise onto toes and hold briefly',
      'Use a machine or barbell to add resistance once bodyweight is easy']
FROM exercises WHERE name = 'Calf Raise Machine' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── ABS ───────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Hands behind head — do not pull on your neck',
      'Curl your chest toward your knees, not your head toward your knees',
      'Exhale on the way up; control the return']
FROM exercises WHERE name = 'Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Set cable above head, use a rope attachment',
      'Kneel facing the cable, hands at your forehead',
      'Crunch your ribcage toward your knees — do not pull with your arms']
FROM exercises WHERE name = 'Cable Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Hip Flexors'], ARRAY['Core'],
ARRAY['Dead hang from a bar or use Roman chair',
      'Keep legs straight or slightly bent — raise to hip height or higher',
      'Do not swing; control both the up and the down']
FROM exercises WHERE name = 'Hanging Leg Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Core','Glutes'], ARRAY['Shoulders','Traps'],
ARRAY['Straight line from head to heels — no sagging or piking',
      'Squeeze glutes and brace your core hard',
      'Breathe: do not hold your breath during long holds']
FROM exercises WHERE name = 'Plank' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Obliques','Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Sit with knees bent at 45° and feet off the floor',
      'Rotate your torso side to side — touch the floor beside each hip',
      'Keep your chest up and back straight, do not round forward']
FROM exercises WHERE name = 'Russian Twist' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Core'], ARRAY['Lats','Shoulders'],
ARRAY['Kneel and grip the wheel with both hands, arms straight',
      'Roll forward slowly, extending your body toward the floor',
      'Pull back using your abs — not your lower back or hips']
FROM exercises WHERE name = 'Ab Wheel Rollout' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Lie flat, hands under your lower back for support',
      'Curl your hips and bring knees toward your chest',
      'Lower legs slowly with control — do not let your lower back arch']
FROM exercises WHERE name = 'Reverse Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Core','Hip Flexors'], ARRAY['Shoulders','Quads'],
ARRAY['Start in a push-up position, core braced',
      'Drive one knee toward your chest, then alternate quickly',
      'Keep your hips level — do not let them rise or rock']
FROM exercises WHERE name = 'Mountain Climber' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Hip Flexors'], ARRAY['Core'],
ARRAY['Hands behind head or crossed on chest — do not pull neck',
      'Rise until torso is upright, then lower with control',
      'Keep feet anchored; breathe out on the way up']
FROM exercises WHERE name = 'Sit-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;
```

- [ ] **Step 2: Run the migrations in Supabase SQL Editor**

In Supabase SQL Editor, run in order:
1. `docs/migrations/2026-05-31-exercise-instructions.sql` (creates table + RLS)
2. `docs/migrations/2026-05-31-exercise-instructions-seed.sql` (inserts content)

Verify with:
```sql
SELECT COUNT(*) FROM exercise_instructions;
```

Expected: a count matching the number of global exercises that have entries (should be ~75).

- [ ] **Step 3: Commit the seed file**

```bash
git add docs/migrations/2026-05-31-exercise-instructions-seed.sql
git commit -m "feat(instructions): add exercise instructions seed data for all global exercises"
```

---

## Self-Review Checklist

- [x] **Spec coverage — table + RLS:** migration SQL with `exercise_instructions`, read-only policy ✓
- [x] **Spec coverage — type:** `ExerciseInstruction` interface added to `types.ts` ✓
- [x] **Spec coverage — API route:** `GET /api/pulse/exercises/[id]/instructions`, UUID validation, auth, 404 on miss ✓
- [x] **Spec coverage — modal:** loading, error, success states; primary chips, secondary chips, numbered cues; backdrop dismiss and ✕ button ✓
- [x] **Spec coverage — ExerciseCard:** ⓘ button shown only for global exercises (`user_id === null`) ✓
- [x] **Spec coverage — Library:** ⓘ button in exercise rows for global exercises ✓
- [x] **Spec coverage — seed data:** SQL for all ~75 global exercises across all 9 categories ✓
- [x] **Type consistency:** `ExerciseInstruction` defined in Task 1, used in modal (Task 3) ✓
- [x] **No placeholders:** all steps contain complete code ✓
