import { MUSCLES } from './types';
import type { Muscle } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';

// Muscle-coverage observability (Tier-2 Spec 1). PROGRAMMING COVERAGE, NOT BIOMECHANICAL
// TRUTH: the per-exercise muscle attribution is a coaching heuristic, and the warning is
// a generator-quality signal, not a verdict on a routine. Warn on DIRECT sets (primary
// muscle); `effective` adds a 0.5-per-secondary estimate that is diagnostic-only and
// non-normative (a labelled heuristic, never used to decide a warning). See the spec.

/** Diagnostic-only secondary-set credit. A heuristic, NOT a validated conversion; kept
 *  as a single constant so it can be tuned later without touching the data model. */
export const SECONDARY_SET_CREDIT = 0.5;

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
