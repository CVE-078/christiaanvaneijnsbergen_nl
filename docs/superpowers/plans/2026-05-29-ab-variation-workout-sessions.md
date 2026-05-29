# A/B Exercise Variation + Workout Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add A/B exercise variation to templates (two distinct exercise lists per workout type that alternate automatically) and a workout sessions system with a guided workout mode screen.

**Architecture:** `workout_sessions` table tracks each workout (routine, workout_type, variant, start/end time). `routine_exercises.variant` distinguishes A from B exercises. Session creation server-side determines the next variant by querying the last completed session. `WorkoutModeScreen` is a full-screen overlay opened from `LogView` via a "Start workout" button; it receives pre-filtered exercises for the active variant. `WorkoutTabs` gains A/B sub-tabs for routines that have variant data.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), SWR, Vitest + Testing Library, Tailwind CSS.

---

## File Map

**Create:**
- `docs/migrations/2026-05-29-ab-workout-sessions.sql` — schema: `workout_sessions` table + `variant` on `routine_exercises` + `template_exercises`
- `docs/migrations/2026-05-29-template-ab-data.sql` — populate A/B exercise data for all eligible templates
- `src/lib/pulse/sessions.ts` — pure `nextVariant()` logic
- `src/lib/pulse/__tests__/sessions.test.ts` — unit tests for alternation logic
- `src/app/api/pulse/sessions/route.ts` — `POST` create/resume session
- `src/app/api/pulse/sessions/[id]/route.ts` — `PATCH` complete session
- `src/hooks/pulse/useWorkoutSession.ts` — client hook wrapping session API
- `src/components/pulse/WorkoutModeScreen.tsx` — full-screen guided workout overlay
- `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx` — component tests

**Modify:**
- `src/lib/pulse/types.ts` — add `WorkoutVariant`, `TabKey`, `WorkoutSession`; update `RoutineExercise`
- `src/lib/pulse/constants.ts` — add `tabKeyLabel()` helper
- `src/hooks/pulse/useUIState.ts` — `activeTab: TabKey`
- `src/app/pulse/actions.ts` — pass `variant` through in `cloneTemplate` + `addExerciseToRoutine`
- `src/components/pulse/PulseProvider.tsx` — add `routineExercisesByTabKey` computed value
- `src/context/PulseContext.ts` — expose `routineExercisesByTabKey`, update `activeTab: TabKey`
- `src/components/pulse/WorkoutTabs.tsx` — render A/B variant tabs via `routineExercisesByTabKey`
- `src/components/pulse/views/LogView.tsx` — add "Start workout" button + `WorkoutModeScreen` integration

---

## Task 1: Schema Migration

**Files:**
- Create: `docs/migrations/2026-05-29-ab-workout-sessions.sql`

- [ ] **Step 1: Write migration file**

```sql
-- docs/migrations/2026-05-29-ab-workout-sessions.sql

-- 1. Add variant to routine_exercises (nullable; NULL = no A/B split)
ALTER TABLE routine_exercises
  ADD COLUMN IF NOT EXISTS variant text CHECK (variant IN ('A', 'B'));

-- 2. Add variant to template_exercises (nullable)
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS variant text CHECK (variant IN ('A', 'B'));

-- 3. Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) NOT NULL,
  routine_id    uuid REFERENCES workout_routines(id) ON DELETE SET NULL,
  workout_type  text NOT NULL,
  variant       text CHECK (variant IN ('A', 'B')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- 4. RLS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON workout_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Index for last-session queries
CREATE INDEX IF NOT EXISTS idx_workout_sessions_lookup
  ON workout_sessions (user_id, routine_id, workout_type, completed_at DESC NULLS FIRST);
```

- [ ] **Step 2: Apply migration in Supabase dashboard (SQL editor), verify no errors**

- [ ] **Step 3: Commit**

```bash
git add docs/migrations/2026-05-29-ab-workout-sessions.sql
git commit -m "feat(ab): schema migration — workout_sessions + variant columns"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/constants.ts`

- [ ] **Step 1: Update `types.ts` — add `WorkoutVariant`, `TabKey`, `WorkoutSession`; update `RoutineExercise`**

Open `src/lib/pulse/types.ts`. Make the following changes:

After the `WORKOUT_TYPES` const, add:
```typescript
export type WorkoutVariant = 'A' | 'B';
export type TabKey = WorkoutType | `${WorkoutType}:${WorkoutVariant}`;
```

Update `RoutineExercise` — add `variant` field after `rest_seconds`:
```typescript
export interface RoutineExercise {
    id: string;
    routine_id: string;
    exercise_id: string;
    workout_type: WorkoutType;
    order: number;
    sets: string;
    reps: string;
    starting_weight_kg: number | null;
    rest_seconds?: number | null;
    variant: WorkoutVariant | null;
    exercise: DbExercise;
}
```

Add `WorkoutSession` interface after `RoutineWithExercises`:
```typescript
export interface WorkoutSession {
    id: string;
    user_id: string;
    routine_id: string | null;
    workout_type: string;
    variant: WorkoutVariant | null;
    started_at: string;
    completed_at: string | null;
}
```

- [ ] **Step 2: Update `constants.ts` — add `tabKeyLabel()` helper**

Open `src/lib/pulse/constants.ts`. Add after the existing exports:
```typescript
import type { TabKey, WorkoutType, WorkoutVariant } from './types';

export function tabKeyLabel(key: TabKey): string {
    if (key.includes(':')) {
        const [type, variant] = key.split(':') as [WorkoutType, WorkoutVariant];
        return `${WORKOUT_TYPE_LABELS[type]} ${variant}`;
    }
    return WORKOUT_TYPE_LABELS[key as WorkoutType];
}
```

- [ ] **Step 3: Run type-check to catch any type errors from the RoutineExercise change**

