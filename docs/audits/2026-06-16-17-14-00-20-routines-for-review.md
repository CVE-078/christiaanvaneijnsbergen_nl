# Pulse, 20 generated routines for LLM review

These 20 routines come straight from Pulse's **real slot-first generation engine**, run against the **live seeded exercise catalogue (94 exercises)**, at the latest engine state (post context-sensitive exercise scoring). Nothing here is hand-written. Each block shows the full input config, the per-session exercise list (`sets x reps`, movement pattern, compound/isolation), any generation warnings, and the resulting weekly per-muscle DIRECT-set volume vs target with the worst gaps flagged.

The set spans the engine's full range on purpose: every program style (all 13), every training frequency (2 to 6 days), all four training-style biases (balanced / strength / bodybuilding / powerbuilding), all three goals and experience levels, all four movement restrictions (knee / lower-back / shoulder / wrist), thin-equipment cases (dumbbell-only, barbell-only, machines-only), and priority-muscle + consistent-variety cases.

## What Pulse is (context for scoring)

Pulse is an adaptive strength and hypertrophy coach. The generator is **deterministic and equipment-aware**: it fills movement-pattern slots per session, respects the user's equipment, restrictions, experience, goal, and training-style, and aims for sensible weekly volume per muscle. It is NOT an LLM and does not "design" creatively; it composes from a fixed catalogue under hard constraints. Periodization (RIR ramps, deloads) happens at training time, not in this static blueprint, so the rep ranges here are the week-1 working ranges.

## How to review (please follow this rubric)

For **each** routine, give a **score out of 10** and a one-paragraph rationale, judging it **against its own stated config** (a dumbbell-only or restricted routine should be judged on how well it works within those limits, not against a full-gym ideal). Assess:

1. **Exercise selection.** Are the picks sensible and high-quality for the goal and style? Any odd, redundant, or clearly suboptimal choices?
2. **Volume and balance.** Is weekly per-muscle volume reasonable and balanced (no glaring under or over-training for the stated goal)? Is push/pull and upper/lower balance sound?
3. **Structure.** Sensible session ordering (compounds first), sane set/rep prescription for the goal and training-style, good split logic.
4. **Constraint handling.** Does it correctly honour equipment limits, restrictions, priority muscle, and session length? Are the warnings (e.g. `over_time`, `muscle_coverage_low`) fair and expected, or do they signal a real problem?
5. **Anything that reads wrong.** Anything a knowledgeable coach would flag.

Then give an **overall score out of 10** for the engine across all 20, and a short prioritized list of the biggest improvement opportunities.

> Target bar: the engine is considered ready to move on from when it consistently scores **8/10 or higher**.

---

## 1. 3-day Full Body, beginner, general fitness, full gym, 45 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Beginner
Goal:             General Fitness
Days:             Mon, Wed, Fri (3 days)
Session length:   45–60 min
Split / style:    Full Body (fb-3)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — full_body A — 6 ex, 5 compound / 1 iso ===
  1. Barbell Squat — 4x5-8 (squat, compound)
  2. Barbell Bench Press — 3x5-8 (horizontal_push, compound)
  3. Romanian Deadlift — 3x5-8 (hinge, compound)
  4. Barbell Overhead Press — 3x5-8 (vertical_push, compound)
  5. Barbell Row — 3x5-8 (horizontal_pull, compound)
  6. Face Pull — 4x10-15 (shoulder_iso, iso)

