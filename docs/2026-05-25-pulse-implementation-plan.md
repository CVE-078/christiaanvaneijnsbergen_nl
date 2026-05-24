# 2026-05-25 — Pulse App: Implementation Plan (Phases 3.5 → 6)

This plan covers all remaining phases for the Pulse workout tracker.
Each phase is broken into tasks with acceptance criteria, architectural notes, and explicit dependencies.
All work follows the established conventions: inline styles, MONO/ACCENT/theme constants, kg stored in DB with display-unit conversion at render, conventional commits, feature branches.

---

## Prerequisites: Quick Wins (before Phase 4)

These are small, isolated fixes from the audit that should be merged first.
Branch: `fix/pre-phase4-cleanup`

| Task | File | Change |
|------|------|--------|
| QW-1 | `app/pulse/page.tsx` | Parallelize 3 Supabase calls with `Promise.all` |
| QW-2 | `app/pulse/actions.ts` | Add `display_name` length guard (max 50 chars) in `updateProfile` |
| QW-3 | `app/pulse/actions.ts` | Add explicit `weightKg` validation in `logBodyWeight` |
| QW-4 | `app/pulse/actions.ts` | Batch the delete loop using `.in()` instead of N individual deletes |
| QW-5 | `lib/weight-tracker/data.ts` | Change `Record<string, Workout>` → `Record<WorkoutType, Workout>` |
| QW-6 | `app/pulse/actions.ts` | Fix implicit `any` on `row` parameter |
| QW-7 | `app/pulse/page.tsx` | Fix implicit `any` on `r` parameter |
| QW-8 | `app/pulse/` | Add `loading.tsx` with a minimal skeleton |
| QW-9 | `app/pulse/page.tsx` | Add `noindex` metadata export |
| QW-10 | `package.json` | Remove `@vercel/kv` |
| QW-11 | `tsconfig.json` | Add `"types": ["vitest/globals"]` or configure `globals: true` in vitest config |
| QW-12 | `app/pulse/actions.ts` | Validate `id` UUID format in `deleteBodyWeight` |

**Acceptance:** all quick wins in a single branch, green TS check, no test regressions.

---

## Phase 3.5 — Merge & Stabilise

Merge `feature/profiles-bodyweight` into `main` with a clean PR.

**Open items before merge:**
1. Verify `ProfileView` renders correctly in production (Vercel preview deploy)
2. Confirm unit toggle persists across page reloads (Supabase round-trip)
3. Verify bodyweight chart renders with ≥ 2 entries
4. Confirm `SetLogger` correctly re-derives kg values when unit changes

---

## Phase 4 — Progress & Analytics

Branch: `feature/analytics`
Goal: Surface training progress visually — e1RM trends, volume per workout type, streak.

### 4.1 Volume Chart

**What:** Inline SVG bar chart showing total sets logged per week, per workout type (Push/Pull/Legs), broken out or stacked.

**Design:**
- Location: new `ProgressView` component (new nav tab: "Progress")
- Chart type: grouped bar chart — one group per week (12 groups), 3 bars per group (push/pull/legs)
- Colors: use existing workout type colors (`#f97316` push, `#38bdf8` pull, `#a78bfa` legs)
- X-axis: weeks 1–12, with phase dividers
- Y-axis: set count (0–max), min/max labels
- Responsive: SVG with `viewBox`, `width: 100%`
- Tooltip: on hover/tap, show week + type + count (use title element or absolute positioned div)
- Empty state: if no data, show placeholder bars at 50% opacity

**Data derivation:**
```ts
// In utils.ts — new function
export function computeVolumeByTypeAndWeek(logs: Logs): Record<string, Record<WorkoutType, number>>
// Returns { "1": { push: 4, pull: 3, legs: 0 }, "2": { ... }, ... }
```

