# Adaptive missed-workout regeneration — design

Date: 2026-06-05
Status: approved (brainstorm), ready for implementation plan
Branch: `feature/adaptive-missed-workout-regen`

## Problem

A user on a periodized program misses scheduled workouts or drops off for a
while. Today the program "week" is manual localStorage state (`pulse_week`) with
no calendar awareness, so a returning user is stuck: keep a stale week, or
effectively restart. We want the app to notice you're off-track and offer a
sensible adjusted plan instead of a restart.

## Decisions (from brainstorm)

1. **Full calendar tracking.** Anchor the program to a real start date and reason
   about real dates. Chosen for long-term soundness; the app is intended to go
   public and needs production-grade adherence handling.
2. **Hybrid timeline.** Small misses slide forward (completion-paced, nothing
   lost). A long gap inserts a reduced "ramp-back" week instead of cramming.
3. **Suggest-and-confirm.** Detection surfaces a non-destructive nudge (same
   pattern as the shipped plateau nudge). Accepting writes a small record;
   dismissing leaves the plan untouched.
4. **Periodization follows completion, not the calendar.** Phase/RIR/volume track
   the work you actually finished, so progressive overload stays honest. A
   ramp-back week is inserted (ease in, then resume the week you were on), it does
   not consume a real progression week.
5. **Derived-first architecture.** The authoritative source stays the logs and
   `workout_sessions` rows. We persist only a calendar anchor, a timezone, and an
   append-only log of accepted/dismissed ramp-back decisions. Everything else is
   computed by pure, server-portable functions (so a future cron can reuse them
   for push/email adherence nudges).

## Two separate concerns

- **Program progression** — which week's prescription you get. Completion-paced.
- **Calendar adherence** — are you keeping up. Date-based.

They coexist: the calendar tells you you're slipping; progression tells you which
workout to do whenever you next train.

## Section 1: Data model

New persistent footprint (the entire one):

1. `workout_routines.program_anchor timestamptz null` — the moment program
   "week 1, day 1" begins. Backfilled per existing routine to its first completed
   `workout_sessions.completed_at` (else `created_at`).
2. `profiles.timezone text not null default 'UTC'` — IANA zone (e.g.
   `Europe/Amsterdam`). Set silently from the browser on next visit. Used to
   resolve "today" and weekday.
3. `program_adjustments` table — append-only, one row per ramp-back decision:
   - `id uuid pk default gen_random_uuid()`
   - `user_id uuid not null` (references auth.users)
   - `routine_id uuid not null` (references workout_routines)
   - `kind text not null check (kind in ('reentry_deload','reentry_dismissed'))`
   - `effective_week integer not null` — the monotonic `weekInteger` it applies to
   - `created_at timestamptz not null default now()`
   - `payload jsonb not null default '{}'` — e.g. `{ "volumeFactor": 0.6, "rirBonus": 1, "daysAway": 12 }`
   - RLS: user-scoped select/insert/delete, mirroring existing Pulse table
     policies. Index on `(user_id, routine_id)`.

`catch_up` is **not** persisted — completion-pacing resumes you automatically, so
a "you're behind" nudge needs no stored state. Only ramp-back decisions persist
(accepted as `reentry_deload`, declined as `reentry_dismissed` so we stop
nagging).

## Section 2: The engine (`src/lib/pulse/adherence.ts`, pure + server-portable)

No DOM, no `Date.now()` inside — callers pass `now` (ISO string) so the functions
are deterministic and testable. Timezone math via `Intl.DateTimeFormat` on
explicit ISO inputs.

**Date helpers**
- `dayIndex(iso, tz): number` — integer day number of the local calendar date in
  `tz` (days since epoch). Comparing day indices sidesteps DST/elapsed-ms bugs.
- `weekdayOf(dayIndex): number` — `(dayIndex + 4) % 7` (epoch day 0 = Thursday),
  0=Sun..6=Sat, matching `ScheduleEntry.day_of_week`.

