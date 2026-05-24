# 2026-05-25 — Pulse App: Implementation Plan (Phases 3.5 → 6)

This plan covers all remaining phases for the Pulse workout tracker.
Each phase is broken into tasks with acceptance criteria, architectural notes, and explicit dependencies.
All work follows the established conventions: inline styles, MONO/ACCENT/theme constants, kg stored in DB with display-unit conversion at render, conventional commits, feature branches.

After every phase: run `bun run typecheck && bun run lint && bun run format`, then second-opinion code review (spec reviewer → quality reviewer per task, final reviewer after all tasks).

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

## Phase 3.5 — Merge & Stabilise

Branch: `feature/profiles-bodyweight` → merge into `main`

- [ ] Verify `ProfileView` renders correctly on Vercel preview deploy
- [ ] Confirm unit toggle persists across page reloads (Supabase round-trip)
- [ ] Verify bodyweight chart renders with ≥ 2 entries
- [ ] Confirm `SetLogger` correctly re-derives kg display values when unit changes
- [ ] Merge `feature/profiles-bodyweight` into `main` via PR

---

## Phase 4 — Progress & Analytics

Branch: `feature/analytics`
Goal: Surface training progress visually — e1RM trends, volume per workout type, streak.

### 4.1 Utility functions

- [ ] Implement `computeVolumeByTypeAndWeek(logs)` in `utils.ts` with tests
- [ ] Implement `computeE1RMHistory(logs, type, exIdx)` in `utils.ts` with tests
- [ ] Add `ProgressSummary` type to `types.ts`

```ts
export interface ProgressSummary {
    volumeByWeek: Record<string, Record<WorkoutType, number>>;
    e1rmHistory: Record<string, Array<{ week: number; e1rm: number }>>;
    bestLifts: Record<string, { week: number; kg: number; reps: number; e1rm: number }>;
}
```

### 4.2 ProgressView scaffold

- [ ] Create `src/components/weight-tracker/views/ProgressView.tsx`
- [ ] Wire "Progress" nav tab into `TrackerClient`
- [ ] Pass `logs` and `unit` as props; compute all derived data with `useMemo`

### 4.3 Volume bar chart

- [ ] Build `<VolumeChart logs={...} unit={...} />` — grouped bars per week, 3 workout types per group
- [ ] Colors: push `#f97316`, pull `#38bdf8`, legs `#a78bfa`
- [ ] X-axis: weeks 1–12 with phase dividers; Y-axis: set count with min/max labels
- [ ] Tooltip on hover/tap (week + type + count)
- [ ] Empty state: placeholder bars at 50% opacity when no data

### 4.4 Weekly volume table

- [ ] Build compact table (rows = weeks, columns = Push / Pull / Legs / Total)
- [ ] Highlight current week row with ACCENT left border
- [ ] Show `—` for unlogged weeks; ACCENT dot for logged weeks

### 4.5 e1RM progression chart

- [ ] Build line chart with dots per logged week, ACCENT color
- [ ] Exercise picker (dropdown or button row) — default to first exercise of active tab
- [ ] PR marker on the highest point
- [ ] Empty state: "Log at least one set to see progression"

### 4.6 Best lifts summary

- [ ] 3 collapsible cards (Push / Pull / Legs) listing best set per exercise
- [ ] Show: name, best weight × reps, week number, e1RM estimate
- [ ] Sort by e1RM descending; PR badge on overall highest

### 4.7 Streak enhancement

- [ ] Move streak display from header into `ProgressView`
- [ ] Visual streak calendar: 12 dots, filled = logged, connected = consecutive
- [ ] Show current streak and longest streak this cycle

**Questions to answer before starting Phase 4:**
- [ ] e1RM chart: small multiples (all exercises) or single chart with picker?
- [ ] Volume chart: grouped by workout type or single total bar per week?
- [ ] ProgressView nav position: after History, or replace Program on mobile?

---

## Phase 5 — Polish & UX

Branch: `feature/ux-polish`
Goal: Quality-of-life improvements that make the app feel finished.

### 5.1 Toast notification system

- [ ] Create `src/lib/weight-tracker/toast.ts` — React context + `useReducer`, no external library
- [ ] Three variants: `error` (red), `success` (green), `info` (dim)
- [ ] Auto-dismiss after 4s; hover pauses dismiss; max 3 stacked
- [ ] `role="status"` for success/info, `role="alert"` for errors
- [ ] Replace `saveError` state in `TrackerClient` with `useToast().show(...)`
- [ ] Use `show('Profile updated', 'success')` on unit/name changes

### 5.2 Keyboard shortcuts

- [ ] Implement `useKeyboard` hook in `TrackerClient` using `document.addEventListener('keydown')`
- [ ] Guard: no-op when focus is inside an input/textarea
- [ ] `1` / `2` / `3` → switch Push / Pull / Legs tab (Log view)
- [ ] `←` / `→` → previous / next week (Log view)
- [ ] `P` / `H` / `L` → open Program / History / Log view (global)
- [ ] `Escape` → close open ExerciseCard / dismiss timer
- [ ] Show shortcut badges in nav at ≥ 768px width only

### 5.3 Swipe gestures for week navigation

- [ ] Create `src/lib/weight-tracker/useSwipe.ts` hook using raw touch events
- [ ] Threshold: 50px horizontal delta + velocity guard
- [ ] Wire into `LogView` for previous/next week
- [ ] Brief CSS `transform` slide animation on transition

### 5.4 Import JSON

- [ ] Hidden `<input type="file" accept=".json">` triggered by "Import" button in nav
- [ ] Parse JSON → `validateLogs` → confirm dialog ("Import N sets? This will overwrite current data.")
- [ ] Call `saveLogs` on confirm; show toast on success/error
- [ ] Answer before implementing: merge with existing data, or replace?

### 5.5 Display name save feedback *(done in QW-17)*

- [x] Show "Saved ✓" confirmation after display name update

### 5.6 Empty state in Log view *(done in QW-18)*

- [x] Show "Tap an exercise to start logging." when no sets are logged for current week

### 5.7 Haptic feedback

- [ ] Vibrate 20ms on set save in `SetLogger` (`navigator.vibrate(20)`)
- [ ] Vibrate pattern on timer completion in `RestTimer` (`navigator.vibrate([100, 50, 100])`)

**Questions to answer before starting Phase 5:**
- [ ] Keyboard shortcuts: any additions or changes to the list above?
- [ ] Import JSON: merge or replace?

---

## Phase 6 — Social & Gamification *(Deferred)*

> Not scheduled for immediate implementation. Resume when user growth justifies multi-user features.

### 6.1 Achievements / Badges

- [ ] Define trigger events: first set, first full week, full phase, PR, full 12-week program, streak milestones
- [ ] `computeAchievements(logs)` pure function
- [ ] Store unlocked achievements in `profiles.achievements` (jsonb column)
- [ ] Badge grid display in `ProfileView`

### 6.2 Shareable progress snapshots

- [ ] Server-side OG image via `@vercel/og` at `GET /api/pulse/og?token=<signed>`
- [ ] Token encodes anonymised stats, expires in 24h
- [ ] No PII in snapshot

### 6.3 Leaderboard *(multi-user — far future)*

- [ ] Opt-in participation flag in `profiles`
- [ ] Public leaderboard view
- [ ] Anonymization options

**Questions to answer before starting Phase 6:**
- [ ] Phase 6 priority: achievements first, or shareable snapshots?

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