**Architecture notes:**
- Computation happens in `ProgressView` with `useMemo`
- No new DB queries — derived from `logs` already in state
- Chart is a pure presentational component `<VolumeChart logs={...} />`

### 4.2 e1RM Progression Chart

**What:** Line chart of estimated 1RM over time for a selected exercise, per week.

**Design:**
- Exercise selector: dropdown or scrollable button row showing all exercises
- Chart: line chart with dots per week, ACCENT color
- X-axis: week numbers where data exists (not all 12, only logged weeks)
- Y-axis: e1RM in user's unit
- PR marker: star or badge on the highest point
- Empty state: "Log at least one set to see progression"

**Data derivation:**
```ts
// In utils.ts — new function  
export function computeE1RMHistory(logs: Logs, type: WorkoutType, exIdx: number): Array<{ week: number; e1rm: number }>
// Returns sorted ascending by week, best set per week
```

**Architecture notes:**
- Exercise picker state is local to `ProgressView`
- Default selection: first exercise of active workout type
- Chart height: 120px viewBox

### 4.3 Weekly Volume Table

**What:** Compact table — rows = weeks, columns = Push / Pull / Legs / Total — showing set counts with logged-week dots.

**Design:**
- Positioned above or below the bar chart in `ProgressView`
- Current week row highlighted with ACCENT left border
- Logged weeks have ACCENT dot
- Cells show set count or `—` for unlogged

### 4.4 Best Lifts Summary

**What:** "Top Sets" card per workout type — shows the best single set (highest e1RM) per exercise across all weeks.

**Design:**
- 3 collapsible cards (Push / Pull / Legs) in `ProgressView`
- Each card lists exercises with: name, best weight × reps, week number, e1RM estimate
- Sorted by e1RM descending
- PR badge on highest e1RM overall

### 4.5 Streak Enhancement

**What:** Move streak display from the header line into `ProgressView` with more detail.

**Design:**
- "Current streak: X weeks" with a visual streak calendar (12 dots, filled = logged, connected = consecutive)
- Show longest streak this cycle

### Implementation Order for Phase 4

1. `computeVolumeByTypeAndWeek` + `computeE1RMHistory` in `utils.ts` (with tests)
2. `ProgressView` scaffold with nav tab wired in `TrackerClient`
3. Volume bar chart
4. Weekly volume table
5. e1RM line chart with exercise picker
6. Best lifts summary
7. Streak enhancement

**New type needed:**
```ts
// types.ts
export interface ProgressSummary {
  volumeByWeek: Record<string, Record<WorkoutType, number>>;
  e1rmHistory: Record<string, Array<{ week: number; e1rm: number }>>;
  bestLifts: Record<string, { week: number; kg: number; reps: number; e1rm: number }>;
}
```

**Performance:** All chart data is derived from `logs` in memory — no additional DB calls. `useMemo` all computations.

---

## Phase 5 — Polish & UX

Branch: `feature/ux-polish`
Goal: Quality-of-life improvements that make the app feel finished.

### 5.1 Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `1` / `2` / `3` | Switch to Push / Pull / Legs tab | Log view |
| `←` / `→` | Previous / next week | Log view |
| `P` | Open Program view | Global |
| `H` | Open History view | Global |
| `L` | Open Log view | Global |
| `Escape` | Close open ExerciseCard / dismiss timer | Log view |
| `Enter` | Save focused set | SetLogger input focused |

**Implementation:**
- Single `useKeyboard` hook in `TrackerClient` using `document.addEventListener('keydown')`
- Guard: do not fire if focus is inside an input/textarea (check `document.activeElement.tagName`)
- Display shortcuts as small badges in nav (`P`, `H`, `L`) at ≥768px width only

### 5.2 Toast Notifications

Replace the static error banner with a toast system.

**Design:**
- Bottom-center position, `z-index: 50`
- Three variants: `error` (red), `success` (green), `info` (dim)
- Auto-dismiss after 4s; hover pauses dismiss
- Max 3 toasts stacked
- Accessible: `role="status"` for success/info, `role="alert"` for errors

