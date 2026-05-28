# Pulse — Product Roadmap

## Shipped

- Fast workout logging (ExerciseCard, set logger, RIR)
- 12-week progressive overload programme structure (phases, RIR targets)
- Rest timer (auto-start, persistent)
- Personal records (E1RM-based PR map, per-exercise)
- Streak tracking
- Bodyweight logging + chart
- Exercise library (global seed + user-created, category filter)
- Workout history (per-week volume, session replay)
- Routine builder (create, reorder, delete exercises)
- 14 global routine templates (Full Body, Upper/Lower, PPL, Push/Pull, Bro Split, Arnold Split — DB / Home Gym / Gym variants)
- 5-step onboarding modal with recommendation engine
- Templates tab in Library (equipment filter, "Use this" one-tap clone)
- `workout_type` on `routine_exercises` + `routine_schedule` table (dynamic per-day workout tabs)
- Expanded exercise category taxonomy (chest / back / shoulders / arms / legs / glutes / calves / abs)
- Weekly schedule in onboarding (day picker, auto-fills schedule from template pattern)
- DayTabs — Mon–Sun training day selector with workout-type subtitle, today dot, done/total badge

---

## In Progress

### Pulse Feature Expansion
Plan: `docs/superpowers/plans/2026-05-27-pulse-expansion.md`

- [ ] **Task 1 — Day & week display fixes:** week starts Monday in day picker; all 7 days visible in DayTabs (rest days grayed/disabled)
- [ ] **Task 2 — Pages architecture + view renaming:** convert to Next.js App Router pages (`/pulse/train`, `/pulse/plan`, `/pulse/progress`, `/pulse/profile`, `/pulse/explore`); rename views (Log → Train, Program → Plan, History → Progress, Library → Explore)
- [ ] **Task 3 — Dynamic volume scaling:** `sessionTime` passed to `cloneTemplate`; `applyVolume()` adjusts exercises/sets per session duration tier (~30 min / ~45 min / ~60 min / 90+ min)
- [ ] **Task 4 — Female-focused templates:** 3 new templates — Glute Focus (Gym), Lower Body (Gym), Full Body Tone (Dumbbells)
- [ ] **Task 5 — Program view rework:** week click stays on Plan page (no redirect to log); schedule driven from `activeSchedule`; workout list driven from `routineExercisesByType`
- [ ] **Task 6 — Profile enhancements:** historical body-weight date picker, goal weight, top-5 PRs, measurements form (waist/chest/hips/arms)

---

## Near-term (post-templates)

| # | Feature | Notes |
|---|---|---|
| 1 | Notes per set | Free-text note on any logged set. "Left shoulder tight", "increase next week". Small lift, good retention. |
| 2 | Last session in LogView | Before a set, show "last time: 80kg × 8 × 3". Reduces cognitive load mid-workout. |
| 3 | Per-exercise rest timer | Override the global rest timer per exercise. Compounds → 3 min, isolation → 90s. |
| 4 | Progressive overload suggestions | "Try 82.5kg this week" based on last session + RIR. Fits existing phase/RIR model. |
| 5 | Offline-first logging | PWA service worker or local-first. Gym wifi is unreliable. Strong's biggest retention driver. |
| 6 | Supersets | Group two exercises, shared rest timer, fast switching. Most-requested feature in workout apps. |
| 7 | Warmup set generator | Given working weight, auto-suggest warm-up sets. Small UX win. |
| 8 | Workout share card | Screenshot-friendly summary after a session. Organic marketing. |
| 9 | Exercise instructions | Muscle group diagram, cues, equipment tags per exercise. Needed for new lifters. |
| 10 | Apple Health / Google Fit sync | Important for users who track calories or use wearables. |

---

## Later

| Feature | Notes |
|---|---|
| AI workout generation | Rule-based recommendation (onboarding) is v1. AI gen using logged performance is v2. Adapts split, volume, and exercise selection based on what's actually being logged. |
| Body fat % + measurements | Timestamped entries for waist, chest, hips, etc. Same chart pattern as bodyweight. Pairs with the body metrics section in Profile. |
| Achievements + gamification | Milestones: first 100 workouts, 1-year streak, 1RM PRs, total volume. Implement after real usage data — badges only feel good at milestones users actually reach. |
| Supersets (advanced) | Tri-sets, giant sets, AMRAP tracking. After basic superset support. |
| Social / sharing | Friends feed, likes, follow. Requires critical user mass to feel useful. Not before traction. |
| Wearable integration | Garmin, Apple Watch, Whoop. Heart rate during sets, auto-rest timer. |
