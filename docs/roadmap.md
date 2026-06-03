# Pulse — Product Roadmap

## Shipped

- Fast workout logging (ExerciseCard, set logger, RIR)
- 12-week progressive overload programme structure (phases, RIR targets)
- Rest timer (auto-start, persistent)
- Personal records (E1RM-based PR map, per-exercise) — top 5 shown in Profile
- Streak tracking (consecutive weeks trained)
- Bodyweight logging + SVG chart (date picker, delete, last 30 entries)
- Goal weight — target with distance-to-go display in Profile
- Body measurements logging — date-stamped waist / hips / chest / arms entries (cm)
- Progressive overload suggestions — SetLogger pre-fills weight from previous week adjusted for RIR delta
- Exercise library (global seed + user-created, filterable by category)
- Expanded exercise category taxonomy (chest / back / shoulders / triceps / biceps / legs / glutes / calves / abs / other)
- Routine builder (create, add exercises, set starting weights, reorder, delete)
- 17 global routine templates — Full Body, Upper/Lower, PPL, Push/Pull, Bro Split, Arnold Split (DB / Home Gym / Gym variants) + Glute Focus, Lower Body, Full Body Tone (female-focused, Gym / Dumbbells)
- 6-step onboarding modal with rule-based recommendation engine (equipment → experience → goal → days/week → specific days → session time → template match)
- Templates tab in Library (equipment filter, description, one-tap clone)
- Dynamic volume scaling — sessionTime adjusts sets/exercises at clone time (~30 min / 45–60 min / 90+ min)
- Workout history (per-week session cards with set replay and PR badges)
- `workout_type` on `routine_exercises` + `routine_schedule` table (dynamic per-day workout tabs)
- Weekly schedule in onboarding (day picker, auto-fills schedule from template pattern)
- DayTabs — Mon–Sun training day selector with workout-type subtitle, today dot, logged-set badge
- Next.js App Router pages (`/pulse/train`, `/pulse/plan`, `/pulse/progress`, `/pulse/profile`, `/pulse/explore`)
- Desktop layout via `DesktopLayout` component (≥ 1024 px)
- Route group `(protected)` — login page excluded from auth layout, no more redirect loop
- Progress & analytics page — StreakCalendar (12-dot weekly filled), VolumeChart (sets/week by type), E1RMChart (progression line with exercise picker + PR marker), BestLifts summary, session history with name resolution and PR badges
- Toast notification system — `ToastProvider` + `useToast` + `ToastContainer`; replaces inline `saveError` banner; auto-dismiss 4 s, hover-pause, max 3 stacked; success toasts on name/unit save
- Last session display in ExerciseCard — `computeLastSession` utility; shows "Last: 80 kg × 8 × 3 sets" below subtitle
- Notes per set — free-text per-exercise note keyed `week-routineExerciseId`; `useNotes` hook, `/api/pulse/notes` route, inline edit/clear UI in ExerciseCard
- Per-exercise rest timer override — `rest_seconds` column on `routine_exercises`; editable in LibraryView routine editor; `fireTrigger` passes duration to RestTimer
- A/B exercise variation — `variant` column on `routine_exercises` + `routine_schedule`; `WorkoutTabs` with A/B switching; `routineExercisesByTabKey` computed in provider; `nextVariant` pure function; PPL-style routines get auto-seeded A/B variants at clone time
- Workout sessions — `workout_sessions` table (start/complete timestamps); POST `/api/pulse/sessions` + PATCH `/api/pulse/sessions/:id`; `useWorkoutSession` hook; `WorkoutModeScreen` full-screen guided mode with exercise-by-exercise navigation and early-finish
- Warmup set generator — `computeWarmupSets` pure function; 3 steps at 50%×5 / 65%×3 / 80%×1; rounds to nearest 2.5 kg / 5 lb; shown above working sets in ExerciseCard when expanded; hidden below 40 kg working weight
- Workout share card — `computeShareStats` utility; `ShareCard` full-screen overlay shown automatically after finishing a workout; shows workout label, duration, sets, week, top 3 lifts with weights, PR badges, PR count; "Screenshot to share" CTA; variant exercise snapshot preserved
- Bug fixes sprint — Profile PRs now show exercise names (not UUIDs); Plan view sections filtered by scheduled workout types; WorkoutModeScreen shows instantly on Start Workout (session creates in background); Onboarding re-triggers whenever user has no routines
- UX polish sprint — onboarding re-triggers on /train when no routines (prominent empty-state CTA added); auto-activate another routine when active one is deleted; Dumbbell naming consistency throughout exercise library; editable default sets/reps per exercise in Library
- Desktop layout overhaul — two-column sidebar layout for ≥ 1024 px: 180px fixed sidebar (logo, week badge, nav links, streak, active routine context card, sign out) + scrollable content column with rest timer pinned to the bottom
- Slate UX redesign — full reskin to the dark "Slate" direction with a coral accent (Hanken Grotesk + Sora), three-zone desktop shell (icon rail + content + context rail) with a CSS-driven responsive split, tone-shift surfaces over borders
- Live PR detection — `isSetPR` flags a new E1RM personal record the moment a set is logged, inline coral PR badge on the set row plus a quiet toast, in ExerciseCard and WorkoutModeScreen
- Per-muscle weekly volume — `computePerMuscleVolume` derives sets per muscle category for the week from the existing taxonomy; `MuscleVolumeBars` horizontal bar list on Progress
- Plate calculator — `computePlates` pure function (barbell + loadable dumbbell, default bar/handle weights and plate set); compact affordance in SetLogger showing the per-side plate breakdown for the target weight
- Rich set types — drop sets stored in a `drops` jsonb column on `set_logs` plus a failure tag at RIR 0; drop-set editor in SetLogger, rendered in ExerciseCard, WorkoutModeScreen, and history
- Supersets — pair two routine exercises as a superset; merged card in the train screen; rest timer fires once after both exercises' sets; guided mode treats the pair as one step; Pair / Unpair in the routine editor with pair-aware reorder
- Exercise instructions — `exercise_instructions` table (read-only RLS) with primary/secondary muscles + technique cues per global exercise; on-demand `ExerciseInstructionModal` opened from a "How to perform" affordance in ExerciseCard and an info icon in the Library exercise list; ~92 exercises seeded
- Rule-based routine generation — `generation.ts` engine builds a routine from onboarding inputs: split selection by days/experience, session-time-driven volume (with floors so 30-min full body never collapses to one exercise), A/B variations for repeated focuses, exercise selection by equipment + movement pattern; `generateAndSaveRoutine` action; reusable stepped `RoutineSetupFlow` with prominent Generate entry points (Train empty state, Plan, Routines); template "Use this" opens the same flow instead of native dialogs
- Routine editor session grouping — active routine groups by the session type the schedule uses (`sessionTypeFor`): full body shows Full Body, upper/lower shows Upper/Lower (with A/B variants), never the granular push/pull/legs the exercises are tagged with
- Routine rename — inline rename per routine in the Library (`renameRoutine` action + optimistic hook)
- Collapsible desktop sidebar — left rail toggles between a 74px icon rail ("P" mark) and a 208px labelled rail (full "Pulse" wordmark); choice persists in localStorage
- Scroll-rail muscle filter — single non-wrapping horizontal rail with a per-category count badge and a fade edge, replacing the wrapped 11-chip row
- Profile polish — streak shown as a coral hero stat; login screen and skeleton loader reskinned to Slate tokens
- Auto-progression — `computeProgression` double-progression engine: climbs reps within the rep range, then adds weight and resets to the bottom; SetLogger pre-fills both weight and reps and shows the next target, deloading when a set came in harder than the target RIR
- Instant loading (phase 1 of offline-first) — shell-first render; data fetched client-side via SWR with per-view Slate skeletons; user-scoped localStorage SWR cache (cleared on logout) makes warm visits instant via stale-while-revalidate