=== Wed — full_body B — 6 ex, 4 compound / 2 iso ===
  1. Hip Thrust — 6x10-15 (hinge, compound)
  2. Incline Barbell Press — 3x8-12 (horizontal_push, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  5. Upright Row — 6x12-15 (shoulder_iso, iso)
  6. Cable Curl — 6x12-15 (biceps_iso, iso)

=== Fri — full_body C — 6 ex, 5 compound / 1 iso ===
  1. Leg Press — 3x8-12 (squat, compound)
  2. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  4. Dumbbell Bench Press — 3x8-12 (horizontal_push, compound)
  5. Dumbbell Bent-Over Row — 3x8-12 (horizontal_pull, compound)
  6. Tricep Pushdown — 6x10-15 (triceps_iso, iso)

=== warnings: over_time, no_vertical_pull, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 0 · upper_back 9 · front_delts 6 · side_delts 6/8 (75%) · rear_delts 4/6 (67%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 10/10 (100%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 0 · core 0
=== potential gaps (worst first): back 75%, glutes 75%, hamstrings 75%, side_delts 75%, chest 90% ===
```

## 2. 3-day Push / Pull / Legs, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Wed, Fri (3 days)
Session length:   45–60 min
Split / style:    Push / Pull / Legs (ppl-3)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — push — 7 ex, 2 compound / 5 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Chest Fly — 3x12-15 (chest_iso, iso)
  4. Upright Row — 6x12-15 (shoulder_iso, iso)
  5. Tricep Pushdown — 3x12-15 (triceps_iso, iso)
  6. Dumbbell Tricep Overhead Extension — 3x12-15 (triceps_iso, iso)
  7. Face Pull — 3x12-15 (shoulder_iso, iso)

=== Wed — pull — 7 ex, 2 compound / 5 iso ===
  1. Barbell Row — 3x8-12 (horizontal_pull, compound)
  2. Pull-Up — 3x8-12 (vertical_pull, compound)
  3. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  4. Front Raise — 3x12-15 (shoulder_iso, iso)
  5. Cable Curl — 6x12-15 (biceps_iso, iso)
  6. Dumbbell Shrug — 3x12-15 (back_iso, iso)
  7. Rear Delt Fly — 3x12-15 (shoulder_iso, iso)

=== Fri — legs — 6 ex, 3 compound / 3 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 6x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Cable Kickback — 6x12-15 (glute_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)

=== warnings: muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 6/10 (60%) · lats 6 · upper_back 6 · front_delts 6 · side_delts 6/8 (75%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 6/10 (60%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 3 · core 3
=== potential gaps (worst first): chest 60%, quads 60%, glutes 75%, hamstrings 75%, side_delts 75% ===
```

## 3. 3-day Full Body, dumbbell + bench only, intermediate, build muscle, 45 min

```

Equipment:        Dumbbells, Bench
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Wed, Sat (3 days)
Session length:   45–60 min
Split / style:    Full Body (fb-3)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — full_body A — 7 ex, 5 compound / 2 iso ===
  1. Dumbbell Goblet Squat — 4x10-15 (squat, compound)
  2. Dumbbell Overhead Press — 3x6-8 (vertical_push, compound)
  3. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  4. Dumbbell Bench Press — 3x6-8 (horizontal_push, compound)
  5. Dumbbell Bent-Over Row — 3x6-8 (horizontal_pull, compound)
  6. Preacher Curl — 3x10-15 (biceps_iso, iso)
  7. Dumbbell Lateral Raise — 3x10-15 (shoulder_iso, iso)

=== Wed — full_body B — 7 ex, 4 compound / 3 iso ===
  1. Hip Thrust — 6x10-15 (hinge, compound)
  2. Incline Dumbbell Press — 3x8-12 (horizontal_push, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Chest-Supported Row — 3x8-12 (horizontal_pull, compound)
  5. Upright Row — 3x12-15 (shoulder_iso, iso)
  6. Dumbbell Tricep Overhead Extension — 6x12-15 (triceps_iso, iso)
  7. Incline Dumbbell Curl — 3x12-15 (biceps_iso, iso)

=== Sat — full_body C — 6 ex, 5 compound / 1 iso ===
  1. Dumbbell Sumo Squat — 3x10-15 (squat, compound)
  2. Dumbbell Single-Arm Row — 3x8-12 (horizontal_pull, compound)
  3. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  4. Decline Dumbbell Press — 3x8-12 (horizontal_push, compound)
  5. Dumbbell Push Press — 3x3-5 (vertical_push, compound)
  6. Dumbbell Reverse Fly — 4x10-15 (shoulder_iso, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 0 · upper_back 9 · front_delts 6 · side_delts 6/8 (75%) · rear_delts 4/6 (67%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 10/10 (100%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 0 · core 0
=== potential gaps (worst first): back 75%, glutes 75%, hamstrings 75%, side_delts 75%, chest 90% ===
```

## 4. 4-day Upper / Lower (Classic), intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Barbell Row — 3x8-12 (horizontal_pull, compound)
  4. Pull-Up — 3x8-12 (vertical_pull, compound)
  5. Chest Fly — 3x12-15 (chest_iso, iso)
  6. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  7. Face Pull — 6x12-15 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Cable Kickback — 3x12-15 (glute_iso, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  2. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Upright Row — 6x12-15 (shoulder_iso, iso)
  4. Cable Curl — 6x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 4x12-15 (hamstring_iso, iso)
  4. Abduction Machine — 3x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 6 · upper_back 6 · front_delts 6 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 12/10 (120%) · hamstrings 8/8 (100%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): chest 90% ===
```

## 5. 4-day PHUL (Powerbuilding), advanced, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Advanced
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Power Hypertrophy Upper Lower (phul-4)
Training style:   Powerbuilding
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 5x3-6 (horizontal_push, compound)
  2. Barbell Overhead Press — 4x3-6 (vertical_push, compound)
  3. Barbell Row — 4x3-6 (horizontal_pull, compound)
  4. Pull-Up — 4x3-6 (vertical_pull, compound)
  5. Cable Curl — 4x10-15 (biceps_iso, iso)
  6. Tricep Pushdown — 8x10-15 (triceps_iso, iso)
  7. Face Pull — 6x10-15 (shoulder_iso, iso)

=== Tue — lower A — 6 ex, 3 compound / 3 iso ===
  1. Barbell Squat — 5x3-6 (squat, compound)
  2. Romanian Deadlift — 4x3-6 (hinge, compound)
  3. Dumbbell Bulgarian Split Squat — 4x10-15 (lunge, compound)
  4. Cable Kickback — 4x10-15 (glute_iso, iso)
  5. Dumbbell Calf Raise — 4x10-15 (calf, iso)
  6. Crunch — 4x10-15 (core, iso)

=== Thu — upper B — 6 ex, 3 compound / 3 iso ===
  1. Incline Barbell Press — 4x8-12 (horizontal_push, compound)
  2. T-Bar Row — 4x8-12 (horizontal_pull, compound)
  3. Lat Pulldown — 4x8-12 (vertical_pull, compound)
  4. Chest Fly — 4x12-15 (chest_iso, iso)
  5. Upright Row — 8x12-15 (shoulder_iso, iso)
  6. Preacher Curl — 4x12-15 (biceps_iso, iso)

=== Fri — lower B — 6 ex, 3 compound / 3 iso ===
  1. Leg Press — 4x8-12 (squat, compound)
  2. Dumbbell Romanian Deadlift — 4x10-15 (hinge, compound)
  3. Step-Up — 4x8-12 (lunge, compound)
  4. Abduction Machine — 4x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 4x12-15 (calf, iso)
  6. Plank — 4x12-15 (core, iso)

=== warnings: over_time ===

=== weekly muscle volume (direct sets · target) ===
  chest 13/10 (130%) · lats 8 · upper_back 8 · front_delts 4 · side_delts 8/8 (100%) · rear_delts 6/6 (100%) · biceps 8/8 (100%) · triceps 8/8 (100%) · quads 17/10 (170%) · hamstrings 8/8 (100%) · glutes 8/8 (100%) · calves 8 · core 8
=== potential gaps (worst first): (none) ===
```

## 6. 4-day Upper / Lower (Aesthetic), intermediate, bodybuilding, full gym, 60 min, priority CHEST

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Aesthetic Upper / Lower (ul-aesthetic-4)
Training style:   Bodybuilding
Variety:          Varied
Priority muscle:  Chest
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 3 compound / 4 iso ===
  1. Pull-Up — 3x8-12 (vertical_pull, compound)
  2. Incline Dumbbell Press — 4x8-12 (horizontal_push, compound)
  3. Seated Cable Row — 3x8-12 (horizontal_pull, compound)
  4. Chest Fly — 4x15-20 (chest_iso, iso)
  5. Upright Row — 4x15-20 (shoulder_iso, iso)
  6. Dumbbell Shrug — 3x15-20 (back_iso, iso)
  7. Cable Curl — 4x15-20 (biceps_iso, iso)

=== Tue — lower A (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Hack Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x15-20 (quad_iso, iso)
  5. Seated Calf Raise — 3x15-20 (calf, iso)
  6. Cable Crunch — 3x15-20 (core, iso)
  7. Cable Kickback — 3x15-20 (glute_iso, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. Barbell Overhead Press — 3x12-15 (vertical_push, compound)
  2. Chest-Supported Row — 3x12-15 (horizontal_pull, compound)
  3. Dumbbell Reverse Fly — 6x15-20 (shoulder_iso, iso)
  4. Dumbbell Bicep Curl — 4x15-20 (biceps_iso, iso)
  5. Tricep Pushdown — 6x15-20 (triceps_iso, iso)
  6. Dumbbell Pullover — 3x15-20 (back_iso, iso)
  7. Dumbbell Lateral Raise — 4x15-20 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Leg Curl — 4x15-20 (hamstring_iso, iso)
  4. Abduction Machine — 3x15-20 (glute_iso, iso)
  5. Smith Machine Calf Raise — 3x15-20 (calf, iso)
  6. Plank — 3x15-20 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 8/10 (80%) · lats 6 · upper_back 9 · front_delts 3 · side_delts 8/8 (100%) · rear_delts 6/6 (100%) · biceps 8/8 (100%) · triceps 6/8 (75%) · quads 12/10 (120%) · hamstrings 8/8 (100%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): chest 80% ===
```

## 7. 5-day Upper / Lower + PPL, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Wed, Thu, Fri (5 days)
Session length:   45–60 min
Split / style:    Upper / Lower / Push / Pull / Legs (ulppl-5)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — upper — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Barbell Row — 3x8-12 (horizontal_pull, compound)
  4. Pull-Up — 3x8-12 (vertical_pull, compound)
  5. Upright Row — 4x10-15 (shoulder_iso, iso)
  6. Cable Curl — 4x10-15 (biceps_iso, iso)
  7. Face Pull — 3x10-15 (shoulder_iso, iso)

=== Tue — lower (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Cable Kickback — 3x12-15 (glute_iso, iso)

=== Wed — push — 7 ex, 2 compound / 5 iso ===
  1. Incline Barbell Press — 3x8-12 (horizontal_push, compound)
  2. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Chest Fly — 3x12-15 (chest_iso, iso)
  4. Dumbbell Reverse Fly — 3x12-15 (shoulder_iso, iso)
  5. Tricep Pushdown — 4x12-15 (triceps_iso, iso)
  6. Dumbbell Tricep Overhead Extension — 4x12-15 (triceps_iso, iso)
  7. Dumbbell Lateral Raise — 4x12-15 (shoulder_iso, iso)

=== Thu — pull — 6 ex, 2 compound / 4 iso ===
  1. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  2. Lat Pulldown — 3x8-12 (vertical_pull, compound)
  3. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  4. Front Raise — 3x12-15 (shoulder_iso, iso)
  5. Preacher Curl — 4x12-15 (biceps_iso, iso)
  6. Dumbbell Shrug — 3x12-15 (back_iso, iso)

=== Fri — legs (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 4x12-15 (hamstring_iso, iso)
  4. Abduction Machine — 3x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 9 · upper_back 9 · front_delts 9 · side_delts 8/8 (100%) · rear_delts 6/6 (100%) · biceps 8/8 (100%) · triceps 8/8 (100%) · quads 12/10 (120%) · hamstrings 8/8 (100%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): chest 90% ===
```

## 8. 6-day PPL x2, advanced, bodybuilding, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Advanced
Goal:             Build Muscle
Days:             Mon, Tue, Wed, Thu, Fri, Sat (6 days)
Session length:   45–60 min
Split / style:    Push / Pull / Legs ×2 (ppl-x2-6)
Training style:   Bodybuilding
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — push A — 6 ex, 3 compound / 3 iso ===
  1. Barbell Overhead Press — 4x8-12 (vertical_push, compound)
  2. Incline Barbell Press — 4x8-12 (horizontal_push, compound)
  3. Incline Dumbbell Press — 4x8-12 (horizontal_push, compound)
  4. Chest Fly — 4x15-20 (chest_iso, iso)
  5. Upright Row — 4x15-20 (shoulder_iso, iso)
  6. Tricep Pushdown — 4x15-20 (triceps_iso, iso)

=== Tue — pull A — 6 ex, 3 compound / 3 iso ===
  1. Pull-Up — 4x8-12 (vertical_pull, compound)
  2. Chest-Supported Row — 4x8-12 (horizontal_pull, compound)
  3. Seated Cable Row — 4x8-12 (horizontal_pull, compound)
  4. Dumbbell Shrug — 4x15-20 (back_iso, iso)
  5. Front Raise — 4x15-20 (shoulder_iso, iso)
  6. Dumbbell Bicep Curl — 4x15-20 (biceps_iso, iso)

=== Wed — legs A (Lower (Quads)) — 6 ex, 3 compound / 3 iso ===
  1. Hack Squat — 4x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 4x8-12 (lunge, compound)
  4. Leg Extension — 4x15-20 (quad_iso, iso)
  5. Seated Calf Raise — 4x15-20 (calf, iso)
  6. Cable Crunch — 4x15-20 (core, iso)

=== Thu — push B — 7 ex, 2 compound / 5 iso ===
  1. Dumbbell Overhead Press — 4x8-12 (vertical_push, compound)
  2. Dumbbell Bench Press — 4x8-12 (horizontal_push, compound)
  3. Dumbbell Reverse Fly — 4x15-20 (shoulder_iso, iso)
  4. Cable Fly — 4x15-20 (chest_iso, iso)
  5. Dumbbell Tricep Overhead Extension — 4x15-20 (triceps_iso, iso)
  6. Skull Crusher — 4x15-20 (triceps_iso, iso)
  7. Dumbbell Lateral Raise — 4x15-20 (shoulder_iso, iso)

=== Fri — pull B — 7 ex, 2 compound / 5 iso ===
  1. Lat Pulldown — 4x8-12 (vertical_pull, compound)
  2. Dumbbell Single-Arm Row — 4x8-12 (horizontal_pull, compound)
  3. Dumbbell Pullover — 4x15-20 (back_iso, iso)
  4. Dumbbell Hammer Curl — 4x15-20 (biceps_iso, iso)
  5. Arnold Press — 4x15-20 (shoulder_iso, iso)
  6. Straight-Arm Pulldown — 4x15-20 (back_iso, iso)
  7. Face Pull — 4x15-20 (shoulder_iso, iso)

=== Sat — legs B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 4x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 4x10-15 (lunge, compound)
  3. Leg Curl — 4x15-20 (hamstring_iso, iso)
  4. Abduction Machine — 4x15-20 (glute_iso, iso)
  5. Smith Machine Calf Raise — 4x15-20 (calf, iso)
  6. Plank — 4x15-20 (core, iso)

=== warnings: over_time ===

=== weekly muscle volume (direct sets · target) ===
  chest 20/10 (200%) · lats 16 · upper_back 16 · front_delts 16 · side_delts 8/8 (100%) · rear_delts 8/6 (133%) · biceps 8/8 (100%) · triceps 12/8 (150%) · quads 16/10 (160%) · hamstrings 8/8 (100%) · glutes 8/8 (100%) · calves 8 · core 8
=== potential gaps (worst first): (none) ===
```

## 9. 3-day Upper / Lower / Full, intermediate, build muscle, STRENGTH, full gym, 60 min, consistent variety

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Wed, Fri (3 days)
Session length:   45–60 min
Split / style:    Upper / Lower / Full Body (ulf-3)
Training style:   Strength
Variety:          Consistent
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — upper — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 4x3-6 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x3-6 (vertical_push, compound)
  3. Barbell Row — 3x3-6 (horizontal_pull, compound)
  4. Pull-Up — 3x3-6 (vertical_pull, compound)
  5. Upright Row — 6x10-15 (shoulder_iso, iso)
  6. Cable Curl — 6x10-15 (biceps_iso, iso)
  7. Tricep Pushdown — 6x10-15 (triceps_iso, iso)

=== Wed — lower — 6 ex, 3 compound / 3 iso ===
  1. Barbell Squat — 4x3-6 (squat, compound)
  2. Romanian Deadlift — 3x3-6 (hinge, compound)
  3. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  4. Cable Kickback — 6x10-15 (glute_iso, iso)
  5. Dumbbell Calf Raise — 3x10-15 (calf, iso)
  6. Crunch — 3x10-15 (core, iso)

=== Fri — full_body — 6 ex, 5 compound / 1 iso ===
  1. Leg Press — 4x3-6 (squat, compound)
  2. Incline Barbell Press — 3x3-6 (horizontal_push, compound)
  3. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  4. T-Bar Row — 3x3-6 (horizontal_pull, compound)
  5. Dumbbell Overhead Press — 3x3-6 (vertical_push, compound)
  6. Dumbbell Reverse Fly — 4x10-15 (shoulder_iso, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 7/10 (70%) · lats 3 · upper_back 6 · front_delts 6 · side_delts 6/8 (75%) · rear_delts 4/6 (67%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 11/10 (110%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 3 · core 3
=== potential gaps (worst first): chest 70%, back 75%, glutes 75%, hamstrings 75%, side_delts 75% ===
```

## 10. 4-day Upper / Lower, DUMBBELL ONLY (no bench), intermediate, lose fat, 30 min

```

Equipment:        Dumbbells
Experience:       Intermediate
Goal:             Lose Fat
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   ~30 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — upper A — 5 ex, 3 compound / 2 iso ===
  1. Dumbbell Overhead Press — 3x10-15 (vertical_push, compound)  [superset ss-1]
  2. Dumbbell Bent-Over Row — 3x10-15 (horizontal_pull, compound)  [superset ss-1]
  3. Push-Up — 6x10-15 (horizontal_push, compound)  [superset ss-2]
  4. Dumbbell Shrug — 3x15-20 (back_iso, iso)  [superset ss-2]
  5. Rear Delt Fly — 6x15-20 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 4 ex, 2 compound / 2 iso ===
  1. Dumbbell Goblet Squat — 3x10-15 (squat, compound)
  2. Walking Lunge — 3x10-15 (lunge, compound)
  3. Dumbbell Calf Raise — 3x15-20 (calf, iso)
  4. Crunch — 3x15-20 (core, iso)

=== Thu — upper B — 5 ex, 2 compound / 3 iso ===
  1. Dumbbell Single-Arm Row — 3x10-15 (horizontal_pull, compound)  [superset ss-3]
  2. Dumbbell Push Press — 3x3-5 (vertical_push, compound)  [superset ss-3]
  3. Upright Row — 6x15-20 (shoulder_iso, iso)  [superset ss-4]
  4. Dumbbell Curl — 6x15-20 (biceps_iso, iso)  [superset ss-4]
  5. Dumbbell Tricep Overhead Extension — 6x15-20 (triceps_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 4 ex, 1 compound / 3 iso ===
  1. Dumbbell Romanian Deadlift — 6x10-15 (hinge, compound)
  2. Single-Leg Glute Bridge — 6x15-20 (glute_iso, iso)
  3. Single-Leg Calf Raise — 3x15-20 (calf, iso)
  4. Plank — 3x15-20 (core, iso)

=== warnings: limited_variety, over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 6/10 (60%) · lats 0 · upper_back 9 · front_delts 6 · side_delts 6/8 (75%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 6/10 (60%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 6 · core 6
=== potential gaps (worst first): chest 60%, quads 60%, back 75%, glutes 75%, hamstrings 75%, side_delts 75% ===
```

## 11. 2-day Full Body, beginner, general fitness, full gym, 45 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Beginner
Goal:             General Fitness
Days:             Mon, Thu (2 days)
Session length:   45–60 min
Split / style:    Full Body (fb-2)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — full_body A — 6 ex, 5 compound / 1 iso ===
  1. Barbell Squat — 4x5-8 (squat, compound)
  2. Barbell Bench Press — 3x5-8 (horizontal_push, compound)
  3. Romanian Deadlift — 6x5-8 (hinge, compound)
  4. Barbell Overhead Press — 3x5-8 (vertical_push, compound)
  5. Barbell Row — 3x5-8 (horizontal_pull, compound)
  6. Face Pull — 4x10-15 (shoulder_iso, iso)

=== Thu — full_body B — 6 ex, 4 compound / 2 iso ===
  1. Hip Thrust — 6x10-15 (hinge, compound)
  2. Incline Barbell Press — 3x8-12 (horizontal_push, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  5. Upright Row — 6x12-15 (shoulder_iso, iso)
  6. Cable Curl — 6x12-15 (biceps_iso, iso)

=== warnings: over_time, push_pull_imbalance, no_vertical_pull, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 6/10 (60%) · lats 0 · upper_back 6 · front_delts 3 · side_delts 6/8 (75%) · rear_delts 4/6 (67%) · biceps 6/8 (75%) · triceps 0/8 (0%) · quads 7/10 (70%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 0 · core 0
=== potential gaps (worst first): triceps 0%, back 50%, chest 60%, quads 70%, glutes 75%, hamstrings 75%, side_delts 75% ===
```

## 12. 4-day Upper / Lower, KNEE restriction, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Restrictions:     Knee
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Barbell Row — 3x8-12 (horizontal_pull, compound)
  4. Pull-Up — 3x8-12 (vertical_pull, compound)
  5. Chest Fly — 3x12-15 (chest_iso, iso)
  6. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  7. Face Pull — 6x12-15 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 6 ex, 2 compound / 4 iso ===
  1. Leg Press — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 3x8-12 (hinge, compound)
  3. Cable Kickback — 3x12-15 (glute_iso, iso)
  4. Abduction Machine — 3x12-15 (glute_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  2. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Upright Row — 6x12-15 (shoulder_iso, iso)
  4. Cable Curl — 6x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 1 compound / 5 iso ===
  1. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  2. Dumbbell Leg Curl (Lying) — 3x12-15 (hamstring_iso, iso)
  3. Single-Leg Glute Bridge — 3x12-15 (glute_iso, iso)
  4. Leg Curl — 3x12-15 (hamstring_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: limited_variety, over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 6 · upper_back 6 · front_delts 6 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 3/10 (30%) · hamstrings 12/8 (150%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): quads 30%, chest 90% ===
```

## 13. 4-day Upper / Lower, LOWER-BACK restriction, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Restrictions:     Lower Back
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Pull-Up — 3x8-12 (vertical_pull, compound)
  4. Chest-Supported Row — 3x8-12 (horizontal_pull, compound)
  5. Chest Fly — 3x12-15 (chest_iso, iso)
  6. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  7. Face Pull — 6x12-15 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Hip Thrust — 3x10-15 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Leg Curl — 4x12-15 (hamstring_iso, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  2. Seated Cable Row — 3x8-12 (horizontal_pull, compound)
  3. Upright Row — 6x12-15 (shoulder_iso, iso)
  4. Cable Curl — 6x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 4x12-15 (hamstring_iso, iso)
  4. Abduction Machine — 3x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 6 · upper_back 6 · front_delts 6 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 12/10 (120%) · hamstrings 8/8 (100%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): chest 90% ===
```

## 14. 4-day Upper / Lower, SHOULDER restriction, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Restrictions:     Shoulder
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Row — 3x8-12 (horizontal_pull, compound)
  3. Pull-Up — 3x8-12 (vertical_pull, compound)
  4. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  5. Chest Fly — 3x12-15 (chest_iso, iso)
  6. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  7. Face Pull — 6x12-15 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Cable Kickback — 3x12-15 (glute_iso, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  2. Machine Shoulder Press — 3x8-12 (vertical_push, compound)
  3. Lateral Raise — 6x12-15 (shoulder_iso, iso)
  4. Cable Curl — 6x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Hip Thrust — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 4x12-15 (hamstring_iso, iso)
  4. Abduction Machine — 3x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 6 · upper_back 6 · front_delts 6 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 12/10 (120%) · hamstrings 8/8 (100%) · glutes 9/8 (113%) · calves 6 · core 6
=== potential gaps (worst first): chest 90% ===
```

## 15. 4-day Full Body (Heavy/Med/Power/Hyp), machines + cables, intermediate, bodybuilding, 60 min, machine lean

```

Equipment:        Machines, Cables, Bench
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Full Body - Heavy / Medium / Heavy / Pump (fb-hmhp-4)
Training style:   Bodybuilding
Variety:          Varied
Priority muscle:  Balanced
Loading lean:     Machine
Catalog:          94 exercises

=== Mon — full_body A — 7 ex, 4 compound / 3 iso ===
  1. Hack Squat — 3x8-12 (squat, compound)
  2. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  3. Machine Shoulder Press — 3x8-12 (vertical_push, compound)
  4. Machine Chest Press — 3x8-12 (horizontal_push, compound)
  5. Cable Curl — 3x15-20 (biceps_iso, iso)
  6. Cable Crunch — 3x15-20 (core, iso)
  7. Leg Curl — 6x15-20 (hamstring_iso, iso)

=== Tue — full_body B — 7 ex, 4 compound / 3 iso ===
  1. Leg Press — 3x8-12 (squat, compound)
  2. Machine Shoulder Press — 3x8-12 (vertical_push, compound)
  3. Seated Cable Row — 3x8-12 (horizontal_pull, compound)
  4. Smith Machine Bench Press — 3x8-12 (horizontal_push, compound)
  5. Face Pull — 3x15-20 (shoulder_iso, iso)
  6. Plank — 3x15-20 (core, iso)
  7. Cable Kickback — 3x15-20 (glute_iso, iso)

=== Thu — full_body C — 7 ex, 3 compound / 4 iso ===
  1. Step-Up — 3x8-12 (lunge, compound)
  2. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  3. Dips — 3x8-12 (horizontal_push, compound)
  4. Face Pull — 3x15-20 (shoulder_iso, iso)
  5. Tricep Pushdown — 4x15-20 (triceps_iso, iso)
  6. Cable Curl — 3x15-20 (biceps_iso, iso)
  7. Single-Leg Glute Bridge — 3x15-20 (glute_iso, iso)

=== Fri — full_body D — 7 ex, 3 compound / 4 iso ===
  1. Walking Lunge — 3x12-15 (lunge, compound)
  2. T-Bar Row — 3x12-15 (horizontal_pull, compound)
  3. Push-Up — 3x12-15 (horizontal_push, compound)
  4. Face Pull — 3x15-20 (shoulder_iso, iso)
  5. Cable Curl — 3x15-20 (biceps_iso, iso)
  6. Single-Arm Tricep Pushdown — 4x15-20 (triceps_iso, iso)
  7. Abduction Machine — 3x15-20 (glute_iso, iso)

=== warnings: no_vertical_pull, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 12/10 (120%) · lats 0 · upper_back 12 · front_delts 6 · side_delts 0/8 (0%) · rear_delts 9/6 (150%) · biceps 9/8 (113%) · triceps 8/8 (100%) · quads 12/10 (120%) · hamstrings 6/8 (75%) · glutes 9/8 (113%) · calves 0 · core 6
=== potential gaps (worst first): side_delts 0%, hamstrings 75% ===
```

## 16. 3-day PPL, barbell + bench + pull-up bar, advanced, powerbuilding, 60 min, barbell lean

```

Equipment:        Barbell, Bench, Pull-Up Bar
Experience:       Advanced
Goal:             Build Muscle
Days:             Mon, Wed, Fri (3 days)
Session length:   45–60 min
Split / style:    Push / Pull / Legs (ppl-3)
Training style:   Powerbuilding
Variety:          Varied
Priority muscle:  Balanced
Loading lean:     Barbell
Catalog:          94 exercises

=== Mon — push — 5 ex, 3 compound / 2 iso ===
  1. Barbell Bench Press — 5x3-6 (horizontal_push, compound)
  2. Barbell Overhead Press — 4x3-6 (vertical_push, compound)
  3. Incline Barbell Press — 4x3-6 (horizontal_push, compound)
  4. JM Press — 4x12-15 (triceps_iso, iso)
  5. Diamond / Close-Grip Push-Up — 4x12-15 (triceps_iso, iso)

=== Wed — pull — 5 ex, 3 compound / 2 iso ===
  1. Barbell Row — 5x3-6 (horizontal_pull, compound)
  2. Pull-Up — 4x3-6 (vertical_pull, compound)
  3. Chin-Up — 4x3-6 (vertical_pull, compound)
  4. Barbell Curl — 4x12-15 (biceps_iso, iso)
  5. EZ-Bar Curl — 4x12-15 (biceps_iso, iso)

=== Fri — legs — 6 ex, 3 compound / 3 iso ===
  1. Barbell Squat — 5x3-6 (squat, compound)
  2. Romanian Deadlift — 6x3-6 (hinge, compound)
  3. Step-Up — 4x8-12 (lunge, compound)
  4. Single-Leg Glute Bridge — 6x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 4x12-15 (calf, iso)
  6. Crunch — 4x12-15 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 8 · upper_back 5 · front_delts 4 · side_delts 0/8 (0%) · rear_delts 0/6 (0%) · biceps 8/8 (100%) · triceps 8/8 (100%) · quads 9/10 (90%) · hamstrings 6/8 (75%) · glutes 6/8 (75%) · calves 4 · core 4
=== potential gaps (worst first): rear_delts 0%, side_delts 0%, glutes 75%, hamstrings 75%, chest 90%, quads 90% ===
```

## 17. 5-day Full Body / Upper-Lower hybrid, intermediate, build muscle, full gym, 60 min

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Wed, Thu, Fri (5 days)
Session length:   45–60 min
Split / style:    Full Body + Upper / Lower Hybrid (fb-ul-hybrid-5)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Catalog:          94 exercises

=== Mon — full_body — 7 ex, 5 compound / 2 iso ===
  1. Barbell Squat — 4x6-8 (squat, compound)
  2. Barbell Bench Press — 3x6-8 (horizontal_push, compound)
  3. Romanian Deadlift — 3x6-8 (hinge, compound)
  4. Barbell Overhead Press — 3x6-8 (vertical_push, compound)
  5. Barbell Row — 3x6-8 (horizontal_pull, compound)
  6. Cable Curl — 4x10-15 (biceps_iso, iso)
  7. Face Pull — 6x10-15 (shoulder_iso, iso)

=== Tue — upper A — 7 ex, 4 compound / 3 iso ===
  1. Pull-Up — 3x8-12 (vertical_pull, compound)
  2. Incline Barbell Press — 3x8-12 (horizontal_push, compound)
  3. T-Bar Row — 3x8-12 (horizontal_pull, compound)
  4. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  5. Chest Fly — 3x12-15 (chest_iso, iso)
  6. Straight-Arm Pulldown — 3x12-15 (back_iso, iso)
  7. Dumbbell Lateral Raise — 4x12-15 (shoulder_iso, iso)

=== Wed — lower A (Lower (Quads)) — 6 ex, 3 compound / 3 iso ===
  1. Leg Press — 3x8-12 (squat, compound)
  2. Hip Thrust — 4x10-15 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. Dumbbell Bent-Over Row — 3x8-12 (horizontal_pull, compound)
  2. Machine Shoulder Press — 3x8-12 (vertical_push, compound)
  3. Upright Row — 4x12-15 (shoulder_iso, iso)
  4. Preacher Curl — 4x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Tricep Overhead Extension — 3x12-15 (triceps_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Dumbbell Romanian Deadlift — 3x10-15 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 3x12-15 (hamstring_iso, iso)
  4. Abduction Machine — 4x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: over_time ===

=== weekly muscle volume (direct sets · target) ===
  chest 12/10 (120%) · lats 6 · upper_back 9 · front_delts 9 · side_delts 8/8 (100%) · rear_delts 6/6 (100%) · biceps 8/8 (100%) · triceps 9/8 (113%) · quads 16/10 (160%) · hamstrings 9/8 (113%) · glutes 8/8 (100%) · calves 6 · core 6
=== potential gaps (worst first): (none) ===
```

## 18. 4-day Upper / Lower, intermediate, build muscle, full gym, 60 min, priority BACK, consistent variety (recomp profile)

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Classic Upper / Lower (ul-classic-4)
Training style:   Balanced
Variety:          Consistent
Priority muscle:  Back
Catalog:          94 exercises

=== Mon — upper A — 7 ex, 4 compound / 3 iso ===
  1. Barbell Bench Press — 3x8-12 (horizontal_push, compound)
  2. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  3. Barbell Row — 4x8-12 (horizontal_pull, compound)
  4. Pull-Up — 3x8-12 (vertical_pull, compound)
  5. Straight-Arm Pulldown — 4x12-15 (back_iso, iso)
  6. Chest Fly — 3x12-15 (chest_iso, iso)
  7. Face Pull — 6x12-15 (shoulder_iso, iso)

=== Tue — lower A (Lower (Quads)) — 7 ex, 3 compound / 4 iso ===
  1. Barbell Squat — 3x8-12 (squat, compound)
  2. Romanian Deadlift — 3x8-12 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Leg Extension — 3x12-15 (quad_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Single-Leg Glute Bridge — 4x12-15 (glute_iso, iso)

=== Thu — upper B — 7 ex, 2 compound / 5 iso ===
  1. Barbell Overhead Press — 3x8-12 (vertical_push, compound)
  2. Barbell Row — 4x8-12 (horizontal_pull, compound)
  3. Upright Row — 6x12-15 (shoulder_iso, iso)
  4. Cable Curl — 6x12-15 (biceps_iso, iso)
  5. Tricep Pushdown — 6x12-15 (triceps_iso, iso)
  6. Cable Fly — 3x12-15 (chest_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Fri — lower B (Lower (Hamstrings & Glutes)) — 6 ex, 2 compound / 4 iso ===
  1. Romanian Deadlift — 3x8-12 (hinge, compound)
  2. Dumbbell Bulgarian Split Squat — 3x10-15 (lunge, compound)
  3. Dumbbell Leg Curl (Lying) — 3x12-15 (hamstring_iso, iso)
  4. Cable Kickback — 4x12-15 (glute_iso, iso)
  5. Single-Leg Calf Raise — 3x12-15 (calf, iso)
  6. Plank — 3x12-15 (core, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 7 · upper_back 8 · front_delts 6 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 6/8 (75%) · triceps 6/8 (75%) · quads 12/10 (120%) · hamstrings 9/8 (113%) · glutes 8/8 (100%) · calves 6 · core 6
=== potential gaps (worst first): chest 90% ===
```

## 19. 4-day PPL + Full Body, dumbbell + bench + pull-up bar, WRIST restriction, intermediate, build muscle, 45 min

```

Equipment:        Dumbbells, Bench, Pull-Up Bar
Experience:       Intermediate
Goal:             Build Muscle
Days:             Mon, Tue, Thu, Fri (4 days)
Session length:   45–60 min
Split / style:    Push / Pull / Legs + Full Body (ppl-fb-4)
Training style:   Balanced
Variety:          Varied
Priority muscle:  Balanced
Restrictions:     Wrist
Catalog:          94 exercises

=== Mon — push — 7 ex, 2 compound / 5 iso ===
  1. Dumbbell Overhead Press — 3x8-12 (vertical_push, compound)
  2. Dumbbell Bench Press — 3x8-12 (horizontal_push, compound)
  3. Chest Fly — 3x12-15 (chest_iso, iso)
  4. Upright Row — 6x12-15 (shoulder_iso, iso)
  5. Dumbbell Tricep Overhead Extension — 4x12-15 (triceps_iso, iso)
  6. Skull Crusher — 4x12-15 (triceps_iso, iso)
  7. Dumbbell Lateral Raise — 3x12-15 (shoulder_iso, iso)

=== Tue — pull — 7 ex, 2 compound / 5 iso ===
  1. Pull-Up — 3x8-12 (vertical_pull, compound)
  2. Dumbbell Bent-Over Row — 3x8-12 (horizontal_pull, compound)
  3. Dumbbell Shrug — 3x12-15 (back_iso, iso)
  4. Front Raise — 3x12-15 (shoulder_iso, iso)
  5. Preacher Curl — 6x12-15 (biceps_iso, iso)
  6. Dumbbell Pullover — 3x12-15 (back_iso, iso)
  7. Incline Dumbbell Curl — 3x12-15 (biceps_iso, iso)

=== Thu — legs — 7 ex, 3 compound / 4 iso ===
  1. Dumbbell Goblet Squat — 3x10-15 (squat, compound)
  2. Dumbbell Romanian Deadlift — 6x10-15 (hinge, compound)
  3. Step-Up — 3x8-12 (lunge, compound)
  4. Single-Leg Glute Bridge — 4x12-15 (glute_iso, iso)
  5. Dumbbell Calf Raise — 3x12-15 (calf, iso)
  6. Crunch — 3x12-15 (core, iso)
  7. Dumbbell Leg Curl (Lying) — 3x12-15 (hamstring_iso, iso)

=== Fri — full_body — 6 ex, 5 compound / 1 iso ===
  1. Dumbbell Sumo Squat — 3x10-15 (squat, compound)
  2. Incline Dumbbell Press — 3x8-12 (horizontal_push, compound)
  3. Hip Thrust — 4x10-15 (hinge, compound)
  4. Chest-Supported Row — 3x8-12 (horizontal_pull, compound)
  5. Dumbbell Push Press — 3x3-5 (vertical_push, compound)
  6. Dumbbell Reverse Fly — 6x10-15 (shoulder_iso, iso)

=== warnings: over_time, muscle_coverage_low ===

=== weekly muscle volume (direct sets · target) ===
  chest 9/10 (90%) · lats 6 · upper_back 9 · front_delts 9 · side_delts 9/8 (113%) · rear_delts 6/6 (100%) · biceps 9/8 (113%) · triceps 8/8 (100%) · quads 9/10 (90%) · hamstrings 9/8 (113%) · glutes 8/8 (100%) · calves 3 · core 3
=== potential gaps (worst first): chest 90%, quads 90% ===
```

## 20. 5-day PPL + Upper / Lower, advanced, bodybuilding, full gym, 60 min, priority ARMS

```

Equipment:        Dumbbells, Barbell, Bench, Cables, Machines, Pull-Up Bar
Experience:       Advanced
Goal:             Build Muscle
Days:             Mon, Tue, Wed, Thu, Fri (5 days)
Session length:   45–60 min
Split / style:    Push / Pull / Legs + Upper / Lower (pplul-5)
Training style:   Bodybuilding
Variety:          Varied
Priority muscle:  Arms
Catalog:          94 exercises

=== Mon — push — 7 ex, 2 compound / 5 iso ===
  1. Barbell Overhead Press — 4x8-12 (vertical_push, compound)
  2. Incline Dumbbell Press — 4x8-12 (horizontal_push, compound)
  3. Tricep Pushdown — 4x15-20 (triceps_iso, iso)
  4. Chest Fly — 4x15-20 (chest_iso, iso)
  5. Upright Row — 8x15-20 (shoulder_iso, iso)
  6. Dumbbell Tricep Overhead Extension — 4x15-20 (triceps_iso, iso)
  7. Face Pull — 4x15-20 (shoulder_iso, iso)

=== Tue — pull — 7 ex, 2 compound / 5 iso ===
  1. Pull-Up — 4x8-12 (vertical_pull, compound)
  2. Seated Cable Row — 4x8-12 (horizontal_pull, compound)
  3. Dumbbell Bicep Curl — 4x15-20 (biceps_iso, iso)
  4. Dumbbell Shrug — 4x15-20 (back_iso, iso)
  5. Front Raise — 4x15-20 (shoulder_iso, iso)
  6. Dumbbell Pullover — 4x15-20 (back_iso, iso)
  7. Rear Delt Fly — 4x15-20 (shoulder_iso, iso)

=== Wed — legs — 6 ex, 3 compound / 3 iso ===
  1. Hack Squat — 4x8-12 (squat, compound)
  2. Romanian Deadlift — 4x8-12 (hinge, compound)
  3. Step-Up — 4x8-12 (lunge, compound)
  4. Cable Kickback — 4x15-20 (glute_iso, iso)
  5. Seated Calf Raise — 4x15-20 (calf, iso)
  6. Cable Crunch — 4x15-20 (core, iso)

=== Thu — upper — 6 ex, 4 compound / 2 iso ===
  1. Incline Barbell Press — 4x8-12 (horizontal_push, compound)
  2. Dumbbell Overhead Press — 4x8-12 (vertical_push, compound)
  3. Lat Pulldown — 4x8-12 (vertical_pull, compound)
  4. Chest-Supported Row — 4x8-12 (horizontal_pull, compound)
  5. Dumbbell Hammer Curl — 4x15-20 (biceps_iso, iso)
  6. Skull Crusher — 4x15-20 (triceps_iso, iso)

=== Fri — lower — 6 ex, 3 compound / 3 iso ===
  1. Leg Press — 4x8-12 (squat, compound)
  2. Dumbbell Romanian Deadlift — 4x10-15 (hinge, compound)
  3. Dumbbell Bulgarian Split Squat — 4x10-15 (lunge, compound)
  4. Abduction Machine — 4x15-20 (glute_iso, iso)
  5. Smith Machine Calf Raise — 4x15-20 (calf, iso)
  6. Plank — 4x15-20 (core, iso)

=== warnings: over_time ===

=== weekly muscle volume (direct sets · target) ===
  chest 12/10 (120%) · lats 12 · upper_back 12 · front_delts 12 · side_delts 8/8 (100%) · rear_delts 8/6 (133%) · biceps 8/8 (100%) · triceps 12/8 (150%) · quads 16/10 (160%) · hamstrings 8/8 (100%) · glutes 8/8 (100%) · calves 8 · core 8
=== potential gaps (worst first): (none) ===
```
