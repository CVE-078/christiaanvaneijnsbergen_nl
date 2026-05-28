# 2026-05-25 — Pulse App: Implementation Plan (Phases 3.5 → 7)

This plan covers all remaining phases for the Pulse workout tracker.
Each phase is broken into tasks with acceptance criteria, architectural notes, and explicit dependencies.
All work follows the established conventions: Tailwind v4 `pulse-*` tokens, kg stored in DB with display-unit conversion at render, conventional commits, feature branches.

After every phase: run `npm run typecheck && npm run lint && npm run format`, then second-opinion code review (spec reviewer → quality reviewer per task, final reviewer after all tasks).

---

## Prerequisites: Quick Wins

Branch: `fix/audit-fixes` — **merged into `feature/profiles-bodyweight`**

- [x] QW-1 — Parallelize 3 Supabase calls with `Promise.all` (`app/pulse/page.tsx`)
- [x] QW-2 — Add `display_name` length guard (max 50 chars) in `updateProfile`
- [x] QW-3 — Add explicit `weightKg` validation in `logBodyWeight`
- [x] QW-4 — Batch the delete loop using `.in()` instead of N individual deletes
- [x] QW-5 — Change `Record<string, Workout>` → `Record<WorkoutType, Workout>` in `data.ts`
- [x] QW-6 — Fix implicit `any` on `row` parameter in `actions.ts`
- [x] QW-7 — Fix implicit `any` on `r` parameter in `page.tsx`
- [x] QW-8 — Add `loading.tsx` with a shimmer skeleton
- [x] QW-9 — Add `noindex` metadata export to `page.tsx`
- [x] QW-10 — Remove `@vercel/kv` from `package.json`
- [x] QW-11 — Fix vitest config (ESM, jsdom, `stripNextDirectives` plugin)
- [x] QW-12 — Validate `id` UUID format in `deleteBodyWeight`
- [x] QW-13 — Add `typecheck`, `format`, `format:check` scripts to `package.json`
- [x] QW-14 — Apply Prettier formatting across all `src/` files
- [x] QW-15 — Add DB migration docs (`docs/migrations/2026-05-25-audit-schema-fixes.sql`)
- [x] QW-16 — Persist RestTimer duration to `localStorage` (`wt_timer_idx`)
- [x] QW-17 — Show "Saved ✓" confirmation after display name update
- [x] QW-18 — Add empty state hint in LogView ("Tap an exercise to start logging.")
- [x] QW-19 — Add completed ✓ indicator on ExerciseCard when all sets saved
- [x] QW-20 — Fix UTC date for body weight log timestamp
- [x] QW-21 — Expand ExerciseCard and ProfileView test coverage (71 tests total)
- [x] QW-22 — Add CSP header for `/pulse/:path*` routes

---

## Recently Completed (post-plan work)

### Tailwind v4 Migration — `feature/tailwind-v4` ✅
- [x] Replace `tailwind.config.ts` + `theme.ts` with `@theme` tokens in `globals.css`
- [x] Migrate all components from hardcoded hex / `theme()` calls to `pulse-*` Tailwind classes
- [x] Delete `theme.ts`; typecheck + lint pass

### Architecture Refactor — `feature/desktop-layout` ✅
- [x] Extract `PulseProvider` context; slim `TrackerClient` to ~30 lines
- [x] Add `AppShell` component gating mobile vs desktop via `useMediaQuery`
- [x] Migrate all view components off prop drilling onto `usePulse()` context

### Clean-Athlete Redesign — `feature/pulse-redesign` ✅
- [x] Swap JetBrains Mono for Outfit; update all design tokens (emerald accent, dark slate bg, translucent borders)
- [x] WorkoutTabs: filled pill group replacing underline tabs
- [x] BottomNav: SVG icons + label, drop uppercase tracking
- [x] ExerciseCard: `rounded-2xl`, small index chip, square progress pips
- [x] SetLogger: inputs use `pulse-surface`/`pulse-border` tokens; saved row tinted with accent
- [x] Desktop layout: sidebar + two-pane removed; sticky top nav + single-column `LogView`
- [x] Delete `LogViewDesktop`, `ExerciseListItem`, `ExerciseDetailPane` (and their tests)
- [x] LogView: pill-style week strip, `max-w-[820px]` on `lg+`
- [x] All hardcoded hex values replaced with design tokens across all views

---

## Phase 3.5 — Merge & Stabilise ✅

Branch: `feature/profiles-bodyweight` → merged into `main`

- [x] Verify `ProfileView` renders correctly on Vercel preview deploy
- [x] Confirm unit toggle persists across page reloads (Supabase round-trip)
- [x] Verify bodyweight chart renders with ≥ 2 entries
- [x] Confirm `SetLogger` correctly re-derives kg display values when unit changes
- [x] Merge `feature/profiles-bodyweight` into `main` via PR

---

## Phase 4 — Exercise Library + Routine Builder ✅

