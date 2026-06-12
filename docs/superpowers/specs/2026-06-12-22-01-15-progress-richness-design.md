# Progress richness: recovery readout, strength trend, milestones

Date: 2026-06-12
Branch: `feature/progress-richness`
Status: design approved (visual mockups signed off via the brainstorm companion)

## Goal

Finish the three remaining "progress richness" pieces on the Progress **Overview** tab, building on the merged Progress redesign. The drill-in, workout calendar, and session detail already shipped; this spec covers:

1. **Compact recovery readout**: replace the "N flags" recovery tile with a status dot + word.
2. **Strength-score trend**: add a delta to the strength tile and a score-over-time line in the breakdown modal.
3. **Recent milestones surface**: a newest-first feed of self-referential wins (PRs, streak records, weeks completed, session counts), with a "Show all" modal.

All three are presentational/derivation work on top of existing data. No schema change, no server-action change, no generation-engine change.

Approved mockups live in `.superpowers/brainstorm/` (`overview-richness.html`, `tile-variations.html`, `tile-states.html`). The mockups are the visual contract.

## Build order (three independent diffs, reviewed separately)

1. Recovery readout (smallest, self-contained).
2. Strength trend (moderate).
3. Milestones (largest).

Each is its own commit on `feature/progress-richness`.

---

## Piece 1: Compact recovery readout

**Problem.** The Overview recovery tile shows `recoverySummaryWord(recovery)` which returns `'Fresh'` or `"N flags"`. `RecoveryStatus` is `'under' | 'optimal' | 'high_fatigue' | 'overreaching'`. The current word lumps `under` (below target volume = room to train, normal early in the week) together with real fatigue, so a fresh-but-untrained week reads as "9 flags", a false alarm.

**Design.** A new pure function maps the per-category recovery map to a single readout:

```ts
// src/lib/pulse/utils.ts (pure, unit-tested)
export type RecoveryTone = 'fresh' | 'ready' | 'watch' | 'easeoff' | 'none';
export interface RecoveryReadout {
    tone: RecoveryTone;
    word: string;          // 'Fresh' | 'Ready' | 'Watch' | 'Ease off' | 'No data'
    detail: string;        // sub-line: 'all muscles optimal' | 'room to build' | 'back · legs' | ...
    muscles: string[];     // category labels driving an amber/red state (for the sub-line)
}

export function recoveryReadout(
    recovery: Partial<Record<ExerciseCategory, Pick<RecoveryDetail, 'status'>>>,
): RecoveryReadout
```

Aggregation rule (worst meaningful state wins):

| Condition (across categories) | tone | word | dot color | detail |
| --- | --- | --- | --- | --- |
| map empty / no categories tracked | `none` | No data | `--color-pulse-muted` | "log a session" |
| any `overreaching` | `easeoff` | Ease off | `--color-pulse-error` | "high fatigue · {muscles}" |
| any `high_fatigue` (no overreaching) | `watch` | Watch | `#fb923c` (amber) | "{muscles}" |
| all `optimal` | `fresh` | Fresh | `--color-pulse-success` | "all muscles optimal" |
| otherwise (some `under`, none fatigued) | `ready` | Ready | `--color-pulse-success` | "room to build" |

`muscles` for the amber/red tones is the list of category labels at that status (humanized, e.g. `back`, `legs`), capped to the first 2-3 with a `+N` overflow in the component.

Amber is a literal `#fb923c` (no existing token); add `--color-pulse-warn: #fb923c;` to the `@theme` block in `globals.css` so the dot color is themeable and reused by milestones (the streak icon).

**Component.** The recovery tile lives inline in `HistoryView`'s Overview metric strip. Replace the `recoverySummary` number with a small dot + word + sub. Extract the tile into a tiny presentational `RecoveryTile` component (`src/components/pulse/RecoveryTile.tsx`) that takes a `RecoveryReadout` and renders dot/word/detail/label, so it is independently testable and the strip stays readable. `recoverySummaryWord` stays for any other caller but the Overview tile switches to `recoveryReadout`.

**Tests.** `recoveryReadout` pure-function tests for each tone branch + empty map. `RecoveryTile` renders word + dot tone.

---

## Piece 2: Strength-score trend

**Problem.** The strength tile shows a single all-time `computeStrengthScore(...)`. We want a delta on the tile and a line in the breakdown modal.

**Design.** A new pure function builds the score as a weekly series:

```ts
// src/lib/pulse/strength.ts (pure, unit-tested)
export function computeStrengthScoreSeries(args: {
    gender: Gender | null;
    bodyweightKg: number | null;
    // Per main-lift weekly e1RM history, already name-resolved by the caller.
    liftsByWeek: Array<{ name: string; history: Array<{ week: number; e1rm: number }> }>;
}): Array<{ week: number; score: number }>
```

Implementation: collect the set of weeks present across all histories. For each week `W`, build the cumulative best e1RM per lift (max e1RM at any week `<= W`), call the existing scoring path (`computeStrengthScore`), and keep `{ week: W, score }` for weeks that produce a non-null score. **Bodyweight is held at the current value across the series** (documented simplification): the strength score is relative strength, and intra-cycle bodyweight drift is small, so the series cleanly reflects e1RM progress. Note this in a code comment.

The caller (HistoryView) builds `liftsByWeek` by running `computeE1RMHistory(logs, re.id)` for each routine exercise whose name classifies as a main lift, paired with `nameMap`.

**Tile (B, delta only).** The strength tile shows:
- the current score (accent), unchanged;
- a delta line below: `▲ N this cycle` (green `--color-pulse-success`) when up, `▼ N this cycle` (muted `--color-pulse-dim`) when down, `no change` (muted) when flat, and `log lifts to see` when the series has fewer than 2 points;
- the `Strength ›` label, unchanged (still tappable to the breakdown modal).