**Session → program-week attribution (ordinal)**
- Inputs: active routine, its `schedule: ScheduleEntry[]`, completed
  `workout_sessions` (this routine, `completed_at != null`), accepted adjustments,
  `tz`, `now`.
- `sessionsPerCycle = schedule.length`. If `schedule` is empty the feature is
  inert (return a benign on-track position).
- Sort completed sessions by `completed_at` asc. Walk them into microcycles: each
  session consumes one remaining schedule slot for the in-progress week, matched
  `(workout_type, variant)` first, then `workout_type` only, else any remaining
  slot (off-plan sessions still count as a training day). When all slots for a
  week are consumed, advance the week.
- Yields: `weekInteger` (current in-progress week, monotonic, ≥1),
  `completedCount`, `currentCycleDone` (matched entries), `currentCycleRemaining`
  (unmatched), `nextSession` (first remaining entry in schedule order).

**Progression index (ramp-back offset)**
- `isRampBackWeek(w) = adjustments.some(a => a.kind==='reentry_deload' && a.effective_week===w)`.
- `progressionIndex(w) = w - count(reentry_deload with effective_week < w)`.
- Normal week prescription = `getPhase/getRIR/volumeForWeek(progressionIndex(w), program_weeks)`.
- Ramp-back week prescription = override: `volume = round(normalVolume * RAMPBACK_VOLUME_FACTOR)`,
  `rir = normalRir + RAMPBACK_RIR_BONUS`, phase label "Ramp-back".
- Inserting a deload at week W therefore shifts every later normal week's
  progression back by one, so a layoff costs no real progression.

**Calendar position**
- `start = dayIndex(anchor, tz)`, `today = dayIndex(now, tz)`, `daysElapsed = max(0, today-start)`.
- `calendarWeek = floor(daysElapsed/7)+1`.
- `lastSessionAt`, `daysSinceLastSession` (in `tz`).
- `expectedSessions` = sum over schedule entries of weekday occurrences of their
  `day_of_week` in `[start, today]` (closed-form count, no iteration).
- `behindBy = max(0, expectedSessions - completedCount)`.
- `status`: `lapsed` if `daysSinceLastSession >= GAP_DAYS`; else `behind` if
  `behindBy > 0`; else `on_track`.

**Within-week adherence** — `computeWeekAdherence(...)`
- Current calendar-week window `[winStart, winStart+6]`, `winStart = start + (calendarWeek-1)*7`.
  The 7-day window holds exactly one of each weekday, so each schedule entry maps
  to one date in it: `scheduledDate(entry) = winStart + ((entry.day_of_week - weekdayOf(winStart) + 7) % 7)`.
- Sessions "this week" = completed sessions with `dayIndex(completed_at) ∈ window`,
  matched greedily to entries by `(type, variant)`.
- Per entry: `isPast = scheduledDate <= today`, `isDone` = matched.
  `missed = entries past & not done`; `upcoming = entries not past & not done`.

**Suggestion** — `computeRegenSuggestion(position, weekAdherence, adjustments)`
- If `status === 'lapsed'` AND no `reentry_deload`/`reentry_dismissed` exists for
  the current `weekInteger` → `{ kind: 'reentry_deload', weekInteger, daysAway }`.
- Else if `missed.length > 0` → `{ kind: 'catch_up', missed }` (informational, not
  persisted).
- Else `null`.

## Section 3: Constants (`src/lib/pulse/constants.ts`)

- `GAP_DAYS = 10` — under ~a week off there's no real detraining, so no nudge.
- `RAMPBACK_VOLUME_FACTOR = 0.6`.
- `RAMPBACK_RIR_BONUS = 1`.

## Section 4: What gets regenerated

- **Behind / missed → no mutation.** Card points at the open session and the
  button jumps to its tab. Completion-pacing already carries it forward.
- **Lapsed → ramp-back week.** Accept writes one `reentry_deload` row for the
  current `weekInteger`. The engine then prescribes that week at ~60% volume /
  +1 RIR and resumes normal progression right after (insert, not replace).
  "Resume normally" writes a `reentry_dismissed` row so we stop suggesting it for
  that week.