Branch: `feature/exercise-library` → merged into `main`
Goal: Move exercises out of hardcoded `data.ts` into Supabase. Let users create routines, pick exercises, and set their own starting weights.

### 4.1 Schema migration

- [x] Add `exercises` table: `id, name, category, default_sets, default_reps, user_id (nullable — null = global seed)`
- [x] Add `workout_routines` table: `id, user_id, name, created_at`
- [x] Add `routine_exercises` table: `id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg`
- [x] Add `rir` column to `set_logs`
- [x] Write migration SQL in `docs/migrations/`
- [x] Seed global exercise library (all PPL + expanded category taxonomy)
- [x] Add RLS policies: users can read global exercises + their own; write only their own

### 4.2 Exercise library UI

- [x] Browse page: list global exercises + user-created, filterable by category (10 categories)
- [x] "Add exercise" form: name, category, default sets, default reps
- [x] Edit / delete for user-created exercises only
- [x] Accessible via dedicated Explore nav tab (sub-tabs: Exercises / Routines / Templates)

### 4.3 Routine builder

- [x] Create routine: name input → creates `workout_routines` row
- [x] Add exercise to routine: pick from library → set `workout_type`, `sets`, `reps`, `starting_weight_kg`, `order`
- [x] Reorder exercises (up/down arrows)
- [x] Remove exercise from routine
- [x] View / edit existing routines (inline edit for sets/reps/weight per exercise)
- [x] Mark one routine as "active" (stored in `profiles.active_routine_id`)

### 4.4 Wire LogView to DB routine

- [x] Load active routine from Supabase (server-side in layout, passed via PulseContext)
- [x] `logKey` scheme uses `routine_exercise_id` UUID (format: `{week}-{uuid}-{setIdx}`)
- [x] Suggestion logic: `computeSuggestion` pre-fills weight from previous week ± 2.5 kg based on RIR delta; `starting_weight_kg` seeds week 1
- [x] Graceful empty state when no routine is active ("No routine active — go to Library")

### 4.5 Onboarding hook

- [x] Detect first login (no active routine + `onboarding_completed = false`) → show OnboardingModal
- [x] 6-step flow: equipment → experience → goal → days/week → specific days → session time → recommendation
- [x] Template cloned with `trainingDays` schedule and `sessionTime` volume scaling; `completeOnboarding` marks done

**Decisions made:**
- Log key: adopted new UUID format; old positional keys are not migrated (no production data existed)
- Multiple active routines: deferred — one active at a time via `profiles.active_routine_id`
- Exercise library: dedicated Explore tab with Exercises / Routines / Templates sub-tabs

---

## Phase 5 — Progress & Analytics

Branch: `feature/analytics`
Goal: Surface training progress visually — e1RM trends, volume per workout type, streak.

> **Current state:** `HistoryView` (`src/components/pulse/views/HistoryView.tsx`) exists at `/pulse/progress` and renders per-week session cards with set data and PR badges. `computeStreak` and `computePRMap` are implemented and used. Exercise names currently show as "Exercise" placeholder — `routineExerciseId` lookup against the exercises list is not yet wired up.

### 5.1 Utility functions

- [ ] Fix exercise name lookup in `HistoryView` (map `routineExerciseId` → `activeRoutine.exercises` → `exercise.name`)
- [ ] Implement `computeVolumeByTypeAndWeek(logs)` in `utils.ts` with tests
- [ ] Implement `computeE1RMHistory(logs, routineExerciseId)` in `utils.ts` with tests
- [ ] Add `ProgressSummary` type to `types.ts`

```ts
export interface ProgressSummary {
    volumeByWeek: Record<string, Record<WorkoutType, number>>;
    e1rmHistory: Record<string, Array<{ week: number; e1rm: number }>>;
    bestLifts: Record<string, { week: number; kg: number; reps: number; e1rm: number }>;
}
```

### 5.2 Volume bar chart

- [ ] Build `<VolumeChart />` — set count per week grouped by workout type, using `pulse-*` tokens
- [ ] X-axis: weeks 1–12; Y-axis: set count
- [ ] Empty state: muted placeholder bars when no data

### 5.3 e1RM progression chart

- [ ] Build SVG line chart with dots per logged week, ACCENT color
- [ ] Exercise picker — default to most-logged exercise
- [ ] PR marker on the highest point
- [ ] Empty state: "Log at least one set to see progression"

### 5.4 Best lifts summary

- [ ] List best set per exercise (name, best weight × reps, week, e1RM)
- [ ] Sort by e1RM descending; PR badge on overall highest per exercise

### 5.5 Streak calendar

- [ ] Visual calendar: 12 dots (one per week), filled = week has logged data
- [ ] Show current streak count (already computed in `computeStreak`)

**Questions to answer before starting Phase 5:**
- [ ] e1RM chart: all exercises as small multiples, or single chart with exercise picker?
- [ ] Volume chart: grouped by workout type or single total bar per week?

