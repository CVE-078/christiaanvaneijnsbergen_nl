# PHUL (Power Hypertrophy Upper Lower), 4-day program style, design spec

**Status: APPROVED FOR IMPLEMENTATION (2026-06-11).** External review complete (Claude.ai + ChatGPT + Perplexity). All open questions resolved. TDD implementation is cleared to proceed. Slot compositions unchanged from DRAFT; changes are documentation and clarification only. Roadmap: Tier 2 generation, new program-style addition (#18). No dependency on any open work; pure additive data.

---

## 1. Problem / motivation

The 4-day picker (`STYLES[4]`) offers four splits today: Classic Upper/Lower (`ul-classic-4`), Aesthetic Upper/Lower (`ul-aesthetic-4`), Push/Pull/Legs + Full Body (`ppl-fb-4`), and a four-full-body block (`fb-hmhp-4`). None of them is a powerbuilding split.

Verified against the live catalog (2026-06-11):

- **`ul-classic-4`** runs all four days at `hypertrophy` bias. It is a body-part-emphasis split: a chest/back upper vs a delts/arms upper, a quad lower vs a posterior lower. There is no heavy/strength day and no per-muscle "heavy then volume" structure.
- **`ul-aesthetic-4`** is upper-priority with extra isolation; upper B is `pump`, the lower days `hypertrophy`. Even further from powerbuilding.
- **`ppl-fb-4`** trains each muscle group roughly once a week (PPL) plus a balanced full-body day; all `hypertrophy`/`balanced`. No heavy/volume contrast per muscle.
- **`fb-hmhp-4`** has one genuine strength day (`fb_strength`), but it is four full-body days (heavy/medium/heavy/pump), not an upper/lower split, and it does not train each muscle "once heavy, once for volume" in the PHUL sense.

PHUL's identity is precisely the thing none of these expresses: **the same muscles trained twice a week, once heavy (power, low reps on the main compounds) and once for volume (hypertrophy reps).** It is the canonical intermediate-to-advanced powerbuilding template and a well-known named split users specifically ask for. Adding it deepens the "genuinely strong generation" moat by covering a popular goal the catalog currently cannot serve.

**Why the existing `TrainingStyle = powerbuilding` axis is not a substitute.** `TrainingStyle` is orthogonal and operates per-pattern, not per-day: `resolveRepRange` under powerbuilding gives every heavy-pattern compound the strength range and every accessory the hypertrophy range, on *every* day. Applied to `ul-classic-4` it yields four identical "heavy compounds + hypertrophy accessories" days, not a power day paired with a volume day. PHUL's power/volume contrast is a **day-level bias structure**, which only a dedicated style with per-session biases can express. (See Section 7 for how the two axes interact when both are set.)

## 2. Target user

- **Experience:** intermediate to advanced. The split assumes the user can recover from and progress two heavy compound sessions plus two higher-volume sessions per week.
- **Goal:** powerbuilding, the user who wants their main lifts (bench, squat, deadlift, overhead press, rows) to keep progressing on a strength curve *while* building size. Strength-curious hypertrophy trainees and hypertrophy-curious strength trainees both land here.
- **Frequency:** exactly 4 days. `SUGGESTED_DAYS[4] = [1, 2, 4, 5]` (Mon, Tue, Thu, Fri) maps the session order to canonical PHUL with zero engine change: session 0 (Upper Power) to Monday, session 1 (Lower Power) to Tuesday, session 2 (Upper Hypertrophy) to Thursday, session 3 (Lower Hypertrophy) to Friday. Wednesday and the weekend are rest.

## 3. Program structure

Four sessions, two upper and two lower, paired as a Power day and a Hypertrophy day per region. Both upper days share `focus: 'upper'` and both lower days share `focus: 'lower'`, so under the `consistent` variety preference the anchor map (keyed `(focus, pattern)`) pins the **same main lift across the heavy and volume day of a region** (same bench Monday and Thursday, same squat Tuesday and Friday). That shared anchor is exactly PHUL's "same muscle, different loading" philosophy expressed through progressive overload. Under `varied` the avoid-set rotates the volume day onto a different variant (Section 6).

| Day | Focus | Emphasis | Bias | Slots |
|-----|-------|----------|------|-------|
| 1 Upper Power | `upper` | `phul_upper_power` | `strength` | horizontal_push, horizontal_pull, vertical_push, vertical_pull, biceps_iso, triceps_iso |
| 2 Lower Power | `lower` | `phul_lower_power` | `strength` | squat, hinge, lunge, calf, core |
| 3 Upper Hypertrophy | `upper` | `phul_upper_hyp` | `hypertrophy` | horizontal_push, horizontal_pull, vertical_pull, chest_iso, shoulder_iso, biceps_iso, triceps_iso |
| 4 Lower Hypertrophy | `lower` | `phul_lower_hyp` | `hypertrophy` | squat, lunge, hinge, glute_iso, calf, core |

What the biases deliver (verified against `repRange` / `resolveRepRange` / the set-bump logic):

- **Power days (`strength` bias):** compounds at `3-6` reps, accessories at `10-15`, and the session's first compound takes the `+1` set bump (4 sets). On Upper Power the role model leads with the horizontal-push compound (bench), so bench gets the bump; on Lower Power it leads with squat (PRIMARY_LOWER), so squat gets the bump.
- **Hypertrophy days (`hypertrophy` bias):** compounds at `8-12`, isolations at `12-15`, no set bump.
- `lose_fat` shifts both columns up one notch as it does everywhere (Section 7 notes the interaction; it is the existing global behavior, not PHUL-specific).

### 3.1 Why each emphasis is new (reuse audit)

No existing emphasis can serve a PHUL session, for two structural reasons: PHUL's power days need a `strength` bias that no existing upper/lower emphasis carries, and PHUL's Lower Power needs squat **and** hinge on one day, which the catalog deliberately never does.

- **`lower_quad` cannot be Lower Power.** It is `[squat, lunge, glute_iso, calf, core]` with **no hinge**. PHUL Lower Power needs the deadlift (hinge) on the same day as the squat.
- **`lower_post` cannot be Lower Power.** It is `[hinge, glute_iso, lunge, calf, core]` with **no squat**, and it is hinge-anchored (the `isOffContractLowerCompound` guard actively keeps squat off it).
- The two existing lower emphases are a deliberate A/B *split* (squat-day vs hinge-day) precisely so the `consistent` anchor cannot pin the same lifts to both. PHUL Lower Power needs the opposite: both heavy lifts together. So Lower Power **must** be new.
- **`push_heavy` cannot be Upper Power.** It is `[horizontal_push, vertical_push, chest_iso, shoulder_iso, triceps_iso]`, a push-only day with no pulling. PHUL Upper Power is a full upper session (press and pull). Different composition.
- **`upper_general`** is the closest structural sibling to Upper Power (`[horizontal_push, horizontal_pull, vertical_pull, vertical_push, shoulder_iso, biceps_iso, triceps_iso]`, the full four-compound set), but its bias is `balanced`, not `strength`, and it carries `shoulder_iso` where PHUL Upper Power wants minimal arm-only isolation. Bias mismatch disqualifies it; the power day must be `strength`.
- **`upper_chest_back` / `upper_delts_arms` / `upper_aesthetic_*`** are all `hypertrophy`/`pump` and include `vertical_push`; none matches Upper Hypertrophy's no-vertical-push composition or Upper Power's `strength` bias.
- **`legs` / `lower_general`** are the closest match to Lower Hypertrophy: `legs` is `[squat, hinge, lunge, glute_iso, calf, core]` at `hypertrophy` bias, structurally near-identical. **We still define a new `phul_lower_hyp` rather than reuse `legs`**, for three reasons: (1) PHUL Lower Hypertrophy is quad-biased (squat then lunge leads, hinge after) to complement the heavy squat/deadlift Power day, which `legs` does not order for; (2) reusing `legs` would couple every future PHUL lower-volume tweak to `ppl-3` / `ppl-fb-4` / `pplul-5` (the share-by-contract cost the `ppl-x2-6` spec flagged), and the intent is *not* identical (a PHUL second-leg-day vs a PPL only-leg-day); (3) PHUL's value is the legible **pairing** of two dedicated lower days, which reads clearly only when both are purpose-built. This is the one judgment call where reuse was viable; we choose a dedicated emphasis deliberately.

## 4. The four emphasis definitions

```ts
// PHUL (Power Hypertrophy Upper Lower), phul-4. Each region trained twice a week:
// a strength-bias Power day and a hypertrophy-bias Volume day. Both upper days use
// focus 'upper' and both lower days focus 'lower', so the `consistent` anchor pins
// the same main lift across the heavy and volume day of a region (progressive
// overload, PHUL's "same muscle, different loading" identity).
phul_upper_power: {
    bias: 'strength',
    // Full upper press + pull, minimal arm isolation. The role model leads with the
    // horizontal-push compound (bench), which takes the +1 strength set bump.
    slots: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'biceps_iso', 'triceps_iso'],
},
phul_lower_power: {
    bias: 'strength',
    // Squat AND hinge are the two heavy money lifts (3-6 reps); squat is PRIMARY_LOWER
    // and takes the +1 set bump, the deadlift (hinge) lands SECONDARY_LOWER. lunge for
    // unilateral work, calf + core finishers. At 45-60 min the 6th pick backfills to a
    // glute_iso (finisher deflection), at 30 min it trims to squat/hinge/lunge/calf.
    slots: ['squat', 'hinge', 'lunge', 'calf', 'core'],
},
phul_upper_hyp: {
    bias: 'hypertrophy',
    // Volume upper. NO vertical_push compound (the defining PHUL characteristic): the
    // overhead press lives on Power day; shoulders here are trained by shoulder_iso
    // (lateral raises) plus the indirect work from horizontal pressing. chest_iso (fly)
    // plus full arm/delt isolation. vertical_pull at slot 3 no-ops for dumbbell-only
    // users; the trailing triceps_iso drops at the 6-exercise cap.
    slots: ['horizontal_push', 'horizontal_pull', 'vertical_pull', 'chest_iso', 'shoulder_iso', 'biceps_iso', 'triceps_iso'],
},
phul_lower_hyp: {
    bias: 'hypertrophy',
    // Volume lower, quad-biased (squat-led, lunge before hinge for selection freshness
    // on the quad pattern). hinge supplies hamstring/posterior volume at 8-12; squat +
    // lunge are the quad volume (Pulse has no quad-isolation pattern, see Section 5).
    slots: ['squat', 'lunge', 'hinge', 'glute_iso', 'calf', 'core'],
},
```

### Per-emphasis rationale and debatable choices

**`phul_upper_power` (6 slots).** Leads bench, then row, then OHP, then vertical pull, then biceps + triceps. Matches the brief: minimal arm isolation, all four upper compounds present.
- *Debatable: slot order of `vertical_push` vs `vertical_pull`.* I follow the brief's "OHP, vertical pull" order (vpush at slot 2, vpull at slot 3). `upper_general` uses the reverse (`vertical_pull` then `vertical_push`). The order only affects selection freshness and backfill priority under `varied`, never display order (the role model reorders for presentation). Either is defensible; I match the brief.
- *Debatable: only 2 isolation slots.* A strength-led upper day with the first-compound set bump already carries high systemic load from four compounds; minimal isolation is correct for a power day. Kept at biceps + triceps (the direct arm work the four compounds under-train).

**`phul_lower_power` (5 slots).** Squat + deadlift (hinge) are the two heavy lifts; squat leads as PRIMARY_LOWER and takes the bump. lunge for unilateral, calf + core finishers.
- *Debatable: no dedicated hamstring-isolation slot.* Canonical PHUL Lower Power includes a leg curl. Pulse cannot express it here: `HEAVY_DEDUP_PATTERNS` blocks a second `hinge` slot once the deadlift fills it, and there is no `hamstring_iso` pattern (Section 5). The deadlift itself is the heavy posterior work on this day; dedicated hamstring isolation lands on the Hypertrophy day instead. Accepted, documented as a known gap.
- *Debatable: 5 slots, not 6.* At 45-60 min (6 exercises) the 6th comes from backfill; the finisher-deflection rail prefers a fresh lower-bucket pattern over a repeated finisher, landing a `glute_iso`. This produces squat / hinge / lunge / glute_iso / calf / core, a clean lower power day, without hardcoding a 6th slot that a 30-min session would have to trim awkwardly. The exact 6th pick is pool-dependent accessory work and need not be pinned.

**`phul_upper_hyp` (7 slots).** The PHUL-defining day: **no `vertical_push` compound.** Press, row, vertical pull as compounds; chest fly, lateral raise, biceps, triceps as isolation.
- *Debatable: compounds-first slot order vs the brief's "chest_iso right after horizontal_push".* I order all three compounds first (`horizontal_push, horizontal_pull, vertical_pull`) then the four isolations, matching the established `upper_chest_back` / `upper_aesthetic_a` convention ("compounds first"). This keeps compound selection freshness intact and makes the 7th-slot drop at the 6-exercise cap predictable (the trailing `triceps_iso` drops, keeping a fuller compound base). The brief's chest_iso-early order would pull an isolation ahead of two compounds for selection; I judge compounds-first the better engine fit and flag the deviation.
- *Emergent incline/DB behavior (not a gap).* The brief wants an incline/DB press angle on the volume day. The engine has no angle preference, but under `varied` the avoid-set forces Upper Hypertrophy's `horizontal_push` onto a different variant than Upper Power's bench, so it naturally lands on the next canonical press (Incline Barbell / Dumbbell Bench), approximating the intent. Under `consistent` both days share the anchored bench (progressive overload), also valid. No engine change; documented.
- *Consistent vs varied (the incline/DB angle).* Under consistent variety: Upper Power and Upper Hypertrophy share the same horizontal_push anchor (e.g., both days use flat bench), which is correct for progressive overload: the user tracks their bench progression across both days at different rep ranges. Under varied variety: the avoid-set forces Upper Hypertrophy's horizontal_push onto a different variant from the Power day, naturally landing on Incline Barbell Press or Dumbbell Bench, approximating canonical PHUL's 'different angle on volume day' intent without requiring any angle metadata in the engine.
- *Session length note (7 slots at 45-60 min).* At 45-60 min (6 exercises, the most common session length), the trailing triceps_iso slot drops from the session. Users at 45-60 min on Upper Hypertrophy will see horizontal_push + horizontal_pull + vertical_pull + chest_iso + shoulder_iso + biceps_iso, with no dedicated triceps isolation. Triceps receive indirect work from the pressing compound. At 90+ min all 7 slots are active. This is the correct behavior: the compounds-first slot order ensures the drop is always the least critical isolation slot.

**`phul_lower_hyp` (6 slots).** Quad-biased volume: squat leads, lunge second (extra quad, unilateral), hinge third (hamstring/posterior volume at 8-12), then glute_iso, calf, core.
- *Debatable: lunge before hinge.* This is the quad-bias lever. The role model still presents squat first then hinge then lunge (lower-pattern priority squat > hinge > lunge), so the lunge-before-hinge order is a *selection-freshness* signal, not a display one, the same selection-vs-display nuance the `ppl-x2-6` spec documented. The quad emphasis is real (lunge gets the fresher pick and earlier backfill) even though display order is role-model-owned.
- *Deliberate PHUL approximation (hinge as the hamstring-curl proxy).* Canonical PHUL Lower Hypertrophy uses a leg curl (hamstring isolation) and leg extension (quad isolation) as its isolation work. Pulse has neither hamstring_iso nor quad_iso movement patterns (Section 5, gap #1). The hinge slot on Lower Hypertrophy serves as the hamstring-curl proxy at 8-12 reps: RDL or DB leg curl under varied, the consistent anchor's hinge variant under consistent. This means both lower days carry a hinge compound (heavy deadlift on Power, moderate hinge on Hypertrophy), which is more lower-body-generalist than the original program. This is an accepted, documented approximation of the canonical structure given the current pattern taxonomy. When quad_iso and hamstring_iso are added in a future Phase 0 #2 metadata pass, the Lower Hypertrophy day can be updated to express the canonical isolation work.
- *Debatable: hinge on both lower days.* Lower Power has the heavy deadlift; Lower Hypertrophy has a hinge at 8-12. Under `consistent` that resolves to the same lift heavier-then-lighter (canonical for an intermediate); under `varied` Lower Hypertrophy gets a different hinge (RDL / leg curl) for hamstring volume. Both are the standard PHUL hamstring treatment. Intended.

## 5. Engine gaps and known limitations

PHUL is implementable with **zero engine logic changes**, but four capability gaps shape the designs above. None blocks the style; each has an accepted workaround documented here.

1. **No `quad_iso` / `hamstring_iso` movement patterns (the primary gap).** Canonical PHUL Lower Hypertrophy uses leg extensions (quad isolation) and leg curls (hamstring isolation) as distinct slots. Pulse's 15 `MovementPattern` values have neither.
   - *Hamstring-curl role:* the exercise catalog tags the dumbbell leg curl as **`hinge` isolation** (`is_compound: false`), so a `hinge` slot can surface it. On the Hypertrophy day this works (the hinge slot under `varied` can pick a leg curl). On the **Power day it cannot**, because once the deadlift fills `hinge`, `HEAVY_DEDUP_PATTERNS` blocks a second `hinge` slot regardless of the candidate's compound flag. Accepted: the deadlift is the power day's posterior work.
   - *Quad-extension role:* there is no quad-isolation pattern at all, and `HEAVY_DEDUP` caps `squat` compounds at one, so a second quad-pattern movement (leg press / hack squat, both compounds) is blocked on the same day. The workaround is **`squat` + `lunge`** as the quad volume on Lower Hypertrophy; leg extensions are not expressible.
   - **Do NOT add new movement patterns for this.** That is a future generation Phase 0 #2 metadata consideration (an `anchor_rank`-style column or a richer pattern taxonomy), explicitly out of scope here. This spec ships PHUL on the existing 15 patterns and documents the approximation.

2. **No exercise-angle preference (incline / decline / dumbbell).** Upper Hypertrophy "wants" an incline or dumbbell press angle to differ from the flat bench on Power day. The engine selects by `movement_pattern` + canonical rank + fatigue, not by angle. Mitigation (Section 4): under `varied` the avoid-set lands the volume day on a different press variant automatically. No new metadata proposed; acceptable for v1.

3. **`TrainingStyle` collapses the day-level bias contrast (by design, not a defect).** Documented in Section 7.

4. **Deadlift set count asymmetry on Lower Power.** The +1 set bump from the strength bias fires on the session's first compound, which is the squat (PRIMARY_LOWER by lower pattern priority: squat outranks hinge). This gives squat 4 sets and the deadlift 3 sets at 45-60 min. In canonical PHUL, squat and deadlift are co-equal primary lifts and typically receive the same set count. The asymmetry is an engine limitation (the bump always goes to position 0 after role ordering) rather than a design choice. Accepted for v1: the practical impact is one fewer set on the deadlift, which also reduces the already-high systemic fatigue load of having both heavy lifts in one session (see below). Future fix: a per-pattern set-count override on strength days, out of scope here.

**Recovery note:** Lower Power is the highest-fatigue session in the catalog: heavy squat and heavy deadlift in the same session at strength rep ranges imposes significant systemic load. This is a characteristic of canonical PHUL itself, not a design error. Users who find recovery difficult should consider the Balanced training style (preserving the 3-6 compound rep ranges) and adequate rest between Tuesday and Thursday. The engine does not model session-level fatigue; this is an informational note only.

**Varied mode recommendation:** PHUL benefits more strongly from the varied variety preference than most other styles. Under varied, the Upper Hypertrophy day naturally lands on a different horizontal push variant (incline/DB press) than the flat bench anchored on Upper Power, approximating canonical PHUL's power/volume exercise differentiation. Under consistent, both upper days share the same bench (correct for progressive overload tracking but less stimulus variety). Document in the rationale builder when PHUL is generated.

No other gaps. Specifically: excluding `vertical_push` from Upper Hypertrophy is a pure slot-list choice (no engine support needed); squat + hinge coexisting on Lower Power is allowed (the heavy-dedup cap is per-pattern, so one squat and one hinge both seat); the per-focus `COMPOUND_FLOOR` is satisfied by every PHUL session in a normal pool (upper floor 1: Upper Power has 4 compounds, Upper Hypertrophy 3; lower floor 2: both lower days have 3); and dumbbell-only users degrade gracefully (vertical_pull no-ops on the two days that carry it, backfill covers, floors still met).

**Lower Hypertrophy dumbbell-only path:** the hinge slot on phul_lower_hyp is the primary hamstring-coverage slot for dumbbell users. Under varied, this seat lands on Dumbbell Romanian Deadlift or the DB leg curl variation if one exists in the catalog. This is the most important slot for dumbbell-only Lower Hypertrophy quality. If the hinge pool is thin under equipment constraints, the minimum-compound guard fires and searches for a safe hinge fallback before filling with finishers.

## 6. `STYLES[4]` entry

Add a fifth entry to `STYLES[4]`. Placement is presentational only: `recommendStyle` returns `styles[0].key` (so `ul-classic-4` stays the 4-day default) and `resolveStyle` finds by key, so nothing reads `STYLES[4]` by index beyond `[0]`. Recommended placement: **after the two upper/lower splits** (index 2, grouping U/L styles together for the picker), which is safe because only index 0 is load-bearing. Appending last is equally safe if minimal-churn is preferred.

```ts
{
    key: 'phul-4',
    name: 'Power Hypertrophy Upper Lower',
    bestFor: 'Powerbuilding: train each muscle twice a week, once heavy for strength and once for size. Designed for the Balanced training style to preserve the power/volume contrast.',
    sessions: [
        { focus: 'upper', emphasis: 'phul_upper_power', variant: 'A' },
        { focus: 'lower', emphasis: 'phul_lower_power', variant: 'A' },
        { focus: 'upper', emphasis: 'phul_upper_hyp',   variant: 'B' },
        { focus: 'lower', emphasis: 'phul_lower_hyp',   variant: 'B' },
    ],
},
```

- Variant `A` = the Power pair, `B` = the Hypertrophy pair. `WorkoutTabs` sorts/labels A then B, so the picker reads Upper A / Lower A / Upper B / Lower B. (Per-session labels like "Upper (Power)" are the separate Bug 6 relabel follow-up with its own migration, explicitly out of scope.)
- Session order is the week's rhythm: Power block first (Mon/Tue), Hypertrophy block second (Thu/Fri), matching `SUGGESTED_DAYS[4]`.

## 7. `TrainingStyle` and `lose_fat` interaction (accepted)

PHUL encodes its contrast as day-level biases (`strength` power days, `hypertrophy` volume days). `resolveBias` runs on top via the user's `TrainingStyle`:

- **`balanced` (default, and `null`):** identity. The power/volume contrast is preserved exactly as designed. This is the intended pairing.
- **`strength`:** remaps `hypertrophy -> strength`, so both volume days become strength-biased and the contrast collapses to "all four days heavy." Same behavior the style axis has everywhere.
- **`bodybuilding`:** remaps `strength -> hypertrophy`, collapsing to "all four days volume."
- **`powerbuilding`:** `resolveRepRange` overrides per-pattern (heavy patterns strength reps, accessories hypertrophy) on all four days, so the day-level power/volume distinction flattens into a per-lift one.

This is the documented, precedented behavior (`ppl-x2-6` Section 4). It is mildly ironic that PHUL *is* a powerbuilding structure, so a user who also picks the `powerbuilding` style gets a different but still-coherent powerbuilding interpretation. We do **not** try to lock the style axis for PHUL; `balanced` delivers the canonical PHUL and is the default. `lose_fat` shifts both rep columns up a notch as it does for every style; on PHUL this keeps power compounds at `6-10` rather than `3-6`, the existing global density bias, accepted.

**User guidance:** selecting Strength, Bodybuilding, or Powerbuilding as the training style will collapse or flatten the day-level power/volume contrast. Balanced (the default) delivers canonical PHUL. This is documented behavior, not a defect; the rationale builder should surface it so users understand why the program feels different when a non-Balanced style is selected.

## 8. Scope / ripple

- `src/lib/pulse/types.ts`: extend the `EmphasisKey` union with `phul_upper_power`, `phul_lower_power`, `phul_upper_hyp`, `phul_lower_hyp`.
- `src/lib/pulse/generation.ts`: add the four `EMPHASES` entries and the `phul-4` `STYLES[4]` entry.
- Nothing else. No engine logic, no migration, no server action / API / hook / UI change, no new persisted value. The style flows through the existing `RoutineSetupFlow` style-picker (which already shows a picker step whenever a day count has more than one style; 4-day already does), `recommendStyle` / `resolveStyle`, and `generateRoutine` unchanged.

## 9. New `EmphasisKey` values

Add to the union in `types.ts`:

```ts
// phul (4-day powerbuilding: power + hypertrophy per region)
| 'phul_upper_power'
| 'phul_lower_power'
| 'phul_upper_hyp'
| 'phul_lower_hyp'
```

## 10. Test surface

New tests, mirroring the `Item 5: ppl-x2-6 A/B differentiation` golden pattern (deep pool, 45-60 min, balanced style; a `~30 min` variant where a single-slot-per-pattern assertion needs no backfill):

1. **Week shape:** `STYLES[4].find(s => s.key === 'phul-4').sessions` deep-equals the exact four `{ focus, emphasis, variant }` entries in order (guards against accidental session reordering).
2. **`phul_upper_power` golden:** strength compounds at `3-6`; exactly one 4-set bump; the session contains `horizontal_push` + `horizontal_pull` + `vertical_push` + `vertical_pull`; isolation is only `biceps_iso` + `triceps_iso`.
3. **`phul_lower_power` golden:** strength; contains both `squat` and `hinge` (both at `3-6`); exactly one 4-set bump and it lands on the squat (PRIMARY_LOWER, position 0); contains `lunge`; finishers `calf`/`core`.
4. **`phul_upper_hyp` golden:** hypertrophy compounds at `8-12`, no bump; contains `horizontal_push` + `horizontal_pull` + `vertical_pull`; **contains NO `vertical_push`** (the defining assertion); contains `chest_iso` + `shoulder_iso` + arm isolation.
5. **`phul_lower_hyp` golden:** hypertrophy at `8-12`, no bump; squat-led; contains `lunge` and `hinge`; contains a `calf` finisher.
6. **`consistent` anchor sharing:** at `~30 min` (no backfill), Upper Power and Upper Hypertrophy share the same `horizontal_push` exercise id (same bench), and Lower Power and Lower Hypertrophy share the same `squat` id.
7. **`varied` differentiation:** at 45-60 min under `varied`, Upper Power and Upper Hypertrophy pick *different* `horizontal_push` variants (the avoid-set lands the volume day on a different press).
8. **Default unchanged:** `recommendStyle(4)` still returns `'ul-classic-4'`.

## 11. Byte-identity guard

PHUL is purely additive (four new `EMPHASES` keys, one new `STYLES[4]` entry, four union members; no existing definition touched), so **every other style must produce byte-identical output.** The implementation must keep these green unmodified, extending coverage where a 4-day golden is missing:

- The `Item 5` byte-identity guards (`ppl-3`, `ul-classic-4`, `ulppl-5`) stay green as-is.
- **Add/confirm byte-identity goldens for the other three 4-day styles:** `ul-aesthetic-4`, `ppl-fb-4`, `fb-hmhp-4` (today they have composition tests but no full blueprint golden; a flatten-and-compare against the pre-change output is cheap insurance that the new entry changed nothing).
- The GQ1 `varied` golden-identity test, the loading-lean / movement-restriction / behavior golden-identity tests, and the engine-change guards all stay green unmodified.
- The catalog-consistency tests (`every emphasis key referenced by a style exists in EMPHASES`, `every catalog style produces sessions.length schedule days`) validate `phul-4` automatically once the four emphases exist.

## 12. Resolved decisions (review loop, 2026-06-11)

All three DRAFT questions were resolved by the external review (Claude.ai + ChatGPT + Perplexity). No open questions remain.

1. **`TrainingStyle` guidance, resolved.** PHUL is designed for the Balanced training style. The decision is surfaced two ways: the `bestFor` copy (Section 6) now states it, and the rationale builder should note it when a non-Balanced style is selected (Section 7). Not an enforced lock; Strength / Bodybuilding / Powerbuilding stay selectable and collapse the contrast as documented.
2. **Picker placement, resolved.** Index 2, grouped with the U/L splits (after `ul-classic-4` and `ul-aesthetic-4`). PHUL is an upper/lower variant and users browsing the 4-day picker will look for it near other U/L options. The picker order becomes: `ul-classic-4`, `ul-aesthetic-4`, `phul-4`, `ppl-fb-4`, `fb-hmhp-4`.
3. **`phul_upper_hyp` slot order, resolved.** Compounds-first confirmed: all three compounds (`horizontal_push`, `horizontal_pull`, `vertical_pull`) appear before any isolation slot. This preserves compound selection freshness, matches the established `upper_chest_back` / `upper_aesthetic_a` convention, and makes the 7th-slot drop predictable (the trailing `triceps_iso` drops at the 6-exercise cap, keeping the compound base intact). The brief's chest_iso-early suggestion is rejected on engine-fit grounds.

## 13. Non-goals

- No new movement patterns (`quad_iso` / `hamstring_iso`); the gap is documented and worked around, not closed (future Phase 0 #2).
- No engine or role-model logic change; no display-order forcing.
- No per-session schedule labels ("Upper (Power)" is the separate Bug 6 relabel follow-up with its own migration).
- No change to any existing emphasis or style definition.
- No migration; nothing persisted changes shape (`phul-4` is a transient style key like every other, never stored as an enum).
