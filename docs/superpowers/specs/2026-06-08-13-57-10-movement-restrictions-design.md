# Movement restrictions, design spec

**Date:** 2026-06-08
**Roadmap item:** Tier 2 #5 (Movement restrictions). Generation Phase 1.
**Branch:** `feature/movement-restrictions`

## Summary

Let a user flag a joint area that bothers them (knee, lower back, shoulder, wrist) so routine generation avoids the movements that commonly stress it and fills the slot with a safe alternative instead. It is a clean pool filter beside the existing `hasEquipment`, plus a per-exercise data seed that tags which lifts are contraindicated for which area.

The feature reduces and substitutes. It never diagnoses, rehabs, or claims to fix anything. Copy stays safety-careful throughout.

## Product decisions (settled before writing this spec)

1. **Per-exercise contraindication tags, not pattern-level bans.** A `knee` restriction drops only the risky lifts (heavy back squat, deep lunge, leg extension) and keeps the knee-friendly ones (box squat, leg press, hinge, leg curl, hip thrust, step-ups). This matches the clinical map in `docs/superpowers/designs/2026-06-06-00-54-52-phase0-source-material.md` section 3, which says "avoid heavy squat, sub box squat", not "avoid all squats". Cost: curating tags across the library plus a migration.
2. **Two surfaces: an optional setup step and a standing Profile editor.** A joint issue is a persistent fact, so unlike the per-routine style/variety/loading knobs it gets a standing editor on the Profile screen, not only a setup step.
3. **The Profile editor stores the restriction; it does not retroactively rewrite the current routine.** Rewriting a live routine would discard logged progress and manual swaps. New restrictions take effect the next time the user generates (the generate action already reads the profile as a fallback). To change the current plan, the user uses the already-shipped per-exercise Swap on the Plan screen. Both UI surfaces say this.

## Architecture

### Data model

`src/lib/pulse/types.ts`:

```ts
export const RESTRICTION_FLAGS = ['knee', 'lower_back', 'shoulder', 'wrist'] as const;
export type RestrictionFlag = (typeof RESTRICTION_FLAGS)[number];
```

The list is extensible (elbow, hip, ankle, neck can be added later) without an engine change.

`ExerciseMeta` (in `generation.ts`) gains:

```ts
/** Joint areas this exercise commonly stresses. A user who flags one of these
 *  areas has the exercise filtered out of generation. Empty for the vast
 *  majority of exercises (default '{}'). */
contraindications: RestrictionFlag[];
```

`Profile` (in `types.ts`) gains:

```ts
/** Joint areas the user wants generation to avoid. Nullable; null/empty means
 *  no restrictions (identity, byte-identical to the base generator). Mirrors
 *  loading_lean. */
movement_restrictions: RestrictionFlag[] | null;
```

### The engine (the heart)

One predicate beside `hasEquipment` in `generation.ts`, applied in `generateRoutine` where the usable pool is built:

```ts
function isContraindicated(ex: ExerciseMeta, restrictions: Set<RestrictionFlag>): boolean {
  if (restrictions.size === 0) return false;
  return ex.contraindications.some((c) => restrictions.has(c));
}

const usable = pool
  .filter((ex) => hasEquipment(ex, answers.equipment))
  .filter((ex) => !isContraindicated(ex, restrictions));
```

`selectForSession` / `byPattern` are untouched. They operate on whatever pool survives.

**The restriction filter is hard and is never relaxed.** This is the deliberate difference from the equipment thin-pool relax, the heavy-compound dedup relax, and the unilateral cap relax. Those relax *structural* caps to fill a session. A contraindicated lift is a *safety* exclusion and must never be re-added to fill a slot. If a restriction empties a movement pattern, the existing GQ1 backfill (which prefers uncovered slots) covers the gap from the remaining safe patterns, so the session degrades gracefully into more safe work rather than breaking or smuggling a risky lift back in.

**Identity guarantee:** when `restrictions` is empty (the null/undefined/`[]` case), no exercise is filtered and the generated routine is byte-identical to the current baseline. Locked by a golden test.

### v1 is a pure subtractive filter (documented boundary)

v1 does not front-load the recommended substitutes. Safe lifts surface in a restricted session only because they are what remains in the pool after filtering, ranked by the existing `byPattern` sort. There is no explicit weighting toward "preferred" substitutes (box squat over leg press, say).

For almost every equipment set this is fine. The one weak case is a heavily restricted user on a sparse equipment set (for example knee-restricted, barbell-and-rack only): the surviving pool can thin to a less-than-ideal selection. This is a known v1 boundary, not a bug. The natural future hook is GQ3's already-shipped `substitution_class`: a later pass could tag preferred safe alternatives and front-load them in `byPattern`. Out of scope here, recorded so a thin-pool oddity is read correctly.

### The seed (the other half of the work)

Migration tags contraindicated exercises per the clinical map, against the **current corrected `movement_pattern` seed** (the `2026-06-06-10-51-33-movement-pattern-correction.sql` correction and the `2026-06-08-gq3-exercise-data-corrections.sql` pass have both shipped, so there is no mis-tag hazard and no migration-ordering dependency to wait on). Tagging principle, by area:

- **knee** => heavy back squat, deep/walking lunge, leg extension. Keeps box squat, leg press, hinge, leg curl, hip thrust, step-ups.
- **lower_back** => heavy deadlift / RDL, good morning, bent-over barbell row, loaded carries. Keeps hip thrust, leg curl, chest-supported row, machine lower body.
- **shoulder** => overhead barbell press, upright row, dips. Keeps neutral-grip / machine press, light lateral raise, cable press.
- **wrist** => straight-bar heavy press, push-up, barbell curl. Keeps dumbbell / neutral-grip and machine / cable variants.

