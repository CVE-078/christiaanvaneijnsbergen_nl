import type { Muscle, MovementPattern, Focus } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';
import { weeklyMuscleSets } from './muscleVolume';
import { estimateSessionMinutes } from './utils';

// Minimum-coverage gap-fill (Tier-2 Spec 3). A deterministic, capped, post-generation
// pass that appends isolation work to close small-muscle volume gaps. PURE: it imports
// no runtime value from generation.ts (only types), so there is no import cycle; the
// caller passes a `qualityOf` so this honors ISOLATION_QUALITY without importing it.

/** The six accessory muscles gap-fill chases. chest/back/quads are warning-only (the
 *  generator's compounds cover them); front_delts/calves/core are informational. */
export type GapFillTarget = 'side_delts' | 'rear_delts' | 'biceps' | 'triceps' | 'hamstrings' | 'glutes';

export const GAP_FILL_TARGETS: readonly GapFillTarget[] = [
    'side_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'hamstrings',
    'glutes',
];

/** The intervention floor (weekly DIRECT sets gap-fill drives toward). A deliberate
 *  policy choice ("worth fixing"), distinct from Spec 1's MUSCLE_SET_TARGETS band. */
export const MUSCLE_COVERAGE_FLOOR: Record<GapFillTarget, number> = {
    side_delts: 6,
    rear_delts: 4,
    biceps: 6,
    triceps: 6,
    hamstrings: 6,
    glutes: 6,
};

/** The isolation pattern that directly trains each target. Never a compound anchor. */
export const ISO_PATTERN_FOR: Record<GapFillTarget, MovementPattern> = {
    side_delts: 'shoulder_iso',
    rear_delts: 'shoulder_iso',
    biceps: 'biceps_iso',
    triceps: 'triceps_iso',
    hamstrings: 'hamstring_iso',
    glutes: 'glute_iso',
};

/** Session focuses each target may be added to. */
export const MUSCLE_REGION: Record<GapFillTarget, readonly Focus[]> = {
    side_delts: ['push', 'upper', 'full_body'],
    rear_delts: ['push', 'pull', 'upper', 'full_body'],
    biceps: ['pull', 'upper', 'full_body'],
    triceps: ['push', 'upper', 'full_body'],
    hamstrings: ['legs', 'lower', 'full_body'],
    glutes: ['legs', 'lower', 'full_body'],
};

export const PER_SESSION_ADD_CAP = 1;
export const ROUTINE_ADD_CAP = 4;
export const GAP_FILL_SET_CEILING = 20;

/** True when the usable pool has a direct isolation for the muscle (so gap-fill can
 *  actually add work for it). */
export function poolCanTrainMuscle(muscle: Muscle, usable: ExerciseMeta[]): boolean {
    return usable.some((e) => e.primary_muscle === muscle && !e.is_compound);
}

/** The best isolation in the usable pool for a muscle: highest quality first, then
 *  lower fatigue (accessory preference), then stable id. Excludes already-used ids.
 *  Null when none matches. */
export function pickIsolationForMuscle(
    muscle: Muscle,
    usable: ExerciseMeta[],
    excludeIds: Set<string>,
    qualityOf: (ex: ExerciseMeta) => number,
): ExerciseMeta | null {
    const candidates = usable.filter((e) => e.primary_muscle === muscle && !excludeIds.has(e.id));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
        const q = qualityOf(b) - qualityOf(a);
        if (q !== 0) return q;
        const fa = a.fatigue ?? 3;
        const fb = b.fatigue ?? 3;
        if (fa !== fb) return fa - fb;
        return a.id.localeCompare(b.id);
    });
    return candidates[0];
}

type Row = RoutineBlueprint['exercises'][number];
interface SessionCtx {
    focus: Focus;
    isoReps: string;
    baseSets: number;
}
export interface GapFillInput {
    exercises: Row[];
    schedule: RoutineBlueprint['schedule'];
    pool: ExerciseMeta[];
    usable: ExerciseMeta[];
    sessionCtx: Map<string, SessionCtx>;
    qualityOf: (ex: ExerciseMeta) => number;
    bandMaxMin: number | null;
}

const sessionKey = (wt: string, variant: string | null) => `${wt}:${variant ?? ''}`;
const PATTERN_CAP = 2;

/** Append isolation work to close small-muscle gaps. Returns a new exercises array;
 *  never reorders or removes. No-op (returns the exercises unchanged) when NO exercise
 *  in the session carries a primary_muscle via the provided pool; a mixed pool with at
 *  least one attributed exercise runs the pass and gap-fills only attributed muscles. */
