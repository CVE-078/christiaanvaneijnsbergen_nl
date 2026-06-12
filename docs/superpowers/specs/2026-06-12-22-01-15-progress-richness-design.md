# Progress richness: recovery readout, strength trend, milestones

Date: 2026-06-12
Branch: `feature/progress-richness`
Status: design approved (visual mockups signed off via the brainstorm companion); amended 2026-06-12 for review findings 1-6.

## Review amendments (2026-06-12)

What changed per review finding. Zero-change guarantee (no schema, no server-action, no generation change) is intact; the only code-surface note is exporting the existing pure `calcE1RM` from `utils.ts`, which is none of those.

1. **One PR definition.** Confirmed `computePRMap` / `isSetPR` both key off `calcE1RM` (Epley) and return *current bests only*, with no dated "when each best was set" history. The milestone PR detector no longer frames itself as a parallel running-best source of truth: it is the dated read-side derivation of the **same** rule (`calcE1RM`, best-e1RM-per-exercise), reading dates off session-linked set logs. The `progression` DecisionEvent was rejected as a source (it is a coaching-target bump on `targets_hit`, a different concept, not the PR-badge definition). Known limitation documented: only session-linked PRs can be dated.
2. **week_completed wraps the block.** Title uses `weekInBlock(N, programWeeks)` and phase uses `getPhase(N, programWeeks)` (both already wrap internally), so a 2nd-cycle week reads "Completed Week 1", never "Completed Week 27". Matches the Overview tile + ProgramStatusCard week naming.
3. **streak emits once per record.** Corrected the bucketing: reuse `computeStreak`'s **program-week** bucketing (log-key week segment), not ISO calendar weeks. Emit once when the running all-time-longest run reaches a new max, not every consecutive week.
4. **strength bodyweight comment reworded.** Not "drift is small" (false on a cut/recomp); the series deliberately isolates e1RM progress, and bodyweight change is covered by the Recomp dashboard. No logic change.
5. **Fresh vs Ready green is intentional.** Both render `--color-pulse-success`; the dot answers "are you in a good place?" (green = yes), the word carries the nuance (all-optimal vs room-to-build). Amber/red are the only action-needed dots.
6. **Milestones backfill on first load.** All four detectors run over full history every load (pure derivations, nothing persisted), so existing users and the seeded test accounts get a backfilled feed of past wins, not only events from launch forward. Intended.

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

**Fresh and Ready deliberately share the green dot.** The dot answers one question, "are you in a good place?", and both states are (all-optimal, and under-target-with-room are both fine). The word carries the distinction; the dot does not. Only `watch` (amber) and `easeoff` (red) signal action, so reserving the non-green dots for them keeps the glance honest. This is intentional, not an oversight, do not split Ready into a separate tint.

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

Implementation: collect the set of weeks present across all histories. For each week `W`, build the cumulative best e1RM per lift (max e1RM at any week `<= W`), call the existing scoring path (`computeStrengthScore`), and keep `{ week: W, score }` for weeks that produce a non-null score. **Bodyweight is held at the current value across the series** (deliberate, not a fidelity shortcut). Code-comment guidance: the series intentionally isolates e1RM progress so the trend reads as "are my lifts going up." Bodyweight change is not folded in here; it is covered separately by the Recomp dashboard (the same user on a cut/recomp would otherwise see their strength score move from weight loss rather than lifting, conflating two signals). Do not justify it as "intra-cycle drift is small", that is false for the cut/recomp user this app serves.

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
    id: string;        // stable key (React key + dedup). Per kind: `pr:${reId}:${week}`, `streak:${runLength}`, `week:${absoluteWeek}`, `count:${n}`
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

### PR definition (single source)

There is **one** PR definition in the app and the milestone feed must use it: a PR is a new best `calcE1RM(kg, reps)` (Epley, `utils.ts`) for an exercise. The live PR badge uses `computePRMap(logs)` (per-exercise best e1RM) and `isSetPR(kg, reps, reId, prMap)`. **`computePRMap` returns current bests only, with no dated "when each best was set" history**, so the milestone feed cannot read dated PRs straight from it.

Chosen source for *dated* PR events: walk the assembled `workouts` (set logs joined to their session via `session_id`, which is the only read-side place a set carries a real date) and apply the **same** `calcE1RM` best-per-exercise rule. This is the dated read-side derivation of the existing definition, not a parallel one; both paths call the same exported `calcE1RM`. The `progression` DecisionEvent was considered and rejected as a source: it records a coaching target bump on `targets_hit`, a different concept that would become a third definition. No server-side change (read-only walk; `calcE1RM` is a pure-util export).

