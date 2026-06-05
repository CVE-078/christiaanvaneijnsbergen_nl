# Adaptive missed-workout regeneration — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the periodized program calendar-aware so it detects missed workouts and gaps, and offers a non-destructive adjusted plan (resume, or an inserted ramp-back week) instead of forcing a restart.

**Architecture:** Derived-first. Persist only a calendar anchor (`workout_routines.program_anchor`), a user `timezone`, and an append-only `program_adjustments` log. All detection/position logic is pure functions in `src/lib/pulse/adherence.ts` (no DOM, `now` injected), derived from existing `workout_sessions` (date spine) and the routine schedule. UI mirrors the shipped plateau nudge.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Supabase (Postgres + RLS), SWR, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-05-18-41-27-adaptive-missed-workout-regen-design.md`

**Conventions:** bun. Verify with `bun run typecheck` and `bun run test:run`. Commit per task; git needs `GIT_CONFIG_GLOBAL=/dev/null` and `-c user.email=christiaanvaneijnsbergen@gmail.com`; subject-line-only messages, no body/trailer.

---

## File structure

- Create `docs/migrations/2026-06-05-18-45-27-adaptive-missed-workout-regen.sql` — schema + RLS + backfill.
- Modify `src/lib/pulse/types.ts` — `program_anchor` on `WorkoutRoutine`, `timezone` on `Profile`, new `ProgramAdjustment`/`AdjustmentKind`/`ProgramPosition`/`WeekAdherence`/`RegenSuggestion`.
- Modify `src/lib/pulse/constants.ts` — `GAP_DAYS`, `RAMPBACK_VOLUME_FACTOR`, `RAMPBACK_RIR_BONUS`.
- Create `src/lib/pulse/adherence.ts` + `src/lib/pulse/__tests__/adherence.test.ts` — the pure engine.
- Modify `src/lib/pulse/queries.ts` — `loadAdjustments`; include `program_anchor`/`timezone` in routine/profile loads.
- Create `src/app/api/pulse/adjustments/route.ts` — GET.
- Create `src/app/pulse/actions/adjustments.ts` — `acceptReentryDeload`, `dismissReentry`; add `updateTimezone` (profile action) and set `program_anchor` on routine create.
- Modify `src/app/pulse/actions.ts` — re-export new actions.
- Create `src/hooks/pulse/useProgramAdjustments.ts`.
- Modify `src/context/PulseContext.ts` + `src/components/pulse/PulseProvider.tsx` — expose `currentWeek`, `programPosition`, `regenSuggestion`, `adjustments`, mutations; derive position; timezone capture; `activeWeek` follows `currentWeek`.
- Create `src/components/pulse/RegenNudge.tsx` + `src/components/pulse/__tests__/RegenNudge.test.tsx`.
- Modify `src/components/pulse/views/LogView.tsx` — render `RegenNudge`, ramp-back phase card, jump-to-current.
- Modify `docs/roadmap.md` — mark shipped.

---

## Task 1: Migration

**Files:** Create `docs/migrations/2026-06-05-18-45-27-adaptive-missed-workout-regen.sql`

- [ ] **Step 1:** Write the SQL.

```sql
-- Adaptive missed-workout regeneration: calendar anchor, user timezone,
-- append-only ramp-back adjustments. Apply manually against Supabase.

alter table public.workout_routines add column if not exists program_anchor timestamptz;
alter table public.profiles add column if not exists timezone text not null default 'UTC';

-- Backfill each routine's anchor: first completed session, else created_at.
update public.workout_routines r
set program_anchor = coalesce(
  (select min(s.completed_at) from public.workout_sessions s
     where s.routine_id = r.id and s.completed_at is not null),
  r.created_at)
where r.program_anchor is null;

create table if not exists public.program_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  kind text not null check (kind in ('reentry_deload','reentry_dismissed')),
  effective_week integer not null,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);
create index if not exists program_adjustments_user_routine_idx
  on public.program_adjustments (user_id, routine_id);

alter table public.program_adjustments enable row level security;
create policy "own adjustments select" on public.program_adjustments
  for select using (auth.uid() = user_id);
create policy "own adjustments insert" on public.program_adjustments
  for insert with check (auth.uid() = user_id);
create policy "own adjustments delete" on public.program_adjustments
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2:** Verify against the existing RLS policy shape in a prior migration (`docs/migrations/2026-06-04-schedule-variant.sql` / `exercise-preferences.sql`) and match naming.
- [ ] **Step 3:** Commit.

