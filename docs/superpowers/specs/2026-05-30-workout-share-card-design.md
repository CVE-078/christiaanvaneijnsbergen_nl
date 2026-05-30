# Workout Share Card — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Goal

Show a polished, screenshot-friendly summary card immediately after a user finishes a workout session. The user screenshots it to share — no Web Share API, no canvas export, no third-party libraries.

---

## Trigger

The share card appears automatically when `handleCompleteWorkout` resolves in `LogView` (after the user taps "Finish workout" or "Finish workout early" in `WorkoutModeScreen`). It is not accessible from history — post-completion only.

---

## Data Layer

### `computeShareStats`

New pure function added to `src/lib/pulse/utils.ts`.

**Signature:**
```ts
function computeShareStats(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
): ShareStats
```

**Return type:**
```ts
interface ShareStats {
    workoutLabel: string;   // "Push Day", "Full Body", "Upper Day", etc.
    date: string;           // "Sat 30 May"
    durationMin: number;    // floor((completedAt - session.started_at) / 60000)
    totalSets: number;      // count of saved log entries for these exercises this week
    topLifts: Array<{
        name: string;
        displayWeight: number;
        reps: number;
        isPR: boolean;
    }>;
    prCount: number;        // total PRs hit this session
}
```

**Rules:**
- `workoutLabel` maps `workout_type` to a human label: `push` → `"Push Day"`, `pull` → `"Pull Day"`, `legs` → `"Leg Day"`, `chest` → `"Chest Day"`, `back` → `"Back Day"`, `shoulders` → `"Shoulder Day"`, `arms` → `"Arms Day"`, `upper` → `"Upper Day"`, `lower` → `"Lower Day"`, `full_body` → `"Full Body"`. Append `" · Variant A"` or `" · Variant B"` if `session.variant` is set.
- `topLifts` is the top 3 exercises by best e1RM (`calcE1RM(kg, reps)`) from saved sets logged this week for these exercises. One entry per exercise (best set wins). Sorted descending by e1RM. `isPR` is true when that set's e1RM equals or exceeds the stored `prMap` entry.
- `completedAt` is captured client-side in `handleCompleteWorkout` as `new Date().toISOString()` — avoids requiring the PATCH response to return the updated session.
- If `durationMin` is negative or NaN (clock skew, malformed timestamp), fall back to `0`.

**Tests:** added to `src/lib/pulse/__tests__/utils.test.ts`.

---

## Component

### `ShareCard.tsx`

New file: `src/components/pulse/ShareCard.tsx`

**Props:**
```ts
interface Props {
    session: WorkoutSession;
    completedAt: string;
    exercises: RoutineExercise[];
    logs: Logs;
    prMap: PRMap;
    week: number;
    unit: Unit;
    onDismiss: () => void;
}
```

**Layout (top to bottom, fixed full-screen overlay, `z-50`, dark `bg-pulse-bg`):**

1. **Branding** — "Pulse." wordmark with accent dot, small muted tagline "Your workout, logged."
2. **Workout header** — workout label in large bold text; variant chip ("Variant A") if `session.variant` is set; date in muted text below
3. **Stats row** — three pill chips: duration ("47 min"), total sets ("24 sets"), week ("Week 3")
4. **Top lifts list** — up to 3 rows: exercise name (truncated), weight × reps, PR badge if earned
5. **PR summary line** — "2 PRs this session 🏆" in accent colour; hidden when `prCount === 0`
6. **Footer** — muted "Screenshot to share" hint; full-width "Done" button

**Styling:** uses existing `pulse-*` design tokens throughout. No new CSS classes or tokens needed.

**Tests:** added to `src/components/pulse/__tests__/ShareCard.test.tsx`.

---

## LogView Integration

**File:** `src/components/pulse/views/LogView.tsx`

**Changes:**

1. Add state:
   ```ts
   const [shareSession, setShareSession] = useState<{
       session: WorkoutSession;
       completedAt: string;
   } | null>(null);
   ```

2. Replace `handleCompleteWorkout`:
   ```ts
   async function handleCompleteWorkout() {
       if (!session) return;
       const completedAt = new Date().toISOString();
       const completedSession = session;
       try { await completeSession(completedSession.id); } catch { }
       setWorkoutModeOpen(false);
       setShareSession({ session: completedSession, completedAt });
   }
   ```

3. Render `<ShareCard>` when `shareSession !== null`:
   ```tsx
   {shareSession && (
       <ShareCard
           session={shareSession.session}
           completedAt={shareSession.completedAt}
           exercises={workoutExercises}
           logs={logs}
           prMap={prMap}
           week={activeWeek}
           unit={unit}
           onDismiss={() => setShareSession(null)}
       />
   )}
   ```

`WorkoutModeScreen` and `ShareCard` never render simultaneously.

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/lib/pulse/utils.ts` — add `computeShareStats`, `ShareStats` type |
| Modify | `src/lib/pulse/__tests__/utils.test.ts` — add `computeShareStats` tests |
| Create | `src/components/pulse/ShareCard.tsx` |
| Create | `src/components/pulse/__tests__/ShareCard.test.tsx` |
| Modify | `src/components/pulse/views/LogView.tsx` — add share state + render ShareCard |

---

## Out of Scope

- Sharing from session history (HistoryView) — post-completion only
- Web Share API / navigator.share
- Canvas/PNG export
- Saving share card images server-side
