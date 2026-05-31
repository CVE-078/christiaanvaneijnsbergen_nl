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

---

---

## In Progress

Nothing currently in progress.

---

## Near-term

| # | Feature | Notes |
|---|---|---|
| 3 | Offline-first logging | PWA service worker or local-first. Gym wifi is unreliable. Strong's biggest retention driver. |
| 4 | Supersets | Group two exercises, shared rest timer, fast switching. Most-requested feature in workout apps. |
| 5 | Exercise instructions | Muscle group diagram, cues, equipment tags per exercise. Needed for new lifters. |
| 6 | Apple Health / Google Fit sync | Important for users who track calories or use wearables. |

---

## Later

| Feature | Notes |
|---|---|
| AI workout generation | Rule-based recommendation (onboarding) is shipped. AI v2 adapts split, volume, and exercise selection based on actual logged performance. |
| Achievements + gamification | Milestones: first set, full week, PR, full 12-week cycle, streak records. Implement after real usage data — badges only land well at milestones users actually reach. |
| Supersets (advanced) | Tri-sets, giant sets, AMRAP tracking. After basic superset support ships. |
| Social / sharing | Friends feed, likes, follow. Requires critical user mass. Not before traction. |
| Wearable integration | Garmin, Apple Watch, Whoop. Heart rate during sets, auto rest timer from HRV. |
| Rest timer auto-advance | Option to automatically navigate to next exercise when rest timer completes. Global toggle or per-exercise setting. |
| Muscle group filter as dropdown | Current flat chip list for 10 categories is cluttered. Collapse into dropdown or grouped (Push / Pull / Legs / Other). |
| Login screen refresh | Visual update to match current Pulse design language. |
| Skeleton loader refresh | Update skeleton styles to match current design tokens. |
| Streak hero stat | Make streak number more prominent on Profile (currently undersized). |
| Gender in profile | Add gender field; bias onboarding recommendations toward lower-body templates for female users. |
| Periodized programs | Variable-duration (8/10/12/16 weeks); strength-calibration via test week or 1RM; week-by-week progression. Requires workout sessions infrastructure (shipped). |
