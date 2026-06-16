import { MUSCLES } from './types';
import type { Muscle, MovementPattern } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';

// Muscle-coverage observability (Tier-2 Spec 1). PROGRAMMING COVERAGE, NOT BIOMECHANICAL
// TRUTH: the per-exercise muscle attribution is a coaching heuristic, and the warning is
// a generator-quality signal, not a verdict on a routine. Warn on DIRECT sets (primary
// muscle); `effective` adds a 0.5-per-secondary estimate that is diagnostic-only and
// non-normative (a labelled heuristic, never used to decide a warning). See the spec.

/** Diagnostic-only secondary-set credit. A heuristic, NOT a validated conversion; kept
 *  as a single constant so it can be tuned later without touching the data model. */
export const SECONDARY_SET_CREDIT = 0.5;

/** Warning-only compound-carryover credit (context-scoring spec, 2026-06-16). A compound
 *  that trains a muscle as a SECONDARY gets partial credit toward that muscle in the
 *  coverage WARNING comparison only (NOT gap-fill, NOT selection, NOT the UI). The map is
 *  sparse and defaults to 0: only movement -> secondary pairs with genuinely strong
 *  carryover are credited. squat / hinge / lunge credit NOTHING, so a squat-only week
 *  still warns on a real hamstring or glute gap (the masking trap all reviewers flagged).
 *  Isolations never carry over. */
export const CARRYOVER_CREDITS: Partial<Record<MovementPattern, Partial<Record<Muscle, number>>>> = {
    horizontal_push: { triceps: 0.5, front_delts: 0.5 },
    vertical_push: { triceps: 0.5, front_delts: 0.5 },
    horizontal_pull: { biceps: 0.5, rear_delts: 0.5 },
    vertical_pull: { biceps: 0.5 },
};

/** Carryover-only credit per muscle (does NOT include direct sets). For each COMPOUND row,
 *  for each of its secondary muscles, add sets * CARRYOVER_CREDITS[pattern][muscle] (0 if the
 *  pair is unlisted). Deterministic; pure. Used only by muscleCoverageGaps. */
export function compoundCarryover(
    blueprint: RoutineBlueprint,
    pool: ExerciseMeta[],
): Record<Muscle, number> {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const out = {} as Record<Muscle, number>;
    for (const m of MUSCLES) out[m] = 0;
    for (const row of blueprint.exercises) {
        const meta = metaById.get(row.exercise_id);
        if (!meta || !meta.is_compound || !meta.movement_pattern) continue;
        const credits = CARRYOVER_CREDITS[meta.movement_pattern];
        if (!credits) continue;
        const sets = Number(row.sets);
        if (!Number.isFinite(sets) || sets <= 0) continue;
        for (const sec of meta.secondary_muscle_groups ?? []) {
            const frac = credits[sec];
            if (frac) out[sec] += sets * frac;
        }
    }
    return out;
}

export interface MuscleSetCount {
    direct: number;
    effective: number;
}

/** Weekly per-muscle set volume for a finished routine. `direct` = sets whose exercise's
 *  primary_muscle is this muscle; `effective` = direct + SECONDARY_SET_CREDIT per set for
 *  each secondary muscle. Exercises without a stored primary_muscle contribute nothing
 *  (so synthetic / unattributed pools yield an all-zero tally). Deterministic. */
export function weeklyMuscleSets(
    blueprint: RoutineBlueprint,
    pool: ExerciseMeta[],
): Record<Muscle, MuscleSetCount> {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const out = {} as Record<Muscle, MuscleSetCount>;
    for (const m of MUSCLES) out[m] = { direct: 0, effective: 0 };

    for (const row of blueprint.exercises) {
        const meta = metaById.get(row.exercise_id);
        const primary = meta?.primary_muscle;
        if (!primary) continue;
        const sets = Number(row.sets);
        if (!Number.isFinite(sets) || sets <= 0) continue;
        out[primary].direct += sets;
        out[primary].effective += sets;
        for (const sec of meta?.secondary_muscle_groups ?? []) {
            out[sec].effective += sets * SECONDARY_SET_CREDIT;
        }
    }
    return out;
}

/** A warning-target key: a Muscle, or the aggregate 'back' (= lats + upper_back). The
 *  9 keys here are exactly the muscles in the validated science table; front_delts /
 *  calves / core are deliberately absent (informational-only). */
export type MuscleTarget =
    | 'chest'
    | 'back'
    | 'side_delts'
    | 'rear_delts'
    | 'biceps'
    | 'triceps'
    | 'quads'
    | 'hamstrings'
    | 'glutes';

/** Weekly direct-set bands (intermediate hypertrophy), the validated target table.
 *  `max` is stored for future and diagnostic use; it is NOT currently enforced.
 *  The gap check is under-dose only (direct sets below `min`). */
export const MUSCLE_SET_TARGETS: Record<MuscleTarget, { min: number; max: number }> = {
    chest: { min: 10, max: 16 },
    back: { min: 12, max: 18 },
    side_delts: { min: 8, max: 14 },
    rear_delts: { min: 6, max: 12 },
    biceps: { min: 8, max: 12 },
    triceps: { min: 8, max: 12 },
    quads: { min: 10, max: 16 },
    hamstrings: { min: 8, max: 14 },
    glutes: { min: 8, max: 14 },
};

