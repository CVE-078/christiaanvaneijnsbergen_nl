import type { MovementPattern } from './types';
import { PATTERN_MUSCLE_MAP } from './muscleMap';
import type { ExerciseMeta, RoutineBlueprint } from './generation';

// Post-generation programme validator (P2.3). A pure, deterministic CHECKER that
// runs after generateRoutine and surfaces WEEK-level warnings the per-session
// inline warnings (over_time / missing_pattern / demanding_week / limited_variety /
// no_compound) cannot express. It NEVER mutates the blueprint and is not a planner;
// it only returns warning keys, which the caller merges into the routine's warnings.
// Display copy for each key lives in WARNING_COPY (constants.ts).

const PUSH_PULL_IMBALANCE = 'push_pull_imbalance';
const LABEL_MISMATCH = 'label_mismatch';
const NO_VERTICAL_PULL = 'no_vertical_pull';

// Generous: a full-body week legitimately leans press-heavy, so only a real
// lopsidedness (~2.5:1 weighted) warns. Verified below the 6 frozen golden inputs
// (worst is well under this), so the validator is a no-op on the golden path.
const PUSH_PULL_RATIO_MAX = 2.5;

const PRESS_MUSCLES = ['chest', 'shoulders', 'triceps'] as const;
const PULL_MUSCLES = ['back', 'biceps'] as const;
const LOWER_COMPOUND: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'lunge']);

/**
 * Inspect a finished routine for week-level quality gaps. Returns ONLY the new
 * week-level warning keys; the caller dedupes/merges with blueprint.warnings.
 * Deterministic: every reduction iterates the blueprint in its existing order and
 * resolves patterns via a pool lookup, with no Math.random / Date / set-order use.
 */
export function validateProgram(blueprint: RoutineBlueprint, pool: ExerciseMeta[]): string[] {
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const patternOf = (id: string): MovementPattern | null => metaById.get(id)?.movement_pattern ?? null;
    const warnings: string[] = [];

    const rows: Array<{ sets: number; pattern: MovementPattern }> = [];
    for (const ex of blueprint.exercises) {
        const p = patternOf(ex.exercise_id);
        const sets = Number(ex.sets);
        if (p && Number.isFinite(sets)) rows.push({ sets, pattern: p });
    }

    // CHECK 1: weekly push/pull balance (weighted via the muscle bridge). Warn-only.
    let press = 0;
    let pull = 0;
    for (const { sets, pattern } of rows) {
        const w = PATTERN_MUSCLE_MAP[pattern];
        for (const m of PRESS_MUSCLES) press += sets * (w[m] ?? 0);
        for (const m of PULL_MUSCLES) pull += sets * (w[m] ?? 0);
    }
    if (press > 0 && pull > 0 && Math.max(press, pull) / Math.min(press, pull) > PUSH_PULL_RATIO_MAX) {
        warnings.push(PUSH_PULL_IMBALANCE);
    }

    // CHECK 2: label-vs-structure. A labelled lower day must lead (lowest order) with
    // the lower compound its name implies. The role model guarantees this under a deep
    // pool, so it only fires under thin-pool degradation (a real, honest gap).
    for (const day of blueprint.schedule) {
        const wantsQuad = day.label === 'Lower (Quads)';
        const wantsPost = day.label === 'Lower (Hamstrings & Glutes)';
        if (!wantsQuad && !wantsPost) continue;
        const lead = blueprint.exercises
            .filter((e) => e.workout_type === day.workout_type && e.variant === day.variant)
            .sort((a, b) => a.order - b.order)
            .find((e) => {
                const p = patternOf(e.exercise_id);
                return p !== null && LOWER_COMPOUND.has(p);
            });
        const leadPattern = lead ? patternOf(lead.exercise_id) : null;
        const ok = wantsQuad ? leadPattern === 'squat' || leadPattern === 'lunge' : leadPattern === 'hinge';
        if (!ok && !warnings.includes(LABEL_MISMATCH)) warnings.push(LABEL_MISMATCH);
    }

    // CHECK 3: weekly vertical-pull presence, scoped to weeks whose split has an
    // upper/pull day to host it (pure full-body uses horizontal pulling by design, so
    // it is exempt and never nagged), and only when the pool can actually supply one.
    const hostsVerticalPull = blueprint.schedule.some(
        (d) => d.workout_type === 'upper' || d.workout_type === 'pull',
    );
    if (hostsVerticalPull) {
        const hasVerticalPull = rows.some((r) => r.pattern === 'vertical_pull');
        const poolHasVerticalPull = pool.some((e) => e.movement_pattern === 'vertical_pull');
        if (!hasVerticalPull && poolHasVerticalPull) warnings.push(NO_VERTICAL_PULL);
    }

    return warnings;
}