---

---

## In Progress

Nothing currently in progress.

---

## Competitive analysis (2026-06-03)

Reviewed 8 trackers: Hevy, Strong, Fitbod, Jefit, Boostcamp, Alpha Progression, Caliber, Setgraph.

Biggest gaps versus the field:

- Live PR detection. Every serious tracker (Hevy, Boostcamp, Caliber, Strong) flags a personal record the moment you hit it. Pulse only surfaces PRs after the workout. Pulse already computes E1RM, so this is a small add with a big motivation payoff.
- Per-muscle weekly volume. Hevy, Fitbod, Jefit, Boostcamp, and Strong all show sets per muscle group per week, often as a body-diagram heat map. Pulse has a 10-category taxonomy and a volume-by-type chart already, so it can derive this from exercise tags.
- Plate calculator. Hevy, Strong, Boostcamp, Setgraph, and Caliber all ship one. It is a pure function with near-zero backend cost and removes real friction at the rack.
- Rich set types. Drop sets and failure sets are standard in Hevy, Strong, and Boostcamp. Pulse only has warmup and working sets.
- Mid-workout exercise swap. Boostcamp, Fitbod, Alpha, and Caliber let you swap a busy machine for a similar exercise and carry your weights across. High friction reducer for real gyms.

Differentiation opportunities:

