# Exercise Instructions — Design Spec

## Goals

- Add curated instructions (primary/secondary muscles + technique cues) to all global exercises
- Surface instructions via a ⓘ modal accessible from both the train screen (ExerciseCard) and the Library (Exercises tab)
- Keep the page load lean — instructions are fetched on demand when the modal is opened

## Non-goals

- User-created exercises getting instructions (global exercises only for v1)
- User-editable instructions
- SVG body map / muscle diagrams (text chips are sufficient)
- Exercise photos or video links

---

## Data Model

### Migration

```sql
CREATE TABLE exercise_instructions (
    exercise_id UUID PRIMARY KEY REFERENCES exercises(id) ON DELETE CASCADE,
    primary_muscles TEXT[] NOT NULL DEFAULT '{}',
    secondary_muscles TEXT[] NOT NULL DEFAULT '{}',
    cues TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE exercise_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructions_read_all" ON exercise_instructions
    FOR SELECT USING (true);
```

### TypeScript

New interface in `src/lib/pulse/types.ts`:

```ts
export interface ExerciseInstruction {
    exercise_id: string;
    primary_muscles: string[];
    secondary_muscles: string[];
    cues: string[];
}
```

### Key invariants

- One row per global exercise (`user_id IS NULL` on exercises table)
- `exercise_id` is the primary key — no duplicates possible
- Muscle names are free-text strings, not an enum
- Cues are short, action-oriented sentences (2–4 per exercise)

---

## API

### `GET /api/pulse/exercises/[id]/instructions`

- Validates `id` as UUID
- Requires auth (401 if not logged in — consistent with all other routes)
- RLS policy allows all authenticated users to read any row
- Returns the `ExerciseInstruction` row, or `404` if not found (user-created exercise or not yet seeded)

No write routes — instructions are seeded only, not client-editable.

---

## Content Seeding

Two files run in order in Supabase SQL Editor:

1. `docs/migrations/2026-05-31-exercise-instructions.sql` — table + RLS
2. `docs/migrations/2026-05-31-exercise-instructions-seed.sql` — INSERT rows for all ~60 global exercises

**Seed pattern:**

```sql
INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id,
    ARRAY['Chest', 'Triceps'],
    ARRAY['Front Delts', 'Core'],
    ARRAY[
        'Retract and depress your shoulder blades before unracking',
        'Lower the bar to your lower chest with elbows at 45–75° from your torso',
        'Drive your feet into the floor and press the bar in a slight arc back toward your face'
    ]
FROM exercises WHERE name = 'Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;
```

The seed covers every exercise whose `user_id IS NULL` in the global seed. `ON CONFLICT DO NOTHING` makes the seed idempotent.

---

## UI Components

### `ExerciseInstructionModal`

New component at `src/components/pulse/ExerciseInstructionModal.tsx`.

**Props:**
```ts
interface Props {
    exerciseId: string;
    exerciseName: string;
    onClose: () => void;
}
```

**Behaviour:**
- Fetches `GET /api/pulse/exercises/${exerciseId}/instructions` on mount
- Loading state: spinner / skeleton rows while fetching
- Error / 404 state: "No instructions available" message
- Success state: renders the instruction content

**Layout:**
- Fixed overlay with semi-transparent backdrop (tap to dismiss)
- Panel slides up from the bottom on mobile; centered on desktop (≥ 1024 px)
- Header: exercise name + ✕ close button
- "Primary" section: muscle name chips (purple accent, `bg-pulse-accent/10 text-pulse-accent border-pulse-accent/25`)
- "Secondary" section: muscle name chips (dim style, `bg-pulse-surface text-pulse-dim border-pulse-border`)
- "Cues" section: numbered items with purple index chip and body text
- `z-index` above ExerciseCard but below any existing global overlays

### `ExerciseCard` changes

The collapsed card header gains a ⓘ button — only rendered when `exercise.user_id === null` (global exercise).

Tapping ⓘ sets local state `showInstructions: boolean` to true, rendering `ExerciseInstructionModal`.

The ⓘ button sits between the sets×reps meta text and the progress pips in the header row. Styled as a small circular icon (`w-5 h-5`, `text-pulse-dim`, `bg-transparent`, `border-none`).

### Library Exercises tab changes (`ExercisesTab` in LibraryView)

Each exercise row in the global exercise list gains the same ⓘ button. User-created exercises (non-null `user_id`) do not show it.

Tapping ⓘ opens the same `ExerciseInstructionModal` with the exercise's id and name.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Exercise has no instruction row (user-created) | ⓘ button not rendered — no modal shown |
| API returns 404 for a global exercise not yet seeded | Modal shows "No instructions available" |
| Network error during fetch | Modal shows error state with retry option |
| Modal opened while ExerciseCard is expanded | Modal overlays card, card state preserved on close |
| Same exercise appears in multiple routines | Instructions are per exercise ID — same modal content everywhere |