---

## Phase 6 — Polish & UX

Branch: `feature/ux-polish`
Goal: Quality-of-life improvements that make the app feel finished.

### 6.1 Toast notification system

- [ ] Create `src/lib/pulse/toast.ts` — React context + `useReducer`, no external library
- [ ] Three variants: `error` (red), `success` (green), `info` (dim)
- [ ] Auto-dismiss after 4s; hover pauses dismiss; max 3 stacked
- [ ] `role="status"` for success/info, `role="alert"` for errors
- [ ] Replace `saveError` state in `TrackerClient` with `useToast().show(...)`
- [ ] Use `show('Profile updated', 'success')` on unit/name changes

### 6.2 Keyboard shortcuts

- [ ] Implement `useKeyboard` hook in `TrackerClient` using `document.addEventListener('keydown')`
- [ ] Guard: no-op when focus is inside an input/textarea
- [ ] `1` / `2` / `3` → switch Push / Pull / Legs tab (Log view)
- [ ] `←` / `→` → previous / next week (Log view)
- [ ] `P` / `H` / `L` → open Program / History / Log view (global)
- [ ] `Escape` → close open ExerciseCard / dismiss timer
- [ ] Show shortcut badges in nav at ≥ 768px width only

### 6.3 Swipe gestures for week navigation

- [ ] Create `src/hooks/pulse/useSwipe.ts` hook using raw touch events
- [ ] Threshold: 50px horizontal delta + velocity guard
- [ ] Wire into `LogView` for previous/next week
- [ ] Brief CSS `transform` slide animation on transition

### 6.4 Import JSON

- [ ] Hidden `<input type="file" accept=".json">` triggered by "Import" button in nav
- [ ] Parse JSON → `validateLogs` → confirm dialog ("Import N sets? This will overwrite current data.")
- [ ] Call `saveLogs` on confirm; show toast on success/error
- [ ] Answer before implementing: merge with existing data, or replace?

### 6.5 Display name save feedback *(done in QW-17)*

- [x] Show "Saved ✓" confirmation after display name update

### 6.6 Empty state in Log view *(done in QW-18)*

- [x] Show "Tap an exercise to start logging." when no sets are logged for current week

### 6.7 Rest timer quality-of-life

- [ ] Auto-start timer when a set is saved (opt-in toggle in Profile)
- [ ] Per-exercise configurable rest duration (compounds vs accessories), stored in `routine_exercises`

### 6.8 Haptic feedback

- [ ] Vibrate 20ms on set save in `SetLogger` (`navigator.vibrate(20)`)
- [ ] Vibrate pattern on timer completion in `RestTimer` (`navigator.vibrate([100, 50, 100])`)

**Questions to answer before starting Phase 6:**
- [ ] Keyboard shortcuts: any additions or changes to the list above?
- [ ] Import JSON: merge or replace?

---

## Phase 7 — Social & Gamification *(Deferred)*

> Not scheduled for immediate implementation. Resume when user growth justifies multi-user features.

### 7.1 Achievements / Badges

- [ ] Define trigger events: first set, first full week, full phase, PR, full 12-week program, streak milestones
- [ ] `computeAchievements(logs)` pure function
- [ ] Store unlocked achievements in `profiles.achievements` (jsonb column)
- [ ] Badge grid display in `ProfileView`

### 7.2 Shareable progress snapshots

- [ ] Server-side OG image via `@vercel/og` at `GET /api/pulse/og?token=<signed>`
- [ ] Token encodes anonymised stats, expires in 24h
- [ ] No PII in snapshot

### 7.3 Leaderboard *(multi-user — far future)*

- [ ] Opt-in participation flag in `profiles`
- [ ] Public leaderboard view
- [ ] Anonymization options

**Questions to answer before starting Phase 7:**
- [ ] Phase 7 priority: achievements first, or shareable snapshots?

---

## Cross-Cutting Concerns

### Error handling
- [ ] Distinguish user errors (invalid input) vs system errors (DB down) in Phase 5 with toast system
- [ ] Consider Vercel Log Drains or Sentry for server-side error logging

### Accessibility
- [ ] All chart components must have `aria-hidden` + text alternative (table or `<caption>`)
- [ ] Confirm toasts use correct ARIA roles (`role="alert"` for errors, `role="status"` for success)
- [ ] Keyboard shortcuts must not conflict with browser defaults

### Testing
- [ ] Unit tests for all new util functions (`computeVolumeByTypeAndWeek`, `computeE1RMHistory`, `computeAchievements`)
- [ ] Component tests for `ProgressView` chart renders with data
- [ ] E2E with Playwright (Phase 5 or later): login → log set → save → reload → verify persisted

### Open questions (calendar / program start date)
- [ ] Should History view show calendar dates (e.g. "Mon 12 May") based on a program start date, or stay as "Week N"?
- [ ] Add `program_start_date` field to `profiles` for week auto-suggestion and reminders?