> Note: no automated runner; the user applies it to Supabase manually.

## Task 2: Types

**Files:** Modify `src/lib/pulse/types.ts`

- [ ] **Step 1:** Add `program_anchor?: string | null` to `WorkoutRoutine`; `timezone: string` to `Profile`.
- [ ] **Step 2:** Add domain types:

```ts
export type AdjustmentKind = 'reentry_deload' | 'reentry_dismissed';
export interface ProgramAdjustment {
    id: string;
    routine_id: string;
    kind: AdjustmentKind;
    effective_week: number;
    created_at: string;
    payload: { volumeFactor?: number; rirBonus?: number; daysAway?: number };
}
export type AdherenceStatus = 'on_track' | 'behind' | 'lapsed';
export interface ProgramPosition {
    weekInteger: number;        // current in-progress program week (monotonic, >=1)
    progressionIndex: number;   // weekInteger minus inserted ramp-back weeks
    isRampBack: boolean;        // current week is an inserted ramp-back week
    completedCount: number;
    calendarWeek: number;
    behindBy: number;
    daysSinceLastSession: number | null;
    status: AdherenceStatus;
    nextEntry: ScheduleEntry | null;
}
export interface WeekAdherence {
    missed: ScheduleEntry[];
    upcoming: ScheduleEntry[];
    done: ScheduleEntry[];
}
export type RegenSuggestion =
    | { kind: 'reentry_deload'; weekInteger: number; daysAway: number }
    | { kind: 'catch_up'; missed: ScheduleEntry[] }
    | null;
```

- [ ] **Step 3:** `bun run typecheck` (expect existing code still compiles; `Profile.timezone` may surface call sites that build a Profile literal — fix those with `timezone: 'UTC'` defaults, e.g. test fixtures / mappers). Commit.

## Task 3: Constants

**Files:** Modify `src/lib/pulse/constants.ts`

- [ ] **Step 1:** Add:

```ts
// Adaptive regeneration. Under ~a week off there is no real detraining.
export const GAP_DAYS = 10;
export const RAMPBACK_VOLUME_FACTOR = 0.6;
export const RAMPBACK_RIR_BONUS = 1;
```

- [ ] **Step 2:** Commit.

## Task 4: The pure engine (TDD)

**Files:** Create `src/lib/pulse/adherence.ts`, `src/lib/pulse/__tests__/adherence.test.ts`

Build function-by-function, test-first. Each sub-step: write failing test → run (`bun run test:run src/lib/pulse/__tests__/adherence.test.ts`) → implement → run → commit.

- [ ] **4a `dayIndex(iso, tz)` and `weekdayOf(idx)`.**
  - Tests: a fixed UTC ISO in `Europe/Amsterdam` vs `UTC` gives expected integer day numbers; two ISO times on the same local calendar day return the same index; `weekdayOf` of the index for `1970-01-01` = 4 (Thu); a known Monday returns 1.
  - Impl: format the ISO in `tz` with `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })`, parse `Y/M/D`, return `Math.floor(Date.UTC(Y, M-1, D)/86400000)`. `weekdayOf(idx) = ((idx % 7) + 4) % 7` normalized to 0..6.

- [ ] **4b `attributeSessions(schedule, sessions)` → `{ weekInteger, completedCount, currentCycleDone, currentCycleRemaining, nextEntry }`.**
  - Tests: empty schedule → weekInteger 1, benign; 4-entry schedule + 3 completed sessions in schedule order → weekInteger 1, 3 done, 1 remaining (the 4th), nextEntry = 4th; 4 completed → weekInteger 2, cycle reset; out-of-order sessions still match by (type,variant); off-plan session consumes a slot; variant-null session matches variant-null entry.
  - Impl: sort by `completed_at` asc; walk slots per the matching rules (exact (type,variant) → type-only → any remaining); reset per completed cycle.

- [ ] **4c `progressionInfo(weekInteger, adjustments)` → `{ progressionIndex, isRampBack }`.**
  - Tests: no adjustments → index == weekInteger, not ramp-back; one `reentry_deload` at week 5, query week 5 → isRampBack true; query week 6 → index 5; two deloads (5 and 8), query week 9 → index 7.
  - Impl: `isRampBack = some(reentry_deload, effective_week === w)`; `progressionIndex = w - count(reentry_deload, effective_week < w)`.