**Implementation:**
```ts
// lib/weight-tracker/toast.ts — new file
// Minimal React context + useReducer — no external library
export const ToastContext = createContext(...)
export function ToastProvider({ children })
export function useToast(): { show: (msg: string, type: 'success' | 'error' | 'info') => void }
```

- Replace `saveError` state in `TrackerClient` with `useToast().show('Failed to save…', 'error')`
- Use `show('Saved', 'success')` on successful log saves (optional — may be too noisy)
- Use `show('Profile updated', 'success')` on unit/name changes in `ProfileView`

### 5.3 Swipe Gestures for Week Navigation

**What:** Swipe left/right on the Log view to go to next/previous week on mobile.

**Implementation:**
- Custom `useSwipe` hook in `LogView` using touch events (`touchstart`, `touchend`)
- Threshold: 50px horizontal delta, velocity guard to avoid accidental swipes
- No external library — raw touch events
- Animate: slide the content left/right on transition using CSS `transform` with a brief duration

```ts
// lib/weight-tracker/useSwipe.ts — new file
export function useSwipe(onLeft: () => void, onRight: () => void): React.RefObject<HTMLDivElement>
```

### 5.4 Import JSON

Reverse of the existing export. Lets users restore a backup or migrate data.

**Design:**
- Hidden `<input type="file" accept=".json">` triggered by "Import" button in the nav (next to Export)
- On file select: parse JSON, run `validateLogs`, confirm with a dialog ("Import 47 sets? This will overwrite current data."), then call `saveLogs`
- Show toast on success/error

**Security:** `validateLogs` already prevents malformed data from reaching the DB. The confirmation dialog prevents accidental overwrites.

### 5.5 Display Name Save Feedback

Fix UX gap U2 from audit: show a brief "Saved" toast or inline checkmark when display name saves.

**Implementation:** After `await updateProfile(...)` resolves in `ProfileView`, call `show('Name updated', 'success')` via `useToast`.

### 5.6 Empty State in Log View

Add an onboarding prompt for first-time users (no sets logged yet).

**Design:**
- Shown below the exercise list if `savedCount === 0` across all exercises for the current week
- Simple text: "Tap an exercise to start logging."
- Disappears once any set is saved

### 5.7 Haptic Feedback

On mobile, vibrate on set save and on timer completion.

```ts
// In SetLogger.tsx — after onSave() call
if ('vibrate' in navigator) navigator.vibrate(20); // 20ms short tap

// In RestTimer.tsx — when timer reaches 0
if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]); // pattern
```

### Implementation Order for Phase 5

1. Toast system (`ToastProvider`, `useToast`) — needed by others
2. Display name save feedback (depends on toast)
3. Keyboard shortcuts (`useKeyboard` hook)
4. Swipe gestures (`useSwipe` hook)
5. Import JSON
6. Empty state in Log view
7. Haptic feedback (trivial, last)

---

## Phase 6 — Social & Gamification (Planned, Deferred)

> This phase is not scheduled for immediate implementation. Design is documented here for reference.
> Resume when user growth justifies multi-user features.

### 6.1 Achievements / Badges

**Trigger events:**
- First set logged
- First full week completed (all 3 session types in one week)
- Completed a full phase (3 weeks)
- Set a PR on any exercise
- Completed the full 12-week program
- 3-week, 6-week, 12-week streak

**Implementation:** Achievements are computed client-side from `logs` using a `computeAchievements(logs)` pure function. Unlocked achievements are stored in a new `achievements` Supabase table (or serialized JSON in `profiles`). Show in `ProfileView` as a badge grid.

**DB approach — option A (simple, preferred):**
```sql
alter table profiles add column achievements jsonb not null default '[]';
-- array of achievement IDs: ["first_set", "first_week", ...]
```
No separate table needed. Client computes which achievements are unlocked, server stores which have been "seen" to enable notifications.

