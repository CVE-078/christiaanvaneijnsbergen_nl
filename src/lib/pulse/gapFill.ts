import type { Muscle, MovementPattern, Focus } from './types';
import type { ExerciseMeta, RoutineBlueprint } from './generation';
import { weeklyMuscleSets, MUSCLE_SET_TARGETS, type MuscleTarget } from './muscleVolume';
import { estimateSessionMinutes } from './utils';

// Minimum-coverage gap-fill (Tier-2 Spec 3). A deterministic, capped, post-generation
// pass that appends isolation work to close small-muscle volume gaps. PURE: it imports
// no runtime value from generation.ts (only types), so there is no import cycle; the
// caller passes a `qualityOf` so this honors ISOLATION_QUALITY without importing it.

/** The muscles gap-fill chases: six accessories plus chest (a conditional, low-floor
 *  target, Change C). back/quads stay warning-only (the generator's compounds cover
 *  them reliably); front_delts/calves/core are informational. */
export type GapFillTarget =
    | 'side_delts'
    | 'rear_delts'
    | 'biceps'
    | 'triceps'
    | 'hamstrings'
    | 'glutes'
    | 'chest'
    | 'lats';

export const GAP_FILL_TARGETS: readonly GapFillTarget[] = [
    'side_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'hamstrings',
    'glutes',
    'chest',
    'lats',
];

/** Weekly DIRECT-set floor gap-fill drives a muscle toward. A FLOOR, not a target: the
 *  +1/session, +4/routine, and 20-set caps still bound total added work, so on a 4-6 day
 *  plan the floor is aspirational within budget. Capped at 8 deliberately (the floor
 *  prevents neglect, not specialization). chest is a flat low 6 at every frequency
 *  (compounds carry it; gap-fill only catches the catastrophic lows). */
export function coverageFloor(muscle: GapFillTarget, dayCount: number): number {
    // chest + lats are flat low floors: their gap-fill isolations are limited (chest fly;
    // lats only via Dumbbell Pullover / Straight-Arm Pulldown), so gap-fill only catches
    // catastrophic lows; the compounds (presses / vertical pulls) carry the rest.
    if (muscle === 'chest' || muscle === 'lats') return 6;
    const band = dayCount <= 3 ? 'low' : dayCount === 4 ? 'mid' : 'high';
    const table: Record<Exclude<GapFillTarget, 'chest' | 'lats'>, Record<'low' | 'mid' | 'high', number>> = {
        side_delts: { low: 6, mid: 8, high: 8 },
        rear_delts: { low: 4, mid: 6, high: 6 },
        biceps: { low: 6, mid: 8, high: 8 },
        triceps: { low: 6, mid: 8, high: 8 },
        hamstrings: { low: 6, mid: 8, high: 8 },
        glutes: { low: 6, mid: 8, high: 8 },
    };
    return table[muscle][band];
}

/** The isolation pattern that directly trains each target. Never a compound anchor. */
export const ISO_PATTERN_FOR: Record<GapFillTarget, MovementPattern> = {
    side_delts: 'shoulder_iso',
    rear_delts: 'shoulder_iso',
    biceps: 'biceps_iso',
    triceps: 'triceps_iso',
    hamstrings: 'hamstring_iso',
    glutes: 'glute_iso',
    chest: 'chest_iso',
    lats: 'back_iso', // Dumbbell Pullover / Straight-Arm Pulldown (the lat-override isos)
};