- [ ] **4d `rampBackPrescription(weekInteger, programWeeks, adjustments)` helper for UI/logic.**
  - Tests: ramp-back week returns `{ volume: round(volumeForWeek(progressionIndex)*0.6), rir: getRIR(progressionIndex)+1 }`.
  - Impl: reuse `getRIR`/`volumeForWeek` from `utils.ts` on `progressionIndex`, apply factor/bonus.

- [ ] **4e `computeProgramPosition({ routine, schedule, sessions, adjustments, tz, now })` → `ProgramPosition`.**
  - Tests: anchor 0 days ago, on schedule → `on_track`, behindBy 0; anchor 21 days ago with only 1 session → `behind` (or `lapsed` if last session > GAP_DAYS ago); last session 11 days ago → `lapsed`, 9 days ago → not lapsed; daysSinceLastSession null when no sessions; calendarWeek math for 8 days elapsed = 2.
  - Impl: combine 4a/4b/4c; compute `start`/`today`/`daysElapsed`/`calendarWeek`; `expectedSessions` via closed-form weekday-occurrence count in `[start, today]`; `behindBy`; `status` per spec (`lapsed` first, then `behind`, then `on_track`).

- [ ] **4f `computeWeekAdherence({ schedule, sessions, anchor, tz, now })` → `WeekAdherence`.**
  - Tests: in the current window, an entry whose scheduled date is in the past with no matching session → `missed`; future-dated entry → `upcoming`; matched session → `done`; sessions outside the window ignored.
  - Impl: window `[winStart, winStart+6]`, `scheduledDate(entry)` mapping, greedy match by (type,variant).

- [ ] **4g `computeRegenSuggestion(position, weekAdherence, adjustments)` → `RegenSuggestion`.**
  - Tests: lapsed + no adjustment for weekInteger → `reentry_deload`; lapsed but a `reentry_dismissed` exists for weekInteger → null (suppressed); not lapsed but missed entries → `catch_up`; on track, nothing missed → null.
  - Impl: per spec ordering.

- [ ] **Commit** after each sub-step (or grouped logically).

## Task 5: Queries

**Files:** Modify `src/lib/pulse/queries.ts`

- [ ] **Step 1:** Add `program_anchor` to the routines select and `timezone` to the profile select (mapping to the new type fields; default `timezone` to `'UTC'` if null).
- [ ] **Step 2:** Add `loadAdjustments(supabase, userId): Promise<ProgramAdjustment[]>` selecting from `program_adjustments` ordered by `created_at`.
- [ ] **Step 3:** `bun run typecheck`. Commit.

## Task 6: API route

**Files:** Create `src/app/api/pulse/adjustments/route.ts`

- [ ] **Step 1:** GET via `getUserOrUnauthorized` + `loadAdjustments`, returning `[]` on error (mirror `swaps/route.ts`).
- [ ] **Step 2:** Commit.

## Task 7: Server actions

**Files:** Create `src/app/pulse/actions/adjustments.ts`; modify `actions/profile.ts` (or add `updateTimezone`), `actions/routines.ts` (set anchor on create), `actions.ts` (re-export).

- [ ] **Step 1:** `acceptReentryDeload(routineId, weekInteger)` and `dismissReentry(routineId, weekInteger)`: `'use server'`, `getUserOrThrow`, validate `weekInteger` integer ≥1 and `routineId` UUID, assert routine ownership (mirror `_shared` helper; add `assertOwnsRoutine` if absent), insert a `program_adjustments` row (`reentry_deload` payload `{ volumeFactor: RAMPBACK_VOLUME_FACTOR, rirBonus: RAMPBACK_RIR_BONUS }`, or `reentry_dismissed`). Guard against duplicates (delete any existing row for the same `(routine_id, effective_week)` first, or upsert).
- [ ] **Step 2:** `updateTimezone(tz: string)`: validate against `Intl.supportedValuesOf('timeZone')` (or a lightweight regex), update `profiles.timezone`.
- [ ] **Step 3:** In routine creation (`generateAndSaveRoutine`/`createRoutine`), set `program_anchor = now()` (DB default or explicit) so new routines anchor immediately.
- [ ] **Step 4:** Re-export from `actions.ts`. `bun run typecheck`. Commit.

## Task 8: Hook

**Files:** Create `src/hooks/pulse/useProgramAdjustments.ts`