**Known limitation (documented):** only PRs set in session-linked logs can be *dated*, so the dated milestone feed covers PRs from the session-linked era forward (Phase 0 onward). The live badge still flags every PR regardless of linkage; the difference is dating, not definition. State this in the module doc-comment.

### Detectors (v1)

All dated from real session/workout dates.

1. **`pr`**: walk `workouts` oldest→newest tracking the running best `calcE1RM` per exercise (the same rule as `computePRMap`, see above). When a workout beats an exercise's prior best, emit a milestone dated at that workout. `detail` includes the e1RM and `+X%` over the prior best. Skip the very first appearance of an exercise (no prior best = not a "new" PR); the opening baseline is not a milestone.

2. **`streak`**: reuse `computeStreak`'s **program-week** bucketing (the set of logged weeks taken from the log-key week segment, not ISO calendar weeks). Replay the logged weeks in order, tracking the longest consecutive run seen so far, and emit a milestone **once each time that all-time-longest run reaches a new record** (not every consecutive week, so a consistent user is not pinged weekly). `title` "N-week streak", `detail` "your longest run yet". Date the record at the latest session whose logs fall in the record-setting program week (mapped from the assembled `workouts`, which carry both the session date and, via their logs, the program week).

3. **`week_completed`**: replay the `attributeSessions` walk over completed sessions; each time a program week is fully completed (the cycle's remaining slots empty and the week index advances to absolute week `N`), emit a milestone dated at the boundary session. **Title and phase wrap the block** (programs repeat): `title` "Completed Week {weekInBlock(N, programWeeks)}" and `detail` the phase from `getPhase(N, programWeeks)`. So an absolute week 13 reads "Completed Week 1" (Accumulation), matching how the Overview tile and ProgramStatusCard name weeks, never "Completed Week 27". Successive cycles repeat the same block-relative titles; the per-milestone date disambiguates them in the feed.

4. **`session_count`**: emit at every 10th workout (10, 20, 30, …), dated at that workout. `title` "N sessions logged", `detail` "since you started".

**Backfill (intended):** none of this is persisted; all four detectors run over full history on every load. Existing users and the seeded test accounts therefore get a backfilled feed of past wins (PRs, records, completed weeks, session counts), not only events from launch forward. This is intended, the feed is a derived view, not an append-only event store.

**Future kinds (documented, not built):** `cycle_completed`, `first_back_after_gap`, `body_goal_reached`. The model + aggregator are extensible: add a detector, add a kind to the icon map. The user flagged milestones as valuable for the future, so keep the seam clean.

### Surfaces

- **Overview card**: `MilestonesCard` (`src/components/pulse/MilestonesCard.tsx`), under the metric strip (above Program). Shows the 4 most recent milestones as rows (icon tile + title + detail + relative date via `formatLogDate`). When more than 4 exist, a "Show all N milestones" button opens the modal.
- **Modal**: reuse `ModalSheet` with the count subtitle (`"N milestones"`), listing all milestones newest-first (optionally month-grouped like `MetricHistoryModal`; v1 can be a flat list). Mirrors the AllWorkouts/AllLifts pattern. No back-nav needed (terminal surface).
- Empty state: if `computeMilestones` returns nothing, render nothing (no empty card on the Overview).

### Wiring

`HistoryView` already has `workouts` (assembled), `workoutSessions`, `activeRoutine` (→ `routine_schedule` for `schedule`), and `activeRoutine.program_weeks`. Compute `milestones` in a `useMemo` and pass to `MilestonesCard`. Add the card + its modal to the Overview panel.

### Tests

`computeMilestones` per detector: a PR after a baseline (and no milestone for the baseline; PR uses the same `calcE1RM` rule as `computePRMap`), a streak that emits once on a new record and NOT on a later equal-or-shorter run, a `week_completed` past the block length asserting the wrapped title/phase (e.g. absolute week 13 → "Completed Week 1"), and a 10th-session count. Sort order newest-first. `MilestonesCard` renders rows + the "Show all" button only past the cap.

---

## Out of scope

- Schema / migration / server-action changes (none needed).
- Push notifications or "new!" badges for milestones (future).
- Comparative/social milestones (hard-out permanently).
- Per-week bodyweight in the strength series (uses current bodyweight; documented).
- Future milestone kinds listed above.

## Testing summary

Pure functions carry the logic and the tests: `recoveryReadout`, `computeStrengthScoreSeries` (+ `strengthDeltaLabel`), `computeMilestones` (+ `calcE1RM` export). Components (`RecoveryTile`, `MilestonesCard`) get light render tests. No server-action test harness (actions hit Supabase). Run the full suite after each of the three diffs.