/** Session focuses each target may be added to. */
export const MUSCLE_REGION: Record<GapFillTarget, readonly Focus[]> = {
    side_delts: ['push', 'upper', 'full_body'],
    rear_delts: ['push', 'pull', 'upper', 'full_body'],
    biceps: ['pull', 'upper', 'full_body'],
    triceps: ['push', 'upper', 'full_body'],
    hamstrings: ['legs', 'lower', 'full_body'],
    glutes: ['legs', 'lower', 'full_body'],
    chest: ['push', 'upper', 'full_body'],
    lats: ['pull', 'upper', 'full_body'],
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
    // Isolation-only: never seat a compound as gap-fill (the contract). Matters for
    // chest/hamstrings/glutes, whose primary_muscle also rides on compounds (bench, RDL,
    // hip thrust); mirrors poolCanTrainMuscle's `!is_compound` gate.
    const candidates = usable.filter((e) => e.primary_muscle === muscle && !e.is_compound && !excludeIds.has(e.id));
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
    const dayCount = schedule.length;
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
    // The highest set count among the session's compounds (0 when it has none).
    const topCompoundSets = (key: string): number => {
        const sets = sessionRowsFor(key)
            .filter((e) => metaById.get(e.exercise_id)?.is_compound)
            .map((e) => Number(e.sets));
        return sets.length ? Math.max(...sets) : 0;
    };
    // Item 1 (set-inflation cap): a gap-fill-touched isolation may not out-set its
    // session's top compound, so a Face Pull can no longer sit at 6 while the day's press
    // sits at 3. Side / rear delts are EXEMPT (no compound trains them, so the
    // top-compound reference does not apply) and keep the 2*base per-exercise contribution
    // cap; a session with no compound also falls back to 2*base.
    const ISO_ONLY_MUSCLES = new Set<GapFillTarget>(['side_delts', 'rear_delts']);
    const isoSetCap = (muscle: GapFillTarget, key: string, base: number): number => {
        if (ISO_ONLY_MUSCLES.has(muscle)) return 2 * base;
        const top = topCompoundSets(key);
        return top > 0 ? Math.min(top, 2 * base) : 2 * base;
    };
    const sessionAddCount = new Map<string, number>(); // gap-fill inserts per session

    // Sessions eligible for a muscle, best-placement first.
    const pickSession = (muscle: GapFillTarget, allowOverTime: boolean, maxPerSession: number = PER_SESSION_ADD_CAP): string | null => {
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
            if ((sessionAddCount.get(key) ?? 0) >= maxPerSession) return false;
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
        return true;
    };

    // ---- Phase 1: eliminate zeros (trainable) ----
    // Item 2: a trainable-zero of a target muscle is the floor invariant, so clearing it
    // takes precedence over the tidy per-session insert cap that bounds Phase 2. On a
    // low-frequency plan (2-3 day) one insert per session cannot reach every zero, so
    // zero-kill may place up to 2 per session there; 4+ day plans have enough sessions to
    // spread at the normal cap. Bounded by its own routine cap so a thin 2-day plan fills
    // the worst zeros without overstuffing every muscle (some accessory zeros stay, by
    // design). Still allowed to overflow the time band (zero coverage is worse than a
    // long session). Snapshot is taken once; safe because seating an isolation for one
    // muscle never un-zeros a different muscle (the isolation pool is single-muscle).
    const zeroKillPerSession = dayCount === 2 || dayCount === 3 ? 2 : PER_SESSION_ADD_CAP;
    const zeroKillRoutineCap = Math.min(8, 2 * dayCount);
    const zeroTargets = GAP_FILL_TARGETS.filter((m) => direct()[m] === 0 && poolCanTrainMuscle(m, usable));
    let zeroKilled = 0;
    for (const muscle of zeroTargets) {
        if (zeroKilled >= zeroKillRoutineCap) break;
        const key = pickSession(muscle, true, zeroKillPerSession); // zero-kill may overflow time
        if (key && seat(muscle, key)) zeroKilled += 1;
    }

    // ---- Phase 2: distribute below-floor partials, balanced across sessions ----
    // Snapshot the tally once for ordering; ties break by declaration order.
    const postPhase1 = direct();
    const ordered = [...GAP_FILL_TARGETS].sort(
        (a, b) =>
            postPhase1[a] / coverageFloor(a, dayCount) - postPhase1[b] / coverageFloor(b, dayCount) ||
            GAP_FILL_TARGETS.indexOf(a) - GAP_FILL_TARGETS.indexOf(b),
    );
    // Direct sets of a muscle within one session.
    const muscleSetsInSession = (muscle: GapFillTarget, key: string) =>
        sessionRowsFor(key)
            .filter((e) => metaById.get(e.exercise_id)?.primary_muscle === muscle)
            .reduce((n, e) => n + Number(e.sets), 0);
    let partialInserted = 0; // Phase 2 inserts, bounded independently of Phase 1 zero-kills
    for (const muscle of ordered) {
        let guard = 0;
        while (guard++ < 80) {
            if (direct()[muscle] >= coverageFloor(muscle, dayCount)) break;
            // Eligible sessions for this muscle, lowest current representation first.
            const region = MUSCLE_REGION[muscle];
            const keys = schedule
                .map((s) => sessionKey(s.workout_type, s.variant))
                .filter((k) => {
                    const f = sessionCtx.get(k)?.focus;
                    return f && region.includes(f);
                })
                .sort((a, b) => muscleSetsInSession(muscle, a) - muscleSetsInSession(muscle, b));
            // Bump an existing isolation in `key` if it is under `capForKey` and the
            // weekly ceiling.
            const tryBump = (key: string, capForKey: number): boolean => {
                const bumpable = sessionRowsFor(key)
                    .filter(
                        (e) =>
                            metaById.get(e.exercise_id)?.primary_muscle === muscle &&
                            Number(e.sets) < capForKey &&
                            Number(e.sets) < GAP_FILL_SET_CEILING,
                    )
                    .sort((a, b) => Number(a.sets) - Number(b.sets))[0];
                if (bumpable && direct()[muscle] < GAP_FILL_SET_CEILING) {
                    bumpable.sets = String(Number(bumpable.sets) + 1);
                    return true;
                }
                return false;
            };
            // Insert a fresh isolation in `key` (budget + per-session cap + pattern cap +
            // time + pool gated).
            const tryInsert = (key: string): boolean => {
                if (
                    partialInserted < ROUTINE_ADD_CAP &&
                    (sessionAddCount.get(key) ?? 0) < PER_SESSION_ADD_CAP &&
                    sessionRowsFor(key).filter((e) => metaById.get(e.exercise_id)?.movement_pattern === ISO_PATTERN_FOR[muscle]).length < PATTERN_CAP &&
                    (bandMaxMin === null || sessionMinutes(key) < bandMaxMin) &&
                    seat(muscle, key)
                ) {
                    partialInserted += 1;
                    return true;
                }
                return false;
            };
            let acted = false;
            // Pass A (Item 1): keep isolations at/under the session's top compound,
            // preferring to spread to a fresh isolation over piling sets onto one.
            for (const key of keys) {
                const base = sessionCtx.get(key)?.baseSets ?? 3;
                if (tryBump(key, isoSetCap(muscle, key, base)) || tryInsert(key)) {
                    acted = true;
                    break;
                }
            }
            // Pass B: last resort, pile onto an existing isolation up to the 2*base
            // contribution cap so the floor stays reachable when no spread is possible
            // (e.g. a 30-min session with one low-set compound and a single isolation).
            if (!acted) {
                for (const key of keys) {
                    const base = sessionCtx.get(key)?.baseSets ?? 3;
                    if (tryBump(key, 2 * base)) {
                        acted = true;
                        break;
                    }
                }
            }
            if (!acted) break; // no eligible session can take more for this muscle
        }
    }
    return exercises;
}