## Section 5: UI

- **Nudge card** at the top of `LogView`, styled like the plateau nudge, states:
  - *behind/missed* — "You missed Lower B this week" + "Train it" (jumps to tab).
    Session-local dismiss (no persistence).
  - *lapsed* — "Welcome back. It's been 12 days. Want a lighter ramp-back week
    before resuming week N?" → Accept / Resume normally.
  - *ramp-back active* — phase-card variant: "Ramp-back week · easing in after N
    days off. Reduced volume, higher RIR."
- **Status chip** near the week indicator: "Week N · on track" / "1 session
  behind" / "back after 12 days."
- **Week stepper becomes derived.** `currentWeek` (program position) is computed.
  `activeWeek` defaults to and follows `currentWeek` unless the user has manually
  navigated this session; a "Jump to current" control appears when they differ.
  The stepper still browses past weeks; logging targets `activeWeek` as today.
- **Timezone capture.** On load read
  `Intl.DateTimeFormat().resolvedOptions().timeZone` and persist via
  `updateTimezone` if it changed (silent, no UI).

## Section 6: Data flow (standard add-a-domain pattern)

- `queries.ts`: `loadAdjustments(supabase, userId)`; include `program_anchor` in
  the routines load and `timezone` in the profile load.
- `GET /api/pulse/adjustments/route.ts` (reuses the loader).
- Hook `useProgramAdjustments` (SWR + optimistic, same shape as `useSwaps`/`useNotes`).
- Actions `src/app/pulse/actions/adjustments.ts`:
  `acceptReentryDeload(routineId, weekInteger)`, `dismissReentry(routineId, weekInteger)`.
- Profile: `updateTimezone(tz)` action + context method; `program_anchor` set at
  routine creation going forward.
- Migration `docs/migrations/2026-06-05-...-adaptive-missed-workout-regen.sql`:
  add column + field + table + RLS + indexes, and **backfill** each routine's
  anchor (first completed session date, else `created_at`).
- `PulseContext`: expose `currentWeek`, `programPosition`, `regenSuggestion`,
  `adjustments`, `acceptReentryDeload`, `dismissReentry`, `updateTimezone`.
  `programPosition`/`regenSuggestion` derived in `PulseProvider` via the pure
  functions; add `adjustments` to the `loading`/`errors` maps.

## Section 7: Testing

- `adherence.test.ts`: ordinal session→week attribution (in-order, out-of-order,
  off-plan, duplicate sessions); `progressionIndex` with 0/1/2 inserted deloads;
  `GAP_DAYS` boundary (9 vs 10 vs 11 days); `computeWeekAdherence` past/upcoming/
  done matching; block wrap (week 13 = block-2 week 1); timezone edges (day
  boundary across midnight, a DST transition); empty schedule inert.
- Component tests for the three nudge-card states, mirroring the plateau-nudge
  tests (incl. the `usePulse` stub).

## Migration nuances / known limits

- **Anchor vs manually-tracked week.** Existing users tracked weeks manually;
  derived `currentWeek` (from session count) may differ slightly. Manual
  navigation + "Jump to current" keep nothing locked. Acceptable for the two
  current users; correct going forward.
- **Sessions are the date spine.** The engine assumes a completed workout has a
  `workout_sessions` row with `completed_at`. Verify session rows are reliably
  created on workout start during implementation; if legacy logged workouts lack
  sessions, they simply don't count toward calendar dates (logs still drive set
  data and progression display).
- **Timezone default `UTC`** until first browser visit sets it; off-by-hours at
  worst for day-boundary detection, self-heals on first load.

## Out of scope (future)

- Multi-tier ramp-back (e.g. drop a progression week after very long layoffs).
- Server cron + push/email adherence nudges (the pure engine is built to enable
  this later).
- Balance-aware re-sequencing (prioritize neglected muscles); v1 uses schedule
  order, which already balances.
- Materialized per-week schedules.
