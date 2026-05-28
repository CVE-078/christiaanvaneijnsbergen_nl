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

---

## In Progress

### Phase 5 — Progress & Analytics

- [ ] HistoryView: resolve exercise name from `routineExerciseId` (currently renders "Exercise" placeholder)
- [ ] `computeVolumeByTypeAndWeek(logs)` utility + tests
- [ ] `computeE1RMHistory(logs, routineExerciseId)` utility + tests
- [ ] Volume bar chart — sets per week grouped by workout type
- [ ] e1RM progression line chart with exercise picker and PR marker
- [ ] Best lifts summary per workout type
- [ ] Streak calendar — 12 dots, filled = week with logged data

---

## Near-term

| # | Feature | Notes |
|---|---|---|
| 1 | Notes per set | Free-text note on any logged set. "Left shoulder tight", "increase next week". Small lift, good retention. |
| 2 | Last session display in LogView | Show "last time: 80 kg × 8 × 3" before logging a set. Suggestion pre-fill exists; explicit prior-session display does not. |
| 3 | Per-exercise rest timer | Override the global rest timer per exercise. Compounds → 3 min, isolation → 90 s. Stored in `routine_exercises`. |
| 4 | Offline-first logging | PWA service worker or local-first. Gym wifi is unreliable. Strong's biggest retention driver. |
| 5 | Supersets | Group two exercises, shared rest timer, fast switching. Most-requested feature in workout apps. |
| 6 | Warmup set generator | Given working weight, auto-suggest warm-up sets. Small UX win. |
| 7 | Workout share card | Screenshot-friendly summary after a session. Organic marketing. |
| 8 | Exercise instructions | Muscle group diagram, cues, equipment tags per exercise. Needed for new lifters. |
| 9 | Apple Health / Google Fit sync | Important for users who track calories or use wearables. |

---

## Later

| Feature | Notes |
|---|---|
| AI workout generation | Rule-based recommendation (onboarding) is shipped. AI v2 adapts split, volume, and exercise selection based on actual logged performance. |
| Achievements + gamification | Milestones: first set, full week, PR, full 12-week cycle, streak records. Implement after real usage data — badges only land well at milestones users actually reach. |
| Supersets (advanced) | Tri-sets, giant sets, AMRAP tracking. After basic superset support ships. |
| Social / sharing | Friends feed, likes, follow. Requires critical user mass. Not before traction. |
| Wearable integration | Garmin, Apple Watch, Whoop. Heart rate during sets, auto rest timer from HRV. |