Delta = `latestScore - firstScoreInWindow`. The window follows the existing Overview `progressWindow` only insofar as the series is built from `windowedLogs` (already in HistoryView); the wording is "this cycle" for the default Cycle window. (Keep it simple: the delta is last vs first point of the series passed in.)

No sparkline (direction B), so no new chart on the tile.

**Breakdown modal.** `StrengthBreakdownModal` gains an optional `series?: Array<{ week: number; score }>` prop. When it has ≥2 points, render a compact score-over-time line above the per-lift rows, reusing the existing line-chart treatment (`MetricLineChart` with `unitLabel=''` or a thin inline SVG matching `E1RMChart`'s style, pick `MetricLineChart`, it already takes `{date|week, value}`-style points; adapt points to `{ date: String(week), value: score }`). The modal already sits on the shared `ModalSheet`.

**Tests.** `computeStrengthScoreSeries`: rising series, single-week (one point), no main lifts (empty), null bodyweight (empty). Tile delta wording via a small render test or a pure `strengthDeltaLabel(series)` helper (preferred: extract the wording into a pure helper in utils/strength and unit-test it, so the component stays declarative).

---

## Piece 3: Recent milestones surface

**Problem.** No surface celebrates self-referential wins. This is explicitly on-vision (roadmap: self-referential milestones are on-vision; only the comparative/social kind is hard-out).

### Model

```ts
// src/lib/pulse/milestones.ts (new module, pure)
export type MilestoneKind = 'pr' | 'streak' | 'week_completed' | 'session_count';

export interface Milestone {
    id: string;        // stable key, e.g. `pr:${reId}:${week}`, React key + dedup
    kind: MilestoneKind;
    title: string;     // "New PR · Barbell Row"
    detail: string;    // "84 kg e1RM · +6% over your last best"
    dateIso: string;   // for relative formatting + newest-first sort
}

export function computeMilestones(input: {
    workouts: Workout[];                 // assembled, dated (started_at), newest-first or any order
    schedule: ScheduleEntry[];           // active routine's routine_schedule (for week boundaries)
    sessions: WorkoutSession[];          // for streak + week attribution
    programWeeks: number;                // for phase naming via getPhase
}): Milestone[]                          // sorted newest-first by dateIso
```

The kind → icon + accent mapping lives in the **component**, not the model (kinds are data, icons are presentation).

### Detectors (v1)

All dated from real session/workout dates.

1. **`pr`**: walk `workouts` oldest→newest; track a running best e1RM per exercise name (e1RM via the Epley helper `calcE1RM(kg, reps)`, exported from `utils.ts`). When a workout produces a new best for an exercise, emit a milestone dated at that workout. `detail` includes the e1RM and `+X%` over the prior best. Skip the very first appearance of an exercise (no prior best = not a "new" PR); the opening baseline is not a milestone.

2. **`streak`**: bucket sessions into ISO training-weeks; compute the longest consecutive run; emit a milestone each time the running max increases, dated at the session that set the new record. `title` "N-week streak", `detail` "your longest run yet". Reuse the week-bucketing approach consistent with `computeStreak`.

3. **`week_completed`**: replay the `attributeSessions` walk over completed sessions: each time a program week is fully completed (the cycle's remaining slots empty and the week index advances), emit a milestone dated at the boundary session. `title` "Completed Week N", `detail` the phase name from `getPhase(N, programWeeks)`.

4. **`session_count`**: emit at every 10th workout (10, 20, 30, …), dated at that workout. `title` "N sessions logged", `detail` "since you started".

**Future kinds (documented, not built):** `cycle_completed`, `first_back_after_gap`, `body_goal_reached`. The model + aggregator are extensible: add a detector, add a kind to the icon map. The user flagged milestones as valuable for the future, so keep the seam clean.

### Surfaces

- **Overview card**: `MilestonesCard` (`src/components/pulse/MilestonesCard.tsx`), under the metric strip (above Program). Shows the 4 most recent milestones as rows (icon tile + title + detail + relative date via `formatLogDate`). When more than 4 exist, a "Show all N milestones" button opens the modal.
- **Modal**: reuse `ModalSheet` with the count subtitle (`"N milestones"`), listing all milestones newest-first (optionally month-grouped like `MetricHistoryModal`; v1 can be a flat list). Mirrors the AllWorkouts/AllLifts pattern. No back-nav needed (terminal surface).
- Empty state: if `computeMilestones` returns nothing, render nothing (no empty card on the Overview).

### Wiring

`HistoryView` already has `workouts` (assembled), `workoutSessions`, `activeRoutine` (→ `routine_schedule` for `schedule`), and `activeRoutine.program_weeks`. Compute `milestones` in a `useMemo` and pass to `MilestonesCard`. Add the card + its modal to the Overview panel.

### Tests

`computeMilestones` per detector: a PR after a baseline (and no milestone for the baseline), a new streak record, a completed week boundary, a 10th-session count. Sort order newest-first. `MilestonesCard` renders rows + the "Show all" button only past the cap.

---

## Out of scope

- Schema / migration / server-action changes (none needed).
- Push notifications or "new!" badges for milestones (future).
- Comparative/social milestones (hard-out permanently).
- Per-week bodyweight in the strength series (uses current bodyweight; documented).
- Future milestone kinds listed above.

## Testing summary

Pure functions carry the logic and the tests: `recoveryReadout`, `computeStrengthScoreSeries` (+ `strengthDeltaLabel`), `computeMilestones` (+ `calcE1RM` export). Components (`RecoveryTile`, `MilestonesCard`) get light render tests. No server-action test harness (actions hit Supabase). Run the full suite after each of the three diffs.