export function applyCoverageGapFill(input: GapFillInput): Row[] {
    const { schedule, pool, usable, sessionCtx, qualityOf, bandMaxMin } = input;
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const exercises = input.exercises.map((e) => ({ ...e }));
    if (!exercises.some((e) => metaById.get(e.exercise_id)?.primary_muscle)) return exercises;

    const direct = (): Record<GapFillTarget, number> => {
        const counts = weeklyMuscleSets({ schedule, exercises, warnings: [] }, pool);
        const out = {} as Record<GapFillTarget, number>;
        for (const m of GAP_FILL_TARGETS) out[m] = counts[m].direct;
        return out;
    };
    const usedIds = new Set(exercises.map((e) => e.exercise_id));
    let added = 0;

    const sessionRowsFor = (key: string) =>
        exercises.filter((e) => sessionKey(e.workout_type, e.variant) === key);
    const sessionMinutes = (key: string) =>
        estimateSessionMinutes(
            sessionRowsFor(key).map((e) => ({
                sets: Number(e.sets),
                is_compound: metaById.get(e.exercise_id)?.is_compound ?? false,
                reps: e.reps,
                supersetGroupId: e.superset_group_id,
            })),
        );
    const sessionAddCount = new Map<string, number>(); // gap-fill inserts per session

    // Sessions eligible for a muscle, best-placement first.
    const pickSession = (muscle: GapFillTarget, allowOverTime: boolean): string | null => {
        const region = MUSCLE_REGION[muscle];
        const isoPattern = ISO_PATTERN_FOR[muscle];
        const keys = schedule
            .map((s) => ({ key: sessionKey(s.workout_type, s.variant), focus: sessionCtx.get(sessionKey(s.workout_type, s.variant))?.focus }))
            .filter((s) => s.focus && region.includes(s.focus));
        // 1) a session already training the muscle (augment existing exposure)
        const existing = keys.find((s) =>
            sessionRowsFor(s.key).some((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle),
        );
        const eligible = (key: string): boolean => {
            if ((sessionAddCount.get(key) ?? 0) >= PER_SESSION_ADD_CAP) return false;
            const patternCount = sessionRowsFor(key).filter(
                (e) => metaById.get(e.exercise_id)?.movement_pattern === isoPattern,
            ).length;
            if (patternCount >= PATTERN_CAP) return false;
            if (!pickIsolationForMuscle(muscle, usable, usedIds, qualityOf)) return false;
            if (!allowOverTime && bandMaxMin !== null && sessionMinutes(key) >= bandMaxMin) return false;
            return true;
        };
        if (existing && eligible(existing.key)) return existing.key;
        // 2) eligible session with the lowest current representation of the muscle,
        //    tiebreak fewest exercises then schedule order.
        const repOf = (key: string) =>
            sessionRowsFor(key).filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle).length;
        const candidates = keys.filter((s) => eligible(s.key));
        if (candidates.length === 0) return null;
        candidates.sort((a, b) => {
            const r = repOf(a.key) - repOf(b.key);
            if (r !== 0) return r;
            const n = sessionRowsFor(a.key).length - sessionRowsFor(b.key).length;
            if (n !== 0) return n;
            return 0; // keys already in schedule order
        });
        return candidates[0].key;
    };

    const seat = (muscle: GapFillTarget, key: string) => {
        const ex = pickIsolationForMuscle(muscle, usable, usedIds, qualityOf);
        if (!ex) return false;
        const [wt, variantRaw] = key.split(':');
        const variant = variantRaw === '' ? null : variantRaw;
        const ctxFor = sessionCtx.get(key);
        const order = Math.max(-1, ...sessionRowsFor(key).map((e) => e.order)) + 1;
        exercises.push({
            exercise_id: ex.id,
            workout_type: wt as Row['workout_type'],
            variant: variant as Row['variant'],
            order,
            sets: String(ctxFor?.baseSets ?? 3),
            reps: ctxFor?.isoReps ?? '12-15',
            superset_group_id: null,
        });
        usedIds.add(ex.id);
        sessionAddCount.set(key, (sessionAddCount.get(key) ?? 0) + 1);
        added += 1;
        return true;
    };

    // ---- Phase 1: eliminate zeros (trainable) ----
    // Snapshot is taken once; safe because seating an isolation for one muscle never
    // un-zeros a different muscle (the isolation pool is single-muscle).
    const zeroTargets = GAP_FILL_TARGETS.filter((m) => direct()[m] === 0 && poolCanTrainMuscle(m, usable));
    for (const muscle of zeroTargets) {
        if (added >= ROUTINE_ADD_CAP) break;
        const key = pickSession(muscle, true); // zero-kill may overflow time
        if (key) seat(muscle, key);
    }

    // ---- Phase 2: nudge below-floor partials ----
    // Snapshot the tally once for ordering; ties break by declaration order in GAP_FILL_TARGETS.
    const postPhase1 = direct();
    const ordered = [...GAP_FILL_TARGETS].sort(
        (a, b) =>
            postPhase1[a] / MUSCLE_COVERAGE_FLOOR[a] - postPhase1[b] / MUSCLE_COVERAGE_FLOOR[b] ||
            GAP_FILL_TARGETS.indexOf(a) - GAP_FILL_TARGETS.indexOf(b),
    );
    for (const muscle of ordered) {
        let guard = 0;
        while (guard++ < 50) {
            // Compute current sets once per iteration, not inside a comparator.
            const sets = direct()[muscle];
            if (sets >= MUSCLE_COVERAGE_FLOOR[muscle]) break;
            // try a set-bump on the cheapest existing isolation for this muscle
            const existingIso = exercises
                .filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle)
                .sort((a, b) => Number(a.sets) - Number(b.sets))[0];
            if (existingIso && sets < GAP_FILL_SET_CEILING && Number(existingIso.sets) < GAP_FILL_SET_CEILING) {
                existingIso.sets = String(Number(existingIso.sets) + 1);
                continue;
            }
            // nothing to bump: try one insert, within budget + headroom
            if (added >= ROUTINE_ADD_CAP) break;
            const key = pickSession(muscle, false); // below-floor insert needs headroom
            if (!key || !seat(muscle, key)) break;
        }
    }
    return exercises;
}