/** Direct sets attributed to a target. Owns the back roll-up (lats + upper_back) so the
 *  taxonomy and the target definitions cannot drift apart. NOTE: the back aggregate is a
 *  v1 simplification (a lats-2 / upper_back-15 program passes back-17 while being
 *  one-dimensional); the lats-vs-upper-back split is what the Spec 2 variety scoring
 *  addresses. Documented, not a silent gap. */
export function targetDirectSets(direct: Record<Muscle, number>, target: MuscleTarget): number {
    if (target === 'back') return (direct.lats ?? 0) + (direct.upper_back ?? 0);
    return direct[target as Muscle] ?? 0;
}

export interface MuscleGap {
    target: MuscleTarget;
    direct: number;
    min: number;
    ratio: number; // direct / min; lower = more severe
}

/** Targeted muscles whose weekly DIRECT sets fall below the band minimum, worst-first by
 *  ratio. Under-dose only. NO-DATA GUARD: if no exercise carries a primary_muscle the
 *  routine is unattributed (synthetic pool) and we cannot assess coverage, so return []
 *  (this keeps the P2.3 validator goldens clean). Only muscles that have at least one
 *  pool exercise targeting them are evaluated (muscles absent from the pool are
 *  out-of-scope and not flagged). */
export function muscleCoverageGaps(blueprint: RoutineBlueprint, pool: ExerciseMeta[]): MuscleGap[] {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const hasAttribution = blueprint.exercises.some((r) => metaById.get(r.exercise_id)?.primary_muscle);
    if (!hasAttribution) return [];

    const counts = weeklyMuscleSets(blueprint, pool);
    const direct = {} as Record<Muscle, number>;
    for (const m of MUSCLES) direct[m] = counts[m].direct;
    // Warning-only: a compound's indirect work counts toward whether to NAG, never toward
    // gap-fill (which stays direct-only) or the reported `direct` number below.
    const carryover = compoundCarryover(blueprint, pool);

    // Build the set of muscles represented in the pool (any exercise targeting them).
    const poolMuscles = new Set<Muscle>();
    for (const ex of pool) {
        if (ex.primary_muscle) poolMuscles.add(ex.primary_muscle);
    }

    const gaps: MuscleGap[] = [];
    for (const target of Object.keys(MUSCLE_SET_TARGETS) as MuscleTarget[]) {
        // Only evaluate targets that have at least one pool exercise.
        const inScope =
            target === 'back'
                ? poolMuscles.has('lats') || poolMuscles.has('upper_back')
                : poolMuscles.has(target as Muscle);
        if (!inScope) continue;
        const { min } = MUSCLE_SET_TARGETS[target];
        const d = targetDirectSets(direct, target);
        // `back` is an aggregate (lats + upper_back); no carryover pair targets it, so its
        // coverage equals direct. For the single-muscle targets, add the carryover credit.
        const credited = target === 'back' ? 0 : carryover[target as Muscle];
        const coverage = d + credited;
        if (coverage < min) gaps.push({ target, direct: d, min, ratio: d / min });
    }
    gaps.sort((a, b) => a.ratio - b.ratio || a.target.localeCompare(b.target));
    return gaps;
}

/** The seed derivation for primary_muscle, mirrored from the migration's SQL CASE.
 *  Production reads the STORED exercises.primary_muscle column (so manual corrections
 *  stick); this helper is used only by (a) the seed-consistency test and (b) the
 *  gen-routine.ts diagnostic as a fallback for un-seeded rows. It is an INITIAL SEED
 *  HEURISTIC, not biomechanical truth (the back lats/upper_back split especially), and
 *  individual exercises are revised manually over time. Total over every MovementPattern. */
export function deriveSeedPrimaryMuscle(
    pattern: MovementPattern | null,
    substitutionClass: string | null,
    name: string,
): Muscle {
    // Explicit overrides for lat-biased back_iso lifts (the rest of back_iso -> upper_back).
    if (name === 'Dumbbell Pullover' || name === 'Straight-Arm Pulldown') return 'lats';

    // Delt heads come from substitution_class (patterns cannot resolve front/side/rear).
    if (substitutionClass === 'lateral_raise') return 'side_delts';
    if (substitutionClass === 'rear_delt_isolation') return 'rear_delts';
    if (substitutionClass === 'front_delt_isolation' || substitutionClass === 'vertical_press') return 'front_delts';
    // Glute-dominant hinges (Hip Thrust, Glute Bridge) before the hinge -> hamstrings rule.
    if (substitutionClass === 'glute_pattern' || pattern === 'glute_iso') return 'glutes';

    switch (pattern) {
        case 'squat':
        case 'lunge':
        case 'quad_iso':
            return 'quads';
        case 'hinge':
        case 'hamstring_iso':
            return 'hamstrings';
        case 'vertical_pull':
            return 'lats';
        case 'horizontal_pull':
        case 'back_iso':
            return 'upper_back';
        case 'horizontal_push':
        case 'chest_iso':
            return 'chest';
        case 'vertical_push':
            return 'front_delts';
        case 'shoulder_iso':
            return 'side_delts';
        case 'biceps_iso':
            return 'biceps';
        case 'triceps_iso':
            return 'triceps';
        case 'calf':
            return 'calves';
        case 'core':
        case null:
            return 'core';
    }
}