- [ ] **Step 1:** SWR on `/api/pulse/adjustments` with `fetcher`/`SWR_READ_OPTS`, stable `EMPTY: ProgramAdjustment[] = []`. Expose `adjustments`, `loading`, `error`, and optimistic `acceptReentryDeload`/`dismissReentry` that mutate locally then call the actions then revalidate (mirror `useSwaps`).
- [ ] **Step 2:** Commit.

## Task 9: Context + provider wiring

**Files:** Modify `src/context/PulseContext.ts`, `src/components/pulse/PulseProvider.tsx`

- [ ] **Step 1:** Extend `PulseContextValue`: `adjustments: ProgramAdjustment[]`, `currentWeek: number`, `programPosition: ProgramPosition | null`, `regenSuggestion: RegenSuggestion`, `acceptReentryDeload`, `dismissReentry`, `updateTimezone`; add `adjustments` to `loading`/`errors`.
- [ ] **Step 2:** In `PulseProvider`: call `useProgramAdjustments`. Memo-derive `programPosition` from active routine (anchor), its schedule, completed sessions, adjustments, profile timezone, and `now` (`new Date().toISOString()` captured once per render). Derive `currentWeek = programPosition?.weekInteger ?? activeWeek`, `regenSuggestion`.
- [ ] **Step 3:** Timezone capture effect: on mount compare `Intl.DateTimeFormat().resolvedOptions().timeZone` to `profile.timezone`; if different and non-empty, call `updateTimezone`.
- [ ] **Step 4:** `activeWeek` follows `currentWeek`: initialize `activeWeek` to `currentWeek` when available; when `currentWeek` advances and the user is viewing the previous `currentWeek` (not manually browsing), advance `activeWeek`. Keep a ref/flag for manual navigation so browsing isn't yanked.
- [ ] **Step 5:** `bun run typecheck`. Commit.

> Need completed `workout_sessions` client-side. If not already in context, add a minimal `useSessions` SWR over an existing/`new` `/api/pulse/sessions` GET (the sessions route already supports GET per the route map). Reuse if present.

## Task 10: UI (TDD for the component)

**Files:** Create `src/components/pulse/RegenNudge.tsx`, `src/components/pulse/__tests__/RegenNudge.test.tsx`; modify `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1:** Write `RegenNudge.test.tsx` (mirror the plateau-nudge test + `usePulse` stub): renders nothing when `regenSuggestion` is null; renders the "missed" copy + a "Train it" button for `catch_up`; renders ramp-back copy + Accept / Resume buttons for `reentry_deload`; Accept calls `acceptReentryDeload`, Resume calls `dismissReentry`.
- [ ] **Step 2:** Run, expect fail. Implement `RegenNudge.tsx` styled with `pulse-*` tokens like the plateau card; wire to `usePulse()`.
- [ ] **Step 3:** Render `<RegenNudge />` at the top of `LogView`. Add a status chip near the week indicator (`programPosition.status`) and a ramp-back phase-card variant when `programPosition.isRampBack`. Add a "Jump to current" control when `activeWeek !== currentWeek`.
- [ ] **Step 4:** `bun run test:run` + `bun run typecheck` + `bun run lint`. Commit.

## Task 11: Roadmap sync

**Files:** Modify `docs/roadmap.md`

- [ ] **Step 1:** Move "Adaptive missed-workout regeneration" out of Near-term into Shipped (2026-06-05), with a one-line description. Near-term cluster is then complete.
- [ ] **Step 2:** Commit.

---

## Self-review (against spec)

- Spec §1 data model → Task 1 (+ types Task 2). ✓
- §2 engine (dayIndex/weekdayOf, attribution, progressionIndex, calendar position, week adherence, suggestion) → Task 4a–4g. ✓
- §3 constants → Task 3. ✓
- §4 regeneration (no-mutation catch_up; accept→reentry_deload; dismiss→reentry_dismissed) → Tasks 4g, 7, 10. ✓
- §5 UI (nudge states, status chip, ramp-back card, derived stepper + jump-to-current, timezone capture) → Tasks 9, 10. ✓
- §6 data flow (queries, route, hook, actions, context) → Tasks 5–9. ✓
- §7 testing → Tasks 4, 10. ✓
- Type consistency: `ProgramPosition`/`RegenSuggestion`/`WeekAdherence` defined once in Task 2 and consumed unchanged in 4/9/10. `acceptReentryDeload`/`dismissReentry` named identically across action, hook, context. ✓
- Open dependency flagged: client-side completed sessions (Task 9 note) — resolve by reusing/adding a sessions GET hook.