### 6.2 Shareable Progress Snapshots

**What:** Generate a static image (or shareable URL) of a "progress card" — best lifts, streak, completion percentage.

**Implementation:** Server-side image generation via `@vercel/og` (OG Image generation). Route: `GET /api/pulse/og?token=<signed_token>`. The token is a short-lived signed URL encoding the user's anonymised stats.

**Privacy:** No PII in the snapshot. Stats only. Token expires in 24h.

### 6.3 Leaderboard (Multi-user)

Deferred until multiple users are confirmed. Requires:
- Opt-in leaderboard participation (privacy flag in `profiles`)
- Public leaderboard view
- Anonymization options

---

## Cross-Cutting Concerns for All Phases

### Error Handling
Every server action should:
1. Validate inputs before touching the DB
2. Return typed error responses rather than throwing (or use the `useTransition` catch pattern)
3. Log errors server-side (consider Vercel Log Drains or Sentry)

Current pattern (throw + catch in client) is acceptable but doesn't distinguish between user errors (invalid input) and system errors (DB down). Improve in Phase 5 with the toast system.

### Accessibility
- All interactive elements must have accessible labels (currently good)
- Charts must have `aria-hidden` and a text alternative (table or `<caption>`) for screen readers
- Toasts must use `role="alert"` for errors and `role="status"` for success
- Keyboard shortcuts must not conflict with browser defaults (avoid `Ctrl+`, `Alt+`)

### Testing Strategy
- **Unit tests (vitest):** All new utility functions (`computeVolumeByTypeAndWeek`, `computeE1RMHistory`, `computeAchievements`, `useSwipe`, `useToast`)
- **Component tests (Testing Library):** `ProgressView` chart renders with data, `ProfileView` unit toggle, `SetLogger` unit conversion
- **E2E (Playwright, Phase 5 or later):** Login → log set → save → reload → verify persisted. Currently no E2E tests exist.

### Performance Budget
- Phase 4 charts are SVG, computed from in-memory data — no new DB calls
- Phase 5 keyboard + swipe hooks add ~1KB JS
- Toast system adds ~2KB
- No new dependencies should be added unless unavoidable

### Branch Strategy
```
main
├── fix/pre-phase4-cleanup    (quick wins — merge first)
├── feature/analytics          (Phase 4)
├── feature/ux-polish          (Phase 5)
└── feature/gamification       (Phase 6 — future)
```

Each feature branch is merged to `main` via PR. No long-lived branches.

---

## Open Questions (Require Input Before Phase 4 Starts)

1. **Analytics scope:** Should the e1RM progression chart show all 6 exercises at once (small multiples) or one at a time with a picker? Small multiples give a better overview but are dense on mobile.

2. **Volume chart grouping:** Should the volume bar chart group by workout type (Push/Pull/Legs bars per week) or show total volume per week as a single bar with phase color? The grouped version is more detailed; the single-bar version is cleaner.

3. **ProgressView position in nav:** Should "Progress" come after "History" (Log / Program / History / Progress / Profile) or replace "Program" on mobile (since Program is read-only reference)?

4. **Phase 5 keyboard shortcuts:** Are there any specific shortcuts you want, or should I design them from the above list?

5. **Import JSON UX:** Should import merge with existing data (union of sets) or completely replace? Replace is simpler and safer; merge is useful if logging on multiple devices.

6. **Phase 6 priority:** Achievements (simple, high value) or Shareable snapshots (flashier)? Or defer both entirely?

7. **Calendar dates in History:** Should sessions show an estimated date (e.g., "Mon 12 May" based on week number and a program start date set by the user) or remain as "Week N" only? This requires knowing when the user started Week 1.

8. **Program start date:** Do you want to add a "program start date" field to `profiles` so the app can show calendar dates, auto-suggest the current week, and send reminders?