```bash
npx tsc --noEmit
```

Expected: errors about `variant` property missing in places that construct `RoutineExercise` objects — these will be fixed in later tasks. Note them but don't fix yet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pulse/types.ts src/lib/pulse/constants.ts
git commit -m "feat(ab): add WorkoutVariant, TabKey, WorkoutSession types"
```

---

## Task 3: A/B Alternation Logic

**Files:**
- Create: `src/lib/pulse/sessions.ts`
- Create: `src/lib/pulse/__tests__/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/pulse/__tests__/sessions.test.ts
import { describe, it, expect } from 'vitest';
import { nextVariant } from '../sessions';

describe('nextVariant', () => {
    it('returns A when no history', () => {
        expect(nextVariant(null)).toBe('A');
    });

    it('alternates A to B', () => {
        expect(nextVariant('A')).toBe('B');
    });

    it('alternates B to A', () => {
        expect(nextVariant('B')).toBe('A');
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/pulse/__tests__/sessions.test.ts
```

Expected: FAIL — `sessions` module not found.

- [ ] **Step 3: Implement `sessions.ts`**

```typescript
// src/lib/pulse/sessions.ts
import type { WorkoutVariant } from './types';

export function nextVariant(lastVariant: WorkoutVariant | null): WorkoutVariant {
    return lastVariant === 'A' ? 'B' : 'A';
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/lib/pulse/__tests__/sessions.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pulse/sessions.ts src/lib/pulse/__tests__/sessions.test.ts
git commit -m "feat(ab): nextVariant pure function with tests"
```

---

## Task 4: Sessions API Routes

**Files:**
- Create: `src/app/api/pulse/sessions/route.ts`
- Create: `src/app/api/pulse/sessions/[id]/route.ts`

- [ ] **Step 1: Create `POST /api/pulse/sessions`**

```typescript
// src/app/api/pulse/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nextVariant } from '@/lib/pulse/sessions';

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const body = await req.json() as { routineId: string; workoutType: string };
    const { routineId, workoutType } = body;

    if (!routineId || !workoutType) {
        return NextResponse.json({ error: 'Missing routineId or workoutType' }, { status: 400 });
    }

    // Return in-progress session if one exists
    const { data: existing } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('routine_id', routineId)
        .eq('workout_type', workoutType)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) return NextResponse.json(existing);

    // Check whether this workout type has A/B exercises
    const { data: variantRows } = await supabase
        .from('routine_exercises')
        .select('variant')
        .eq('routine_id', routineId)
        .eq('workout_type', workoutType)
        .not('variant', 'is', null)
        .limit(1);

    const hasVariants = (variantRows?.length ?? 0) > 0;

    let sessionVariant: 'A' | 'B' | null = null;
    if (hasVariants) {
        const { data: lastSession } = await supabase
            .from('workout_sessions')
            .select('variant')
            .eq('user_id', user.id)
            .eq('routine_id', routineId)
            .eq('workout_type', workoutType)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        sessionVariant = nextVariant(lastSession?.variant ?? null);
    }

    const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
            user_id: user.id,
            routine_id: routineId,
            workout_type: workoutType,
            variant: sessionVariant,
        })
        .select()
        .single();

    if (error || !session) return NextResponse.json(null, { status: 500 });
    return NextResponse.json(session, { status: 201 });
}
```

- [ ] **Step 2: Create `PATCH /api/pulse/sessions/[id]`**

```typescript
// src/app/api/pulse/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data, error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

    if (error || !data) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(data);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pulse/sessions/route.ts src/app/api/pulse/sessions/[id]/route.ts
git commit -m "feat(ab): sessions API routes — POST create, PATCH complete"
```

---

## Task 5: `useWorkoutSession` Hook

**Files:**
- Create: `src/hooks/pulse/useWorkoutSession.ts`

- [ ] **Step 1: Implement the hook**

```typescript
// src/hooks/pulse/useWorkoutSession.ts
'use client';
import { useState, useCallback } from 'react';
import type { WorkoutSession } from '@/lib/pulse/types';

export function useWorkoutSession() {
    const [session, setSession] = useState<WorkoutSession | null>(null);

    const startSession = useCallback(async (
        routineId: string,
        workoutType: string,
    ): Promise<WorkoutSession> => {
        const res = await fetch('/api/pulse/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ routineId, workoutType }),
        });
        if (!res.ok) throw new Error('Failed to start session');
        const data = await res.json() as WorkoutSession;
        setSession(data);
        return data;
    }, []);

    const completeSession = useCallback(async (sessionId: string): Promise<void> => {
        const res = await fetch(`/api/pulse/sessions/${sessionId}`, { method: 'PATCH' });
        if (!res.ok) throw new Error('Failed to complete session');
        setSession(null);
    }, []);

    const clearSession = useCallback(() => setSession(null), []);

    return { session, startSession, completeSession, clearSession };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/pulse/useWorkoutSession.ts
git commit -m "feat(ab): useWorkoutSession hook"
```

---

## Task 6: Template A/B Data Migration + `cloneTemplate` Update

**Files:**
- Create: `docs/migrations/2026-05-29-template-ab-data.sql`
- Modify: `src/app/pulse/actions.ts`

- [ ] **Step 1: Verify exercise names**

Before writing the migration, run this in the Supabase SQL editor to confirm the exact exercise names that will be referenced:

```sql
SELECT name FROM exercises
WHERE user_id IS NULL
ORDER BY name;
```

Confirm these names exist (all should be present from the previous templates migration):
`DB Bent-Over Row`, `DB Bicep Curl`, `DB Bulgarian Split Squat`, `DB Calf Raise`,
`DB Goblet Squat`, `DB Hammer Curl`, `DB Lateral Raise`, `DB Overhead Press`,
`DB Reverse Fly`, `DB Romanian Deadlift`, `DB Single-Arm Row`, `DB Sumo Squat`,
`DB Tricep Overhead Extension`, `Incline DB Press`,
`Barbell Bench Press`, `Barbell Overhead Press`, `Barbell Row`, `Barbell Squat`,
`Cable Lateral Raise`, `Cable Tricep Pushdown`, `Close-Grip Bench Press`,
`EZ-Bar Curl`, `Face Pull`, `Hack Squat`, `Incline Barbell Press`,
`Lat Pulldown`, `Leg Curl Machine`, `Leg Extension Machine`, `Leg Press`,
`Pec Deck`, `Romanian Deadlift`, `Seated Cable Row`, `Calf Raise Machine`,
`Barbell Bicep Curl`, `Barbell Curl`, `Barbell Romanian Deadlift`.

If any are missing, insert them before proceeding (use the same pattern as the existing migrations).

- [ ] **Step 2: Write the migration file**

```sql
-- docs/migrations/2026-05-29-template-ab-data.sql

-- ─────────────────────────────────────────────────────────────
-- Step 1: Mark all existing exercises in A/B-eligible templates as variant A
-- ─────────────────────────────────────────────────────────────
UPDATE template_exercises te
SET variant = 'A'
WHERE te.template_id IN (
    SELECT id FROM routine_templates WHERE slug IN (
        'full-body-db', 'full-body-home', 'full-body-gym',
        'upper-lower-db', 'upper-lower-home', 'upper-lower-gym',
        'push-pull-db', 'push-pull-gym',
        'ppl-db', 'ppl-home', 'ppl-gym'
    )
);

-- ─────────────────────────────────────────────────────────────
-- Step 2: Insert variant B exercises for each eligible template
-- ─────────────────────────────────────────────────────────────

-- full-body-db  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT
    t.id,
    e.id,
    v.workout_type,
    'B',
    v.ord,
    v.sets,
    v.reps
FROM
    (SELECT id FROM routine_templates WHERE slug = 'full-body-db') t,
    (VALUES
        ('Incline DB Press',       'push', 1, '3', '8-12'),
        ('DB Overhead Press',      'push', 2, '3', '8-12'),
        ('DB Single-Arm Row',      'pull', 3, '3', '8-12'),
        ('DB Hammer Curl',         'pull', 4, '3', '10-14'),
        ('DB Bulgarian Split Squat','legs', 5, '4', '10-12 per leg'),
        ('DB Romanian Deadlift',   'legs', 6, '3', '8-12')
    ) AS v(name, workout_type, ord, sets, reps)
    JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- full-body-home  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'full-body-home') t,