Exact per-exercise tags are derived by reading the current seed during implementation. The implementer writes one `UPDATE` per tagged exercise (or grouped updates), against exercise id or name as the existing correction migrations do.

**Seeding invariant (enforced by test):** no single restriction may empty the leg or push work for a normal equipment set. There is always at least one safe option left in the squat/hinge leg space and in the push space after any one flag is applied.

### Persistence and threading

In `generateAndSaveRoutine` (`src/app/pulse/actions/routines.ts`), following the read-fallback shape of the existing prefs but with a safety-aware write-back rule:

- Add param `movementRestrictions?: RestrictionFlag[]`.
- Resolve for generation: `movementRestrictions ?? (profileRow?.movement_restrictions) ?? []`.
- Pass the resolved set into `generateRoutine`.
- **Write-back rule (the safety-significant part):** persist `movement_restrictions` to the profile only when the param was explicitly passed (`movementRestrictions !== undefined`). When the param is absent (a re-generate flow that does not surface the setup step), omit the column from the upsert entirely so the stored restriction is left untouched.

This is a deliberate divergence from the `training_style` / `variety_preference` write-back, which always persist the resolved value (line 536 of `routines.ts`). Those are preference defaults; silently resetting one is harmless. A restriction is a safety flag: silently clearing a stored knee flag on a re-generate that happens to omit the param would be a safety regression. The `undefined` (absent) vs `[]` (explicitly empty, "I no longer have this issue") sentinel is what distinguishes the two. `undefined` never writes; `[]` does.

(Note: `loading_lean` is currently read as a fallback but not written back at all from this action, so there is no single "precedent" to copy verbatim; this rule is chosen for the safety semantics, not by analogy.)

Pool query (`src/lib/pulse/queries.ts` and the inline pool select in the generate action) adds `contraindications` to the column list.

`OnboardingAnswers` / the `RoutineSetupFlow` `onComplete` payload carries `movementRestrictions: RestrictionFlag[]`.

### UI

**RoutineSetupFlow** (`src/components/pulse/RoutineSetupFlow.tsx`): a new optional `restrictions` step, gated by a `collectRestrictions?: boolean` prop (default true). `TemplatesTab` sets `collectRestrictions={false}`, like the other generation prefs, because cloning a fixed template does not run the filter (see Open boundary below). The step shows the four flags as multi-select chips, default none, with a clear "None / Skip" path. State mirrors `loadingLean`: `const [restrictions, setRestrictions] = useState<RestrictionFlag[]>([])`. Step copy is safety-careful ("Movements we'll avoid", never "this fixes your knee") and ends with the sequencing note: "Takes effect the next time you generate a plan. To swap exercises in your current routine, use the Swap option on any exercise."

**ProfileView** (`src/components/pulse/views/ProfileView.tsx`): a standing editor section with the same four toggles, reading the current `movement_restrictions` from the profile and persisting via a new `setMovementRestrictions(flags: RestrictionFlag[])` server action (writes `profiles.movement_restrictions`, revalidates). Same copy note about applying to future generated routines and pointing at Swap.

## Open boundary (explicit, not an oversight)

Restrictions affect **generation only**. A hand-authored template cloned through `TemplatesTab` is not filtered, and the current active routine is not retro-filtered. A knee-restricted user can still clone a squat-heavy template; that is a deliberate v1 boundary (templates are a fixed "named program I trust", and retro-filtering a live routine destroys progress). A future pass could warn on template clone. Recorded so it is not read as a miss.

## Migrations (hand-written, applied manually per repo convention)

1. `<ts>-movement-restrictions-profile.sql`: `alter table profiles add column movement_restrictions text[];` (nullable).
2. `<ts>-exercise-contraindications.sql`: `alter table exercises add column contraindications text[] not null default '{}';` then the per-exercise `UPDATE` tags.

**RLS:** no policy work. `movement_restrictions` is a new column on the already-RLS-protected `profiles` table and inherits its existing owner-scoped row policy automatically (a column add does not need a new policy). `exercises.contraindications` is read-only catalog data on the existing `exercises` table and inherits that table's existing read policy. Noted here so the pre-launch RLS audit does not have to re-derive it.

## Tests (`src/lib/pulse/__tests__/generation.test.ts`, plus action/UI as fitting)

- **Golden identity:** empty/undefined/`[]` restrictions produce byte-identical output to base, for 3/4/6 training days. (Mirrors the loading-lean identity test.)
- **Name-specific exclusion:** under `knee`, a known contraindicated lift (e.g. Barbell Back Squat) is absent from the generated routine; under `shoulder`, the overhead barbell press is absent; etc. Assert the lift is *gone*, not merely that the pool is non-empty. This closes the silent-seeding-gap failure mode.
- **Seeding invariant / pool not emptied:** a knee-restricted full-body day still trains legs (at least one squat-or-hinge-pattern leg exercise present); a push-restricting flag still leaves a push exercise.
- **Combined flags:** two restrictions at once filter the union and still produce a valid routine.
- **Profile threading:** param wins over the stored profile value, resolved value is written back. (Action-level test if the existing generate-action tests support it.)

## Out of scope (v1)

- Substitute front-loading / preferred-alternative weighting (documented above; future hook is `substitution_class`).
- Template-clone filtering or warning.
- Retro-filtering the active routine.
- Restriction-aware adaptation copy in the Coach Timeline (a restriction is a static input, not a `DecisionEvent`).
- Additional flags beyond the four (the union is extensible when needed).
