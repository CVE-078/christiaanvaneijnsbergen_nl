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
- Next.js App Router pages (`/pulse/train`, `/pulse/plan`, `/pulse/progress`, `/pulse/profile`, `/pulse/library`)
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
- Routine generation redesign — emphasis-based generation so repeated focuses differ by design; program-style picker (Full Body / Emphasis Days / PPL / Upper-Lower / PPL+FB / Heavy-Med-Pump / ULPPL etc., keyed by day count); cross-session avoid-set variation; rep ranges by bias + lift type (incl. pump); auto-supersets for 30-min sessions; equipment correctness (every global exercise tagged + `pull_up_bar` key); A/B variants generalized to A-D with a per-day `routine_schedule.variant` pin
- Audit cleanup — input validation, perf (targeted log writes, ExerciseCard precompute, HistoryView single pass, swrCache throttle), and DRY/maintainability (label-map collapse, TabKey comparator + `baseWorkoutType` helpers, `ui.ts` consolidation, `actions.ts`/`RoutinesTab.tsx` splits); `explore` route renamed to `library`
- Exercise preferences (hide / never-show) — `user_exercise_preferences` table (RLS); `setExercisePreference` action + `/api/pulse/preferences` GET + `usePreferences` hook; `hiddenExerciseIds` on context; hide/unhide + "Show hidden" in the Library; generation filters hidden exercises out of the pool; non-destructive "Hidden" marker in the routine editor
- Mid-workout exercise swap — week-scoped `exercise_swaps` (per routine_exercise + week); same-movement-pattern candidate picker (`swapCandidates`) excluding hidden + in-session; `resolveExercise` overrides the displayed exercise for that week only (logs/PRs/volume stay slot-keyed); weight carries over via the existing slot suggestion; available from ExerciseCard, guided mode, and reflected in history
- Routine generation explainability — generated routines persist a human-readable `rationale` (built from the onboarding inputs + the style's `bestFor`); shown as a "Why this plan" line on the Plan screen and previewed live in the setup flow's final step
- Weekly per-muscle volume targets — goal-agnostic `VOLUME_TARGETS` set-range table + pure `computeVolumeProgress`; the Progress per-muscle bars show progress toward each target with "N sets to go" nudges and a lagging-muscle summary
- Recomp dashboard — a Progress headline card combining strength (summed best E1RM/week), bodyweight, and waist trends into a plain-language verdict ("You're recomping…", "Gaining…", "Keep logging…") with per-signal deltas; also adds the body-measurements read path (previously write-only)
- Offline-first logging (phase 2 of offline-first) — IndexedDB offline write queue for set logs + notes: writes enqueue when offline or on network failure (optimistic SWR mutate keeps the UI live), flushed FIFO on reconnect / focus / mount with last-write-wins; pending-sync indicator on the train screen; installable PWA web manifest scoped to `/pulse`; `/pulse`-scoped service worker (navigation network-first with cached-shell fallback, static assets cache-first, skips `/api`, cleans old caches on activate); CSP gains `worker-src` + `manifest-src 'self'`
- Gender in profile — nullable `sex` column on `profiles` (male/female); Sex toggle in Profile + an optional onboarding step; `recommendStyle(count, sex)` lightly biases the default program style for female users (4-day → Aesthetic Upper/Lower, 3-day → Full Body Emphasis Days); also feeds the Strength Score. Deeper gender-specific volume/emphasis tuning is deferred to the Muscle priority item
- Strength Score — 0-100 relative-strength composite (`computeStrengthScore` in `strength.ts`): each main lift's best E1RM ÷ latest bodyweight is scored against sex-specific bodyweight-multiple standards (bench / squat / deadlift / OHP) via piecewise-linear interpolation across Beginner→Elite, averaged to one headline number with a level label and per-lift breakdown; `StrengthScoreCard` headline on Progress, with a CTA when sex / bodyweight / a main lift is missing
- Recovery-aware volume nudges — `computeRecoveryFlags` pairs each muscle's weekly working-set count with its average RIR to classify under (below floor), high fatigue (in range, avg RIR ≤ 0.5), over target (above ceiling), or on track; rendered as per-muscle status chips on the Progress volume-by-muscle bars (no change when no targets/recovery passed)
- Rest timer auto-advance — guided mode (`WorkoutModeScreen`) now shows a visible rest timer and, with the Profile "Auto-advance rest timer" toggle on, jumps to the next exercise when rest ends and the current exercise is fully logged; the global pinned timer is suppressed while guided mode is open so only one timer runs (`RestTimer` gains an `onComplete` callback, `workoutModeOpen` + `autoAdvance` on context)

---

## In Progress

_Nothing currently in progress._

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

Promoted from Later 2026-06-04 after clearing the previous four. Same value-per-effort ordering: cheapest web-native win first, then the item that extends what we just shipped, then the higher-effort visual feature. All three serve the two current users and need no user mass or accumulated data.

| # | Feature | Notes |
|---|---------|-------|
| 1 | CSV data export | Export full workout history (logs + sessions + PRs) as CSV for backup or external analysis. Small, pure-compute, ownership value; no schema or storage changes. (also in: Strong, Alpha, Caliber) |
| 2 | Muscle priority selection | User prioritizes a muscle; the generator shifts weekly volume toward it. Builds directly on the shipped per-muscle volume targets and folds in the deferred gender/emphasis weighting (the light female style bias becomes an explicit, user-driven priority). Moderate effort, high value for both users. |
| 3 | Progress photos | Date-stamped progress photos alongside the existing body measurements; visual progress comparison that pairs with the recomp dashboard. Biggest of the three — needs file upload + a Supabase storage bucket (RLS) and a CSP `img-src`/`connect-src` update for the storage host. (also in: Hevy, Strong, Jefit, Fitbod) |

_Shipped 2026-06-04: gender in profile, strength score, recovery-aware volume nudges, rest-timer auto-advance, mid-workout exercise swap, generation explainability, weekly per-muscle volume targets, recomp dashboard, offline-first logging (see Shipped)._
_Shipped 2026-06-03: Slate redesign, live PR detection, per-muscle weekly volume, plate calculator, rich set types, supersets, exercise instructions, rule-based routine generation, routine editor session grouping, routine rename, collapsible sidebar, scroll-rail muscle filter, streak hero, login + skeleton reskin (see Shipped)._

---

## Later

Same value-per-effort ordering as Near-term, continued: web-native moderate-value items first, then bigger or data-gated work, then native-platform and scale-gated items last. (Progress photos, CSV export, and Muscle priority were promoted to Near-term 2026-06-04.)

| Feature | Notes |
|---|---|
| Adaptive missed-workout regeneration | "You missed Lower B, here's an adjusted week" instead of restart. High adherence value; sessions infra exists. Lower urgency at current scale. (inspired by: Fitbod) |
| Periodized programs | Variable-duration (8/10/12/16 weeks); strength-calibration via test week or 1RM; week-by-week progression. Requires workout sessions infrastructure (shipped). Bigger lift. |
| Plateau detection + smart deload | Detect a stalled lift over N weeks and recommend volume change / exercise swap / deload. Static week-12 deload exists; this is the data-driven version. Needs accumulated logs. (also in: Alpha, Boostcamp) |
| Supersets (advanced) | Tri-sets, giant sets, AMRAP tracking. After basic superset support (shipped). Niche. |
| Achievements + gamification | Milestones: first set, full week, PR, full 12-week cycle, streak records. Implement after real usage data — badges only land well at milestones users actually reach. (also in: Jefit, Boostcamp) |
| Year / period in review | Shareable annual and monthly recap of volume, PRs, streaks, and milestones. Retention and organic reach. Needs a year of data to be meaningful. (also in: Hevy, Jefit, Boostcamp) |
| AI workout generation (v2) | Rule-based generation from onboarding is shipped. v2 adapts split, volume, and exercise selection based on actual logged performance. Needs months of logged data to not feel random — premature at current scale. (also in: Fitbod, Jefit, Boostcamp, Alpha, Setgraph) |
| ExerciseCard memo effectiveness | `ExerciseCard` is wrapped in `React.memo`, but the save path still passes the whole `logs`/`prMap` objects (new refs on every save) so all cards re-render anyway. Slice per-card data upstream in `LogView` (own set entries + savedCount + per-exercise PR) so unchanged cards keep stable props and a save touches one card. Refactor of the hottest screen — defer until it actually hurts at scale. |
| Apple Health / Google Fit sync | Import bodyweight / activity from wearables and calorie trackers; export workouts. Native-gated — HealthKit is iOS-native (no web API) and Google has been moving Fit to Android-native Health Connect, so this means going off the web (Capacitor/native). Low ROI at two users. (also in: Hevy, Strong, Fitbod, Jefit, Caliber) |
| Wearable integration | Garmin, Apple Watch, Whoop. Heart rate during sets, auto rest timer from HRV. Native-platform integration — same off-the-web cost as Health/Fit sync; far off. |
| Social / sharing | Friends feed, likes, follow. Requires critical user mass. Not before traction. |

---

## Deprioritized (evaluated 2026-06-04, not planned)

From a ChatGPT feature audit. Real ideas, but low value at current scale or trust-risky — revisit only if the rationale changes.

Ordered by revisit-likelihood: small/standalone ideas first, then those gated on a future v2 adaptive engine, then the trust-risky or heavy-modeling ones last.

| Feature | Why not |
|---|---|
| Recovery warnings (e.g. legs Mon+Tue) | Schedule is user-chosen and small; low value. Smallest standalone rule if ever revisited. |
| Program coherence score (X/100) | Decorative for a deterministic generator that's already correct by construction (slot-based, equipment-filtered, volume floors). It can't emit an incoherent program. Only earns its keep guarding a fuzzy v2 adaptive engine. |
| Dynamic volume management | Needs the v2 adaptive engine + logged data. Bundle with v2 if pursued. |
| Exercise recommendation AI | Vague; rule-based selection + the shipped preferences/swap already cover the real need. |
| Goal forecasting ("86 kg in 12 weeks") | Easy to get wrong; a missed prediction erodes trust more than it motivates. |
| Muscle recovery / fatigue modeling | Fitbod's signature, but heavy modeling for marginal payoff at two users and risks feeling pseudo-scientific. |