(VALUES
    ('Incline Barbell Press',    'push', 1, '3', '8-12'),
    ('Barbell Overhead Press',   'push', 2, '3', '6-10'),
    ('DB Single-Arm Row',        'pull', 3, '3', '10-14'),
    ('DB Hammer Curl',           'pull', 4, '3', '10-14'),
    ('Romanian Deadlift',        'legs', 5, '3', '8-12'),
    ('DB Bulgarian Split Squat', 'legs', 6, '4', '10-12 per leg')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- full-body-gym  B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'full-body-gym') t,
(VALUES
    ('Incline Barbell Press',  'push', 1, '3', '8-12'),
    ('Barbell Overhead Press', 'push', 2, '3', '6-10'),
    ('Seated Cable Row',       'pull', 3, '3', '10-14'),
    ('Lat Pulldown',           'pull', 4, '3', '8-12'),
    ('Romanian Deadlift',      'legs', 5, '3', '8-12'),
    ('Hack Squat',             'legs', 6, '3', '8-12')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-db  Upper B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-db') t,
(VALUES
    ('Incline DB Press',    'push', 1, '4', '8-12'),
    ('DB Overhead Press',   'push', 2, '3', '8-12'),
    ('DB Lateral Raise',    'push', 3, '3', '12-16'),
    ('DB Single-Arm Row',   'pull', 4, '4', '8-12'),
    ('DB Hammer Curl',      'pull', 5, '3', '10-14'),
    ('DB Reverse Fly',      'pull', 6, '3', '12-16'),
    ('DB Bulgarian Split Squat','legs', 7, '4', '10-12 per leg'),
    ('DB Romanian Deadlift','legs', 8, '3', '8-12'),
    ('DB Sumo Squat',       'legs', 9, '3', '10-14'),
    ('DB Calf Raise',       'legs', 10, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-home  Upper B + Lower B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-home') t,
(VALUES
    ('Incline Barbell Press',    'push', 1, '4', '8-12'),
    ('Barbell Overhead Press',   'push', 2, '3', '6-10'),
    ('DB Lateral Raise',         'push', 3, '3', '12-16'),
    ('DB Single-Arm Row',        'pull', 4, '4', '10-14'),
    ('DB Hammer Curl',           'pull', 5, '3', '10-14'),
    ('DB Reverse Fly',           'pull', 6, '3', '12-16'),
    ('Romanian Deadlift',        'legs', 7, '3', '8-12'),
    ('DB Bulgarian Split Squat', 'legs', 8, '3', '10-12 per leg'),
    ('DB Sumo Squat',            'legs', 9, '3', '10-14'),
    ('DB Calf Raise',            'legs', 10, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- upper-lower-gym  Upper B + Lower B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'upper-lower-gym') t,
(VALUES
    ('Incline Barbell Press',  'push', 1,  '4', '8-12'),
    ('Barbell Overhead Press', 'push', 2,  '3', '6-10'),
    ('Cable Lateral Raise',    'push', 3,  '3', '12-16'),
    ('Seated Cable Row',       'pull', 4,  '4', '10-14'),
    ('Lat Pulldown',           'pull', 5,  '3', '8-12'),
    ('Face Pull',              'pull', 6,  '3', '15-20'),
    ('Romanian Deadlift',      'legs', 7,  '3', '8-12'),
    ('Hack Squat',             'legs', 8,  '3', '8-12'),
    ('Leg Press',              'legs', 9,  '3', '10-15'),
    ('Leg Extension Machine',  'legs', 10, '3', '12-15'),
    ('Calf Raise Machine',     'legs', 11, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- push-pull-db  Push B + Pull B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'push-pull-db') t,
(VALUES
    ('Incline DB Press',             'push', 1, '4', '8-12'),
    ('DB Overhead Press',            'push', 2, '3', '8-12'),
    ('DB Lateral Raise',             'push', 3, '3', '12-16'),
    ('DB Tricep Overhead Extension', 'push', 4, '3', '10-15'),
    ('DB Single-Arm Row',            'pull', 5, '4', '10-14'),
    ('DB Reverse Fly',               'pull', 6, '3', '12-16'),
    ('DB Hammer Curl',               'pull', 7, '3', '10-14'),
    ('DB Bicep Curl',                'pull', 8, '3', '10-14')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- push-pull-gym  Push B + Pull B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'push-pull-gym') t,
(VALUES
    ('Incline Barbell Press',    'push', 1, '4', '6-10'),
    ('Barbell Overhead Press',   'push', 2, '3', '6-10'),
    ('Cable Lateral Raise',      'push', 3, '3', '12-16'),
    ('Close-Grip Bench Press',   'push', 4, '3', '8-12'),
    ('Seated Cable Row',         'pull', 5, '4', '10-14'),
    ('Lat Pulldown',             'pull', 6, '3', '8-12'),
    ('Barbell Row',              'pull', 7, '3', '6-10'),
    ('EZ-Bar Curl',              'pull', 8, '3', '8-12')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-db  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-db') t,
(VALUES
    ('Incline DB Press',             'push', 1,  '4', '8-12'),
    ('DB Bent-Over Row',             'push', 2,  '3', '10-14'),  -- intentional: hit chest from different angle
    ('DB Overhead Press',            'push', 3,  '3', '8-12'),
    ('DB Lateral Raise',             'push', 4,  '3', '12-16'),
    ('DB Tricep Overhead Extension', 'push', 5,  '3', '10-15'),
    ('DB Single-Arm Row',            'pull', 6,  '4', '10-14'),
    ('DB Bent-Over Row',             'pull', 7,  '3', '8-12'),
    ('DB Reverse Fly',               'pull', 8,  '3', '12-16'),
    ('DB Hammer Curl',               'pull', 9,  '3', '10-14'),
    ('DB Bicep Curl',                'pull', 10, '3', '10-14'),
    ('DB Bulgarian Split Squat',     'legs', 11, '4', '10-12 per leg'),
    ('DB Goblet Squat',              'legs', 12, '3', '10-15'),
    ('DB Romanian Deadlift',         'legs', 13, '3', '8-12'),
    ('DB Sumo Squat',                'legs', 14, '3', '10-14'),
    ('DB Calf Raise',                'legs', 15, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-home  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-home') t,
(VALUES
    ('Incline Barbell Press',        'push', 1,  '4', '8-12'),
    ('Barbell Bench Press',          'push', 2,  '3', '6-10'),
    ('Barbell Overhead Press',       'push', 3,  '3', '6-10'),
    ('DB Lateral Raise',             'push', 4,  '3', '12-16'),
    ('DB Tricep Overhead Extension', 'push', 5,  '3', '10-15'),
    ('DB Single-Arm Row',            'pull', 6,  '4', '10-14'),
    ('Barbell Row',                  'pull', 7,  '3', '6-10'),
    ('DB Reverse Fly',               'pull', 8,  '3', '12-16'),
    ('DB Hammer Curl',               'pull', 9,  '3', '10-14'),
    ('DB Bicep Curl',                'pull', 10, '3', '10-14'),
    ('Romanian Deadlift',            'legs', 11, '3', '8-12'),
    ('Barbell Squat',                'legs', 12, '4', '5-8'),
    ('DB Bulgarian Split Squat',     'legs', 13, '3', '10-12 per leg'),
    ('DB Sumo Squat',                'legs', 14, '3', '10-14'),
    ('DB Calf Raise',                'legs', 15, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;

-- ppl-gym  Push B / Pull B / Legs B
INSERT INTO template_exercises (template_id, exercise_id, workout_type, variant, "order", sets, reps)
SELECT t.id, e.id, v.workout_type, 'B', v.ord, v.sets, v.reps
FROM (SELECT id FROM routine_templates WHERE slug = 'ppl-gym') t,
(VALUES
    ('Incline Barbell Press',    'push', 1,  '4', '8-12'),
    ('Barbell Bench Press',      'push', 2,  '3', '6-10'),
    ('Barbell Overhead Press',   'push', 3,  '3', '6-10'),
    ('Cable Lateral Raise',      'push', 4,  '3', '12-16'),
    ('Close-Grip Bench Press',   'push', 5,  '3', '8-12'),
    ('Pec Deck',                 'push', 6,  '3', '12-15'),
    ('Seated Cable Row',         'pull', 7,  '4', '10-14'),
    ('Barbell Row',              'pull', 8,  '3', '6-10'),
    ('Lat Pulldown',             'pull', 9,  '3', '8-12'),
    ('Face Pull',                'pull', 10, '3', '15-20'),
    ('EZ-Bar Curl',              'pull', 11, '3', '8-12'),
    ('Barbell Bicep Curl',       'pull', 12, '3', '8-12'),
    ('Romanian Deadlift',        'legs', 13, '3', '8-12'),
    ('Barbell Squat',            'legs', 14, '4', '5-8'),
    ('Hack Squat',               'legs', 15, '3', '8-12'),
    ('Leg Curl Machine',         'legs', 16, '3', '12-15'),
    ('Leg Extension Machine',    'legs', 17, '3', '12-15'),
    ('Calf Raise Machine',       'legs', 18, '3', '15-20')
) AS v(name, workout_type, ord, sets, reps)
JOIN exercises e ON e.name = v.name AND e.user_id IS NULL;
```

- [ ] **Step 3: Apply migration in Supabase SQL editor**

After running, verify with:
```sql
SELECT t.slug, te.workout_type, te.variant, COUNT(*) as exercises
FROM template_exercises te
JOIN routine_templates t ON t.id = te.template_id
WHERE t.slug IN ('upper-lower-db', 'full-body-db', 'ppl-gym')
GROUP BY t.slug, te.workout_type, te.variant
ORDER BY t.slug, te.workout_type, te.variant;
```

Expect: two rows per (slug, workout_type) pair for eligible templates — one A and one B.

- [ ] **Step 4: Update `cloneTemplate` in `src/app/pulse/actions.ts` to pass `variant`**

Find the `cloneTemplate` function. Update the `select` string to include `variant`:

```typescript
const { data: template } = await supabase
    .from('routine_templates')
    .select('id, name, schedule_pattern, default_days, template_exercises(exercise_id, workout_type, variant, order, sets, reps)')
    .eq('slug', slug)
    .single();
```

Update the type annotation for `rawExercises`:
```typescript
const rawExercises = (template as any).template_exercises as Array<{
    exercise_id: string; workout_type: string; variant: string | null; order: number; sets: string; reps: string;
}>;
```

Update the insert to include `variant`:
```typescript
exercises.map((te) => ({
    routine_id: routine.id,
    exercise_id: te.exercise_id,
    workout_type: te.workout_type,
    variant: te.variant ?? null,
    order: te.order,
    sets: te.sets,
    reps: te.reps,
    starting_weight_kg: null,
})),
```

Also update `applyVolume` to group by `(workout_type, variant)` so volume reduction works correctly per variant group:

```typescript
function applyVolume(
    exercises: Array<{ exercise_id: string; workout_type: string; variant: string | null; order: number; sets: string; reps: string }>,
    sessionTime: string,
): typeof exercises {
    if (sessionTime === '~30 min') {
        const groups: Record<string, typeof exercises> = {};
        for (const ex of exercises) {
            const key = ex.variant ? `${ex.workout_type}:${ex.variant}` : ex.workout_type;
            groups[key] = groups[key] ?? [];
            groups[key].push(ex);
        }
        return Object.values(groups)
            .flatMap((group) => group.slice(0, 4))
            .map((ex) => ({ ...ex, sets: adjustSets(ex.sets, -1) }));
    }
    if (sessionTime === '90+ min') {
        return exercises.map((ex) => ({ ...ex, sets: adjustSets(ex.sets, 1) }));
    }
    return exercises;
}
```

- [ ] **Step 5: Also update `addExerciseToRoutine` in `src/app/pulse/actions.ts` to accept an optional `variant` parameter**

Update the function signature:
```typescript
export async function addExerciseToRoutine(
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
    variant?: 'A' | 'B' | null,
): Promise<RoutineExercise> {
```

Update the insert to include `variant`:
```typescript
const { data, error } = await supabase
    .from('routine_exercises')
    .insert({
        routine_id: routineId,
        exercise_id: exerciseId,
        workout_type: workoutType,
        variant: variant ?? null,
        order: nextOrder,
        sets,
        reps,
        starting_weight_kg: startingWeightKg,
    })
    .select('id, routine_id, exercise_id, workout_type, variant, order, sets, reps, starting_weight_kg, exercise:exercises ( id, name, category, default_sets, default_reps, user_id )')
    .single();
```

Also update the same field in `useRoutines.ts` (the hook wrapper) to pass `variant` through:

In `src/hooks/pulse/useRoutines.ts`, update `addExerciseToRoutine`:
```typescript
const addExerciseToRoutine = useCallback(async (
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
    variant?: 'A' | 'B' | null,
): Promise<RoutineExercise> => {
    const re = await serverAddExerciseToRoutine(routineId, exerciseId, sets, reps, startingWeightKg, workoutType, variant);
    await mutateRoutines();
    return re;
}, [mutateRoutines]);
```

And update `PulseContext.ts` to match:
```typescript
addExerciseToRoutine: (
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
    variant?: 'A' | 'B' | null,
) => Promise<RoutineExercise>;
```

- [ ] **Step 6: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no new errors beyond any pre-existing ones.

- [ ] **Step 7: Commit**

```bash
git add docs/migrations/2026-05-29-template-ab-data.sql src/app/pulse/actions.ts src/hooks/pulse/useRoutines.ts src/context/PulseContext.ts
git commit -m "feat(ab): template A/B data migration + cloneTemplate passes variant"
```

---

## Task 7: Routine Editor — A/B Tabs

**Files:**
- Modify: `src/lib/pulse/types.ts` (already updated in Task 2)
- Modify: `src/hooks/pulse/useUIState.ts`
- Modify: `src/components/pulse/PulseProvider.tsx`
- Modify: `src/context/PulseContext.ts`
- Modify: `src/components/pulse/WorkoutTabs.tsx`

- [ ] **Step 1: Update `useUIState.ts` — `activeTab` type to `TabKey`**

Open `src/hooks/pulse/useUIState.ts`. Replace:
```typescript
import type { WorkoutType } from '@/lib/pulse/types';
```
with:
```typescript
import type { TabKey } from '@/lib/pulse/types';
```

Replace:
```typescript
const [activeTab, setActiveTab] = useState<WorkoutType>('push');
```
with:
```typescript
const [activeTab, setActiveTab] = useState<TabKey>('push');
```

- [ ] **Step 2: Add `routineExercisesByTabKey` to `PulseProvider.tsx`**

Open `src/components/pulse/PulseProvider.tsx`. Add this import at the top:
```typescript
import type { TabKey } from '@/lib/pulse/types';
```

After the existing `routineExercisesByType` useMemo, add:
```typescript
const routineExercisesByTabKey = useMemo((): Partial<Record<TabKey, RoutineExercise[]>> => {
    if (!activeRoutine) return {};
    const sorted = [...activeRoutine.exercises].sort((a, b) => a.order - b.order);
    const result: Partial<Record<TabKey, RoutineExercise[]>> = {};
    for (const re of sorted) {
        const key: TabKey = re.variant ? `${re.workout_type}:${re.variant}` : re.workout_type;
        (result[key] ??= []).push(re);
    }
    return result;
}, [activeRoutine]);
```

Add `routineExercisesByTabKey` to the `contextValue` object (alongside `routineExercisesByType`).

- [ ] **Step 3: Add `routineExercisesByTabKey` to `PulseContext.ts`**

Open `src/context/PulseContext.ts`. Add the import:
```typescript
import type { ..., TabKey } from '@/lib/pulse/types';
```

Update `activeTab` type in the interface:
```typescript
activeTab: TabKey;
setActiveTab: (tab: TabKey) => void;
```

Add to the interface:
```typescript
routineExercisesByTabKey: Partial<Record<TabKey, RoutineExercise[]>>;
```

- [ ] **Step 4: Update `WorkoutTabs.tsx` to render A/B variant tabs**

Replace the entire file:

```typescript
'use client';
import { useEffect } from 'react';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_ORDER, tabKeyLabel } from '@/lib/pulse/constants';
import type { TabKey, WorkoutType } from '@/lib/pulse/types';
import TabButton from './TabButton';

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByTabKey, logs, activeWeek } = usePulse();

    // Build ordered tab list: first non-variant tabs in WORKOUT_TYPE_ORDER order,
    // then variant tabs sorted by base type order then A before B.
    const tabs: TabKey[] = (() => {
        const keys = Object.keys(routineExercisesByTabKey) as TabKey[];
        return [...keys].sort((a, b) => {
            const baseA = a.includes(':') ? (a.split(':')[0] as WorkoutType) : (a as WorkoutType);
            const baseB = b.includes(':') ? (b.split(':')[0] as WorkoutType) : (b as WorkoutType);
            const orderA = WORKOUT_TYPE_ORDER.indexOf(baseA);
            const orderB = WORKOUT_TYPE_ORDER.indexOf(baseB);
            if (orderA !== orderB) return orderA - orderB;
            return a < b ? -1 : 1; // 'push:A' before 'push:B'
        });
    })();

    useEffect(() => {
        if (tabs.length > 0 && !tabs.includes(activeTab)) {
            setActiveTab(tabs[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.join(',')]);

    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveTab(tabs[(idx + 1) % tabs.length]);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
        }
    }

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
            {tabs.map((key, idx) => {
                const active = activeTab === key;
                const exercises = routineExercisesByTabKey[key] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                return (
                    <TabButton
                        key={key}
                        id={`tab-${key}`}
                        active={active}
                        controls={`panel-${key}`}
                        onClick={() => setActiveTab(key)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="flex items-center gap-2 py-2 px-4 rounded-full">
                        <span className="font-pulse text-sm font-semibold">{tabKeyLabel(key)}</span>
                    </TabButton>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 5: Update `LogView.tsx` to use `routineExercisesByTabKey`**

Open `src/components/pulse/views/LogView.tsx`. In the destructure from `usePulse()`, replace `routineExercisesByType` with `routineExercisesByTabKey`.

Update the exercises line:
```typescript
const routineExercises = routineExercisesByTabKey[activeTab] ?? [];
```

Update the panel aria attributes:
```typescript
aria-labelledby={activeSchedule.length > 0 ? `tab-day-${activeDay}` : `tab-${activeTab}`}
id={`panel-${activeTab}`}
```

(These already use `activeTab` so they'll work with TabKey strings.)

- [ ] **Step 6: Run tests to catch regressions**

```bash
npx vitest run src/components/pulse/__tests__/WorkoutTabs.test.tsx
npx vitest run src/components/pulse/__tests__/LogView.test.tsx
```

Fix any failures — they'll likely be about updated prop types or missing `routineExercisesByTabKey` in mocks. Update test mocks to include `routineExercisesByTabKey: {}` in the context mock value.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/pulse/useUIState.ts src/components/pulse/PulseProvider.tsx src/context/PulseContext.ts src/components/pulse/WorkoutTabs.tsx src/components/pulse/views/LogView.tsx
git commit -m "feat(ab): A/B variant tabs in WorkoutTabs; routineExercisesByTabKey in context"
```

---

## Task 8: WorkoutModeScreen Component

**Files:**
- Create: `src/components/pulse/WorkoutModeScreen.tsx`
- Create: `src/components/pulse/__tests__/WorkoutModeScreen.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```typescript
// src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkoutModeScreen from '../WorkoutModeScreen';
import type { RoutineExercise, Logs } from '@/lib/pulse/types';

const mockExercise = (id: string, name: string): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: 'e1',
    workout_type: 'push',
    variant: 'A',
    order: 1,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    rest_seconds: null,
    exercise: { id: 'e1', name, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

const defaultProps = {
    exercises: [mockExercise('re1', 'Bench Press'), mockExercise('re2', 'OHP')],
    sessionId: 'sess1',
    variant: 'A' as const,
    week: 1,
    logs: {} as Logs,
    unit: 'kg' as const,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onComplete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
};

describe('WorkoutModeScreen', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows first exercise and progress', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument();
    });

    it('advances to next exercise on Next click', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByText('OHP')).toBeInTheDocument();
        expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument();
    });

    it('shows Finish button on last exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        expect(screen.getByRole('button', { name: /finish workout/i })).toBeInTheDocument();
    });

    it('calls onComplete when Finish is clicked', async () => {
        render(<WorkoutModeScreen {...defaultProps} exercises={[mockExercise('re1', 'Bench Press')]} />);
        fireEvent.click(screen.getByRole('button', { name: /finish workout/i }));
        expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    it('navigates back to previous exercise', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /next exercise/i }));
        fireEvent.click(screen.getByRole('button', { name: /previous exercise/i }));
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        render(<WorkoutModeScreen {...defaultProps} />);
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement `WorkoutModeScreen.tsx`**

```typescript
// src/components/pulse/WorkoutModeScreen.tsx
'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, computeLastSession } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { RoutineExercise, Logs, LogEntry, Unit, WorkoutVariant } from '@/lib/pulse/types';

interface Props {
    exercises: RoutineExercise[];
    sessionId: string;
    variant: WorkoutVariant | null;
    week: number;
    logs: Logs;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    onComplete: () => Promise<void>;
    onClose: () => void;
}

export default function WorkoutModeScreen({
    exercises,
    variant,
    week,
    logs,
    unit,
    onSave,
    onDelete,
    onComplete,
    onClose,
}: Props) {
    const [exerciseIdx, setExerciseIdx] = useState(0);
    const [completing, setCompleting] = useState(false);

    const re = exercises[exerciseIdx];
    const isFirst = exerciseIdx === 0;
    const isLast = exerciseIdx === exercises.length - 1;
    const maxSets = parseMaxSets(re.sets);
    const lastSession = computeLastSession(logs, re.id, week);

    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, re.id, i)).filter(
        (k) => logs[k]?.saved,
    ).length;

    function handleSave(key: string, entry: LogEntry) {
        onSave(key, entry);
    }

    async function handleFinish() {
        setCompleting(true);
        await onComplete();
        setCompleting(false);
    }

    return (
        <div className="fixed inset-0 z-50 bg-pulse-bg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 border-b border-pulse-border">
                <button
                    aria-label="previous exercise"
                    onClick={() => setExerciseIdx((i) => i - 1)}
                    disabled={isFirst}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    ‹
                </button>
                <div className="text-center">
                    <div className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase text-pulse-muted">
                        Exercise {exerciseIdx + 1} of {exercises.length}
                        {variant ? ` · Variant ${variant}` : ''}
                    </div>
                </div>
                <button
                    aria-label="close"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-pulse-border text-pulse-dim cursor-pointer">
                    ✕
                </button>
            </div>

            {/* Exercise content */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
                <h2 className="font-pulse text-xl font-bold text-pulse-text mb-1">{re.exercise.name}</h2>
                <p className="font-pulse text-sm text-pulse-muted mb-5">
                    {re.sets} sets · {re.reps} reps
                    {lastSession ? ` · Last: ${lastSession.kg}kg × ${lastSession.reps}` : ''}
                </p>

                <div className="flex flex-col gap-2">
                    {Array.from({ length: maxSets }, (_, s) => {
                        const key = logKey(week, re.id, s);
                        return (
                            <SetLogger
                                key={key}
                                logKey={key}
                                setIdx={s}
                                entry={logs[key]}
                                unit={unit}
                                onSave={handleSave}
                                onDelete={onDelete}
                            />
                        );
                    })}
                </div>

                <div className="mt-3 font-pulse text-xs text-pulse-muted">
                    {savedCount} / {maxSets} sets logged
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-safe-bottom pb-6 pt-3 border-t border-pulse-border flex flex-col gap-2">
                {!isLast ? (
                    <button
                        aria-label="next exercise"
                        onClick={() => setExerciseIdx((i) => i + 1)}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none">
                        Next exercise →
                    </button>
                ) : (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing}
                        className="font-pulse w-full py-3 rounded-xl bg-pulse-accent text-black font-semibold text-sm cursor-pointer border-none disabled:opacity-60">
                        {completing ? 'Finishing…' : 'Finish workout ✓'}
                    </button>
                )}
                {!isLast && (
                    <button
                        aria-label="finish workout"
                        onClick={handleFinish}
                        disabled={completing}
                        className="font-pulse w-full py-2 rounded-xl text-pulse-muted text-sm cursor-pointer border-none bg-transparent">
                        Finish workout early
                    </button>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/pulse/WorkoutModeScreen.tsx src/components/pulse/__tests__/WorkoutModeScreen.test.tsx
git commit -m "feat(ab): WorkoutModeScreen component with tests"
```

---

## Task 9: Wire LogView — "Start Workout" Button

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1: Update `LogView.tsx` to integrate session creation and workout mode**

Replace the entire file:

```typescript
'use client';
import { useState } from 'react';
import { logKey, getPhase, getRIR, weekHasData, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { useWorkoutSession } from '@/hooks/pulse/useWorkoutSession';
import WorkoutTabs from '../WorkoutTabs';
import DayTabs from '../DayTabs';
import ExerciseCard from '../ExerciseCard';
import WorkoutModeScreen from '../WorkoutModeScreen';
import type { LogEntry, RoutineExercise } from '@/lib/pulse/types';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        activeDay,
        activeSchedule,
        logs,
        profile,
        prMap,
        activeRoutine,
        routineExercisesByTabKey,
        navigate,
        updateLog,
        deleteLog,
        fireTrigger,
        notes,
        saveNote,
        deleteNote,
    } = usePulse();

    const { session, startSession, completeSession, clearSession } = useWorkoutSession();
    const [workoutModeOpen, setWorkoutModeOpen] = useState(false);

    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;
    const routineExercises: RoutineExercise[] = routineExercisesByTabKey[activeTab] ?? [];

    const hasData = routineExercises.some((re) =>
        Array.from({ length: parseMaxSets(re.sets) }, (_, s) => logKey(activeWeek, re.id, s)).some(
            (k) => logs[k]?.saved,
        ),
    );

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        const rid = key.slice(firstDash + 1, lastDash);
        const exercise = routineExercises.find((r) => r.id === rid);
        fireTrigger(exercise?.rest_seconds ?? undefined);
    }

    async function handleStartWorkout() {
        if (!activeRoutine) return;
        const baseType = activeTab.includes(':') ? activeTab.split(':')[0] : activeTab;
        const sess = await startSession(activeRoutine.id, baseType);
        setWorkoutModeOpen(true);
        // If session variant differs from active tab variant, switch to matching tab
        if (sess.variant) {
            const matchingTab = `${baseType}:${sess.variant}` as typeof activeTab;
            if (routineExercisesByTabKey[matchingTab]) {
                // tab switch handled by WorkoutModeScreen receiving the right exercises
            }
        }
    }

    async function handleCompleteWorkout() {
        if (!session) return;
        await completeSession(session.id);
        setWorkoutModeOpen(false);
    }

    function handleCloseWorkoutMode() {
        clearSession();
        setWorkoutModeOpen(false);
    }

    // Exercises shown in workout mode: filter by session variant if present
    const workoutExercises = (() => {
        if (!session?.variant) return routineExercises;
        const baseType = activeTab.includes(':') ? activeTab.split(':')[0] : activeTab;
        const variantTab = `${baseType}:${session.variant}` as typeof activeTab;
        return routineExercisesByTabKey[variantTab] ?? routineExercises;
    })();

    if (!activeRoutine) {
        return (
            <div className="py-16 px-6 flex flex-col items-center gap-4 text-center">
                <div className="font-pulse text-[0.8125rem] tracking-[0.1em] uppercase text-pulse-muted">
                    No routine active
                </div>
                <div className="font-pulse text-sm text-pulse-dim max-w-[260px]">
                    Create a routine in the Library to start logging your workouts.
                </div>
                <button
                    onClick={() => navigate('explore')}
                    className="font-pulse text-sm font-semibold bg-pulse-accent text-black rounded-lg px-5 py-2.5 cursor-pointer border-none">
                    Go to Library
                </button>
            </div>
        );
    }

    return (
        <div>
            {workoutModeOpen && session && (
                <WorkoutModeScreen
                    exercises={workoutExercises}
                    sessionId={session.id}
                    variant={session.variant}
                    week={activeWeek}
                    logs={logs}
                    unit={unit}
                    onSave={handleSave}
                    onDelete={deleteLog}
                    onComplete={handleCompleteWorkout}
                    onClose={handleCloseWorkoutMode}
                />
            )}

            {activeSchedule.length > 0 ? <DayTabs /> : <WorkoutTabs />}

            <div className="flex px-4 gap-1 overflow-x-auto [scrollbar-width:none] pb-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    const hasWeekData = weekHasData(w, logs);
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
                            className={`font-pulse text-sm min-w-[2.25rem] h-8 flex flex-col items-center justify-center rounded-full border cursor-pointer shrink-0 transition-all duration-150 ${
                                active
                                    ? 'font-bold text-pulse-accent bg-pulse-accent/10 border-pulse-accent/25'
                                    : 'font-normal text-pulse-dim bg-transparent border-transparent hover:border-pulse-border'
                            }`}>
                            {w}
                            <span
                                className={`block w-1 h-1 rounded-full -mt-0.5 ${hasWeekData ? 'bg-pulse-accent' : 'bg-transparent'}`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3">
                <div className="flex items-center gap-3">
                    <span className="font-pulse text-xs font-semibold tracking-[0.08em] uppercase text-pulse-dim">
                        {phase.label}
                    </span>
                    <span className="font-pulse text-xs font-bold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-full px-2 py-0.5">{rir} RIR</span>
                </div>
                {routineExercises.length > 0 && (
                    <button
                        onClick={handleStartWorkout}
                        className="font-pulse text-xs font-semibold bg-pulse-accent text-black rounded-full px-3 py-1.5 cursor-pointer border-none">
                        Start workout
                    </button>
                )}
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={activeSchedule.length > 0 ? `tab-day-${activeDay}` : `tab-${activeTab}`}
                className="pt-1 px-4 pb-8 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-2">
                {routineExercises.map((re, i) => (
                    <ExerciseCard
                        key={re.id}
                        routineExercise={re}
                        exIdx={i}
                        week={activeWeek}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                        note={notes[`${activeWeek}-${re.id}`]}
                        onSaveNote={(n) => saveNote(activeWeek, re.id, n)}
                        onDeleteNote={() => deleteNote(activeWeek, re.id)}
                    />
                ))}
                {!hasData && (
                    <div className="pt-6 text-center">
                        <div className="font-pulse text-[0.8125rem] text-pulse-muted tracking-[0.04em]">
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. Fix any failures from type changes or mock updates.

- [ ] **Step 3: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/pulse/views/LogView.tsx
git commit -m "feat(ab): wire Start Workout button and WorkoutModeScreen into LogView"
```

---

## Done

After all 9 tasks:

- A/B variant exercises are seeded in all eligible templates
- Cloning a template copies variant data into `routine_exercises`
- `WorkoutTabs` renders "Push A" / "Push B" style tabs for A/B routines
- "Start workout" creates a session via the API, alternating A/B based on last completed session
- `WorkoutModeScreen` guides through exercises for the active variant one at a time
- Finishing the workout writes `completed_at`, advancing the alternation for next time
- Routines without variant data are entirely unaffected