- Recovery-aware volume nudges. Combine per-muscle volume with the existing RIR data to flag under- and over-trained muscles. Fitbod and Boostcamp do versions of this, but none pair it tightly with a fixed 12-week progressive-overload plan the way Pulse can.
- A single Strength Score. Caliber and Boostcamp prove a 0-100 composite metric drives engagement. Pulse already has E1RM PRs to compute it from, and it gives non-experts a legible headline number.
- Stay private and fast. Strong and Setgraph win on being distraction-free with no social noise. Pulse can lean into solo progressive overload as a positioning choice and skip the heavy social race that needs user mass.

---

## Near-term

| # | Feature | Notes |
|---|---|---|
| 1 | Offline-first logging | PWA service worker or local-first. Gym wifi is unreliable. Strong's biggest retention driver. (also in: Hevy, Fitbod, Jefit, Boostcamp, Caliber, Setgraph) |
| 2 | Apple Health / Google Fit sync | Important for users who track calories or use wearables. (also in: Hevy, Strong, Fitbod, Jefit, Caliber) |
| 3 | Mid-workout exercise swap | Swap a busy machine for a similar exercise and carry logged weights to the substitute. Big friction reducer in real gyms. (also in: Boostcamp, Fitbod, Alpha, Caliber) |

_Shipped 2026-06-03: Slate redesign, live PR detection, per-muscle weekly volume, plate calculator, rich set types, supersets, exercise instructions, rule-based routine generation, routine editor session grouping, routine rename, collapsible sidebar, scroll-rail muscle filter, streak hero, login + skeleton reskin (see Shipped)._

---

## Later

| Feature | Notes |
|---|---|
| AI workout generation (v2) | Rule-based generation from onboarding is shipped. v2 adapts split, volume, and exercise selection based on actual logged performance. (also in: Fitbod, Jefit, Boostcamp, Alpha, Setgraph) |
| Strength Score | Single 0-100 composite metric from your main-lift E1RM PRs. Legible headline number for non-experts. Computes from data Pulse already has. (also in: Caliber, Boostcamp) |
| Progress photos | Date-stamped progress photos alongside the existing body measurements. Visual progress comparison. (also in: Hevy, Strong, Jefit, Fitbod) |
| Year / period in review | Shareable annual and monthly recap of volume, PRs, streaks, and milestones. Retention and organic reach. (also in: Hevy, Jefit, Boostcamp) |
| CSV data export | Export full workout history for users who want their own analysis or a backup. (also in: Strong, Alpha, Caliber) |
| Recovery-aware volume nudges | Combine per-muscle volume with RIR to flag under- and over-trained muscles within the 12-week plan. Differentiator. (inspired by: Fitbod, Boostcamp) |
| Achievements + gamification | Milestones: first set, full week, PR, full 12-week cycle, streak records. Implement after real usage data, badges only land well at milestones users actually reach. (also in: Jefit, Boostcamp) |
| Supersets (advanced) | Tri-sets, giant sets, AMRAP tracking. After basic superset support ships. |
| Social / sharing | Friends feed, likes, follow. Requires critical user mass. Not before traction. |
| Wearable integration | Garmin, Apple Watch, Whoop. Heart rate during sets, auto rest timer from HRV. |
| Rest timer auto-advance | Option to automatically navigate to next exercise when rest timer completes. Global toggle or per-exercise setting. |
| Gender in profile | Add gender field; bias onboarding recommendations toward lower-body templates for female users. |
| Periodized programs | Variable-duration (8/10/12/16 weeks); strength-calibration via test week or 1RM; week-by-week progression. Requires workout sessions infrastructure (shipped). |
