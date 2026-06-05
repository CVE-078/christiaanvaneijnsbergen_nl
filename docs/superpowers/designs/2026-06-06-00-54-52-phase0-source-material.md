# Generation Phase 0 — source material & reconciliation (2026-06-06)

Domain content produced by ChatGPT (research-consensus, not Pulse-specific) to seed the generation Phase 0 work: the MovementPattern to muscle bridge, exercise metadata, contraindications, volume landmarks, training-style definitions, strength standards, and adaptation copy. **The raw draft uses a generic vocabulary that does not match Pulse's actual types**, so the first section reconciles it. Treat the draft as a starting point, not a spec.

---

## Reconciliation to Pulse's real vocabulary (read this first)

**Pulse's 15 movement patterns:** `horizontal_push, vertical_push, horizontal_pull, vertical_pull, squat, hinge, lunge, calf, core, chest_iso, back_iso, shoulder_iso, biceps_iso, triceps_iso, glute_iso`.

**Pulse's 10 volume categories:** `chest, shoulders, triceps, back, biceps, legs, glutes, calves, abs, other`.

### The bridge job is smaller than the draft implies

The draft maps 15 generic patterns. Mapped onto Pulse's real patterns:

- **7 compounds map 1:1** and are the *only* rows where secondary-muscle attribution matters: `horizontal_push, vertical_push, horizontal_pull, vertical_pull, squat, hinge, lunge`. Use the draft's weights for these (collapsed to the 10 categories, below).
- **6 isolation patterns are already muscle-specific in Pulse** (`chest_iso, back_iso, shoulder_iso, biceps_iso, triceps_iso, glute_iso`), so their attribution is near 1:1 (e.g. `biceps_iso` to biceps ~0.9 / forearms 0.1; `glute_iso` to glutes ~0.85 / hamstrings 0.15). Pulse's pattern granularity already did this work. The draft's `isolation_push` / `isolation_pull` lumping is *coarser* than Pulse and should be discarded in favor of the per-muscle patterns.
- **`calf` to calves ~1.0; `core` to abs ~1.0** (the draft's `core_flexion` / `core_stability` / `rotation` collapse into Pulse's single `core`).
- **Drop entirely:** `carry`, `rotation`, `glute_dominant` (use `glute_iso`). Pulse has no carry or rotation pattern.

### Muscle names collapse to the 10 categories

`upper_chest` to chest; `front_delts` / `rear_delts` to shoulders; `lats` / `mid_back` / `traps` / `lower_back` to back; `forearms` / `grip` to biceps (or `other`); `quads` / `hamstrings` / `adductors` / `hip_flexors` to legs; `obliques` to abs; `stabilizers` to other.

### The one Phase 0 decision this surfaces: muscle granularity

The draft (and the MEV/MAV/MRV landmarks) assume finer muscles than Pulse models: it splits `quads` vs `hamstrings` and `front` vs `rear delts`; Pulse has only `legs` and `shoulders`. Two options:

- **(A, recommended) Keep the 10-category taxonomy, collapse the map into it.** No churn to `VOLUME_TARGETS`, `computePerMuscleVolume`, `MuscleVolumeBars`, recovery, the `exercises.category` CHECK, or seeds. Loses quad/ham precision. **Collapse only the muscle target side of the bridge: the 15 movement patterns remain the generation control layer and never merge with the 10 reporting categories** (see the three-layer rule in the roadmap's Product decisions).
- **(B) Expand the taxonomy** (add quads, hamstrings, front/rear delts, lower_back). Ripples through the entire analytics + generation surface. Defer unless specialization genuinely needs it.

Start with A.

---

## 1. MovementPattern to muscle map (draft, weights ~sum 1.0)

Use the 7 compound rows; collapse muscle names to the 10 categories. Isolation/calf/core handled per "bridge job" above.

```
horizontal_push:  chest 0.65, front_delts 0.20, triceps 0.15
vertical_push:    shoulders 0.55, triceps 0.30, upper_chest 0.15
horizontal_pull:  lats 0.40, mid_back 0.35, biceps 0.15, rear_delts 0.10
vertical_pull:    lats 0.60, biceps 0.25, rear_delts 0.15
squat:            quads 0.55, glutes 0.30, adductors 0.10, core 0.05
hinge:            hamstrings 0.45, glutes 0.40, lower_back 0.15
lunge:            quads 0.40, glutes 0.40, hamstrings 0.15, adductors 0.05
```
(Draft also gave glute_dominant, calves, core_flexion/stability, rotation, isolation_push/pull, carry — superseded by Pulse's own iso/calf/core patterns; see reconciliation.)

## 2. Exercise metadata format (draft, ~10 of 94 shown)

Proposed per-exercise fields beyond what exists today: `primary`, `secondary[]`, `unilateral`, `fatigue` (1-5), `difficulty`, plus ChatGPT's suggested `joint_stress` (low/med/high) for injury logic. (`movement_pattern` and `equipment` already exist on `exercises`.)

```
Bench Press:            primary chest;     secondary [triceps, front_delts]; unilateral false; fatigue 4; difficulty intermediate
Incline DB Press:       primary upper_chest;secondary [triceps, front_delts]; unilateral false; fatigue 3; difficulty beginner
Barbell Squat:          primary quads;     secondary [glutes, lower_back];   unilateral false; fatigue 5; difficulty intermediate
Romanian Deadlift:      primary hamstrings;secondary [glutes, lower_back];   unilateral false; fatigue 5; difficulty intermediate
Pull-Up:                primary lats;      secondary [biceps, rear_delts];   unilateral false; fatigue 4; difficulty intermediate
Lat Pulldown:           primary lats;      secondary [biceps];               unilateral false; fatigue 3; difficulty beginner
Dumbbell Lunge:         primary quads;     secondary [glutes, hamstrings];   unilateral true;  fatigue 3; difficulty beginner
Hip Thrust:             primary glutes;    secondary [hamstrings];           unilateral false; fatigue 3; difficulty beginner
Overhead Press:         primary shoulders; secondary [triceps, upper_chest]; unilateral false; fatigue 4; difficulty intermediate
Cable Fly:              primary chest;     secondary [front_delts];          unilateral false; fatigue 2; difficulty beginner
```
Next step: ask ChatGPT to produce all ~94, then a script maps muscles to the 10 categories and writes a seed migration.

## 3. Contraindication map (for Tier 2 #5 / Phase 1 restrictions)

```
knee:        avoid heavy squat, deep lunge, deep leg press → sub hinge, glute bridge, leg curl, box squat, controlled step-ups
lower_back:  avoid heavy deadlift/RDL, good mornings, heavy carries → sub hip thrust, leg curl, upright split squat, machine lower body
shoulder:    avoid overhead press, deep dips, upright row → sub neutral-grip incline, machine press, light lateral raise, cable press
wrist:       avoid front-rack squat, straight-bar heavy press, push-ups → sub dumbbells (neutral grip), machines, straps for pulls
```
Maps onto Pulse as a pool filter by `movement_pattern` (plus `joint_stress` once added), the same mechanism as `hasEquipment`.

## 4. Volume landmarks MEV / MAV / MRV (weekly sets, hypertrophy literature)

```
chest      MEV 8  MAV 12-18  MRV 20+
back       MEV 10 MAV 14-22  MRV 26+
quads      MEV 8  MAV 12-20  MRV 24+
hamstrings MEV 6  MAV 10-16  MRV 20+
glutes     MEV 8  MAV 14-24  MRV 30+
shoulders  MEV 8  MAV 12-20  MRV 26+
biceps/tri MEV 6  MAV 10-16  MRV 20+
calves     MEV 6  MAV 10-18  MRV 24+
```
**vs Pulse's current `VOLUME_TARGETS`** (`chest 12-18, back 12-18, legs 12-18, shoulders 10-16, glutes 10-16, biceps 8-14, triceps 8-14, calves 8-14, abs 6-12`): the draft's MAV runs higher for back, glutes, and shoulders. Worth a deliberate tune of `VOLUME_TARGETS` (collapse quads+hamstrings into `legs`), not a blind overwrite. Implication: beginners aim MEV to low-MAV, intermediates MAV, advanced toward MRV selectively.

## 5. Training-style definitions (for Phase 1 training style to `bias`)

```
strength:      3-6 reps compounds, long rest, low volume/high intensity, barbell bias  → bias 'strength'
bodybuilding:  6-15 reps, moderate rest, high volume, isolation+machines               → bias 'hypertrophy'
powerbuilding: compounds in strength range + accessories in hypertrophy range          → hybrid (strength compound bump + hypertrophy iso)
general:       8-15 reps, balanced patterns, moderate volume, higher variety/lower fatigue → bias 'balanced'
```

## 6. Strength standards sanity check (bodyweight multiples, men; women ~ -10-20%)

```
bench:    beg 0.5  int 0.75-1.0  adv 1.25  elite 1.75+
squat:    beg 0.75 int 1.25      adv 1.75  elite 2.5+
deadlift: beg 1.0  int 1.5       adv 2.0   elite 2.75+
ohp:      beg 0.35 int 0.6       adv 0.75-1.0 elite 1.25+
```
Action: validate against `STRENGTH_STANDARDS` in `strength.ts`; broadly reasonable for recreational lifters.

## 7. Adaptation copy (directly usable for Phase 2 Coach Timeline + explanations)

Each adaptive action answers what changed / why / what next.

- **Ramp-back:** "You're returning after a break. This week's volume is reduced to help you rebuild consistency and reduce injury risk. Progression resumes next week."
- **Deload:** "Your recent performance plateau suggests accumulated fatigue. Load is reduced to allow recovery while keeping movement quality. Progression resumes once performance stabilizes." (e.g. "Bench: 90kg to 82.5kg, no estimated strength gain in 3 weeks.")
- **Progression success:** "You completed all target reps. Weight increases next session."
- **Why this plan:** "Built from your 4 training days, your equipment (dumbbells + bench), your goal (muscle gain), and your intermediate experience. Trains each muscle twice per week for growth frequency."

## 8. Positioning / monetization (strategy notes, no code)

- Core: "A strength coach that adapts to you, not a static program." Device: "Works anywhere, your program follows you not your device." Home gym: "Built for real setups, dumbbells / machines / full gym, Pulse adapts."
- Market pattern (Hevy/Strong = weak programming; Fitbod = random/opaque): users want "tell me what to do AND adapt it as I improve or fail," not just logging.
- Monetization if public: free = logging + basic routines + basic stats; paid = adaptive programming, progression, ramp-back/deload, full analytics, customization. Indie pricing ~EUR 5-10/mo or 40-70/yr. Do not put logging behind a paywall, no ads, no social-feed monetization.

---

## 9. DecisionEvent taxonomy (Phase 0 schema content + Phase 2 timeline)

Nine draft event types, each with `type` / `trigger` / `change` / `why` / `next_action`. Reconciled to what Pulse already has:

| type | trigger (draft) | Pulse status |
|---|---|---|
| ramp_back | inactivity > 7-14d, missed > 50% | Shipped (`program_adjustments`, `GAP_DAYS=10`) |
| deload | plateau 2-4 wks, fatigue | Computed (`shouldDeload`/`deloadTarget`) but NOT persisted — the gap to close |
| progression | targets hit, RIR >= target | Shipped logic (`computeProgression`), not logged as an event |
| swap_exercise | override / failure / equipment | Shipped (`exercise_swaps`) |
| volume_bump | adaptation phase, gains | Not present — periodization volume is table-driven (`volumeForWeek`); adaptive bump is Phase 4 |
| block_transition | block week completion | Blocks wrap (`buildProgram`), not logged as an event |
| missed_session | scheduled not logged | Derived (`adherence.ts`), not an event |
| return_from_gap | inactivity > 14d | Same path as ramp_back |
| PR_event | new e1RM | Shipped (`isSetPR`/`computePRMap`), not logged as an event |

The `DecisionEvent` log unifies these through one schema. Ramp-back already persists; the cheap wins are persisting **deload, progression, block_transition, and PR** as events through the same shape. `volume_bump` is aspirational (Phase 4). Each event carries the change + why + next_action copy (see section 7 for the strings).

## 10. Substitution-equivalence classes (for the `substitution_class` metadata field)

```
horizontal_press: bench / DB bench / machine press / push-up
vertical_press:   OHP / DB shoulder press / machine shoulder press
lateral_raise:    cable / DB lateral raise
vertical_pull:    pull-up / lat pulldown
horizontal_pull:  barbell row / cable row / DB row
squat_pattern:    back squat / leg press / goblet squat
hinge_pattern:    deadlift / RDL / good morning
unilateral_leg:   walking lunge / split squat / step-up
glute_pattern:    hip thrust / glute bridge
core_stability:   plank / dead bug
core_flexion:     cable crunch / sit-up
biceps_isolation / triceps_isolation / rear_delt_isolation
```
A swap should stay within the class. Powers smart substitution v2 + the contraindication subs.

## 11. Golden test cases (acceptance oracles for the deterministic engine)

Encode as engine tests so future changes (training style, restrictions, volume-first) can't regress.

1. **4d, DB + bench, female, glute priority, 45-60 min:** 2x lower emphasis; glute ~16-24 sets/wk (higher than Pulse's current glutes target 10-16 — tie to the `VOLUME_TARGETS` tune); hinge + hip thrust dominant; reduced-load squat; unilateral leg work present.
2. **3d beginner male full body:** full-body each session; low volume ~8-12 sets/muscle/wk; machine + dumbbell bias.
3. **Advanced 6d PPL, full gym:** high volume 18-26 sets/muscle/wk; fatigue-managed hinge volume.

## 12. Coaching edge-case rules (mostly align with the completion-paced design)

- **Double sessions in a week:** do NOT auto-double volume; treat the extra as optional accessory work; cap weekly per-muscle at MRV; no forced progression next day.
- **Train out of order:** allow freely; progression is completion-tied, not sequence-tied (already true in `adherence.ts`).
- **Huge PR jump:** validate — a single-session anomaly is ignored, a sustained jump updates the baseline; do not inflate volume off one spike.
- **1 of 3 sessions done:** no penalty, shift the week forward, reduce weekly accumulation (already the adherence behavior).
- **Multi-week miss:** auto ramp_back, reduce volume + intensity, rebuild the baseline (already the `GAP_DAYS` path).

The out-of-order and partial-completion rules already match Pulse's completion-paced engine. The genuinely new rules to add are the **MRV cap on double sessions** and the **PR-spike validation**.

## Metadata reconciliation + next step

The draft metadata schema is confirmed (`primary`, `secondary[]`, `unilateral`, `fatigue` 1-5, `joint_stress`, `difficulty`, `substitution_class`). Two reconciliation points:

- Its `movement_pattern` values (`isolation_push/pull`, `glute_dominant`, `core_stability/flexion`) must remap to Pulse's real 15 (`shoulder_iso`, `biceps_iso`, `triceps_iso`, `back_iso`, `glute_iso`, `core`). **Do NOT take the draft's patterns — every Pulse exercise already has a correct, seeded `movement_pattern`.**
- So the only NEW fields to seed are `secondary_muscles`, `unilateral`, `fatigue`, `joint_stress`, `difficulty`, `substitution_class`. `primary` collapses to the existing `category`; `movement_pattern`, `equipment`, and `is_compound` already exist.
- Next step: extract Pulse's actual ~94 exercise names + their existing `movement_pattern`s from the seed migrations, feed that exact list to ChatGPT for the six new fields only (so it can't re-derive patterns wrongly), then a script writes the seed migration.