/** Item 4: soft MRV ceiling. Returns a new exercises array with ACCESSORY (isolation)
 *  sets trimmed for any target muscle whose weekly direct volume exceeds its band max,
 *  one set at a time from the highest-set isolation down to a 2-set floor. Compounds are
 *  never trimmed (a split's structural compound volume is left to training-time deloads),
 *  so a muscle whose excess is all compound work simply stays over max (soft). No-op when
 *  no exercise carries a primary_muscle (synthetic / unattributed pool). Pure. */
export function trimToMrv(input: {
    exercises: Row[];
    schedule: RoutineBlueprint['schedule'];
    pool: ExerciseMeta[];
}): Row[] {
    const { schedule, pool } = input;
    const metaById = new Map(pool.map((e) => [e.id, e]));
    const exercises = input.exercises.map((e) => ({ ...e }));
    if (!exercises.some((e) => metaById.get(e.exercise_id)?.primary_muscle)) return exercises;
    const MIN_ISO_SETS = 2;
    const counts = weeklyMuscleSets({ schedule, exercises, warnings: [] }, pool);
    for (const target of Object.keys(MUSCLE_SET_TARGETS) as MuscleTarget[]) {
        const max = MUSCLE_SET_TARGETS[target].max;
        const underlying: Muscle[] = [target as Muscle]; // lats / upper_back are first-class now
        let current = underlying.reduce((n, m) => n + counts[m].direct, 0);
        let guard = 0;
        while (current > max && guard++ < 100) {
            const row = exercises
                .filter((e) => {
                    const m = metaById.get(e.exercise_id);
                    return (
                        m &&
                        !m.is_compound &&
                        m.primary_muscle != null &&
                        underlying.includes(m.primary_muscle) &&
                        Number(e.sets) > MIN_ISO_SETS
                    );
                })
                .sort((a, b) => Number(b.sets) - Number(a.sets) || a.exercise_id.localeCompare(b.exercise_id))[0];
            if (!row) break; // nothing left to trim safely (compounds carry the rest)
            row.sets = String(Number(row.sets) - 1);
            current -= 1;
        }
    }
    return exercises;
}
