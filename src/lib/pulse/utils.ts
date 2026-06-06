import { buildProgram } from './data';
import { secondarySets } from './muscleMap';
import {
    BARBELL_KG,
    DUMBBELL_HANDLE_KG,
    PLATES_KG,
    WORKOUT_TYPE_ORDER,
    workoutTypeLabelLong,
    DELOAD_FACTOR,
    DELOAD_REBUILD_WEEKS,
    DELOAD_DROP_THRESHOLD,
} from './constants';
import type {
    Phase,
    Logs,
    HistorySession,
    LogEntry,
    Unit,
    LengthUnit,
    PriorityMuscle,
    RoutineExercise,
    WorkoutType,
    TabKey,
    BestSet,
    WorkoutSession,
    PRMap,
    ShareStats,
    ExerciseCategory,
    MovementPattern,
    VolumeTargetRow,
    RecoveryStatus,
    RecoveryDetail,
    ExerciseItem,
    LastSession,
    DbExercise,
    Swaps,
    Trend,
    RecompReadout,
    BodyweightEntry,
    BodyMeasurement,
    DecisionEvent,
} from './types';

// UUID v4 pattern used in new log keys
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Strip the optional `:variant` suffix off a TabKey to get its base workout type.
export function baseWorkoutType(key: TabKey): WorkoutType {
    return (key.includes(':') ? key.split(':')[0] : key) as WorkoutType;
}

// Order TabKeys for tab rendering: by base workout_type order, then A before B
// (so 'push:A' precedes 'push:B'). Single source for WorkoutTabs and the
// provider's activeTab clamp so they never disagree on the first tab.
export function compareTabKeys(a: TabKey, b: TabKey): number {
    const orderA = WORKOUT_TYPE_ORDER.indexOf(baseWorkoutType(a));
    const orderB = WORKOUT_TYPE_ORDER.indexOf(baseWorkoutType(b));
    if (orderA !== orderB) return orderA - orderB;
    return a < b ? -1 : 1;
}

export function orderTabKeys(keys: TabKey[]): TabKey[] {
    return [...keys].sort(compareTabKeys);
}

// Roll a granular workout type up toward its broadest parent. Full-body routines
// schedule a single `full_body` session but tag their exercises push/pull/legs, so
// those must collapse to `full_body`; upper/lower and PPL splits already match the
// session they belong to. Used to group the routine editor by real sessions.
const WORKOUT_TYPE_PARENT: Partial<Record<WorkoutType, WorkoutType>> = {
    chest: 'push',
    shoulders: 'push',
    arms: 'upper',
    back: 'pull',
    push: 'upper',
    pull: 'upper',
    legs: 'lower',
    upper: 'full_body',
    lower: 'full_body',
};

// Map an exercise's workout type to the session type the routine actually uses,
// walking up the parent chain until it hits one of `sessionTypes`. Falls back to
// the exercise's own type when the routine has no schedule to anchor sessions.
export function sessionTypeFor(type: WorkoutType, sessionTypes: WorkoutType[]): WorkoutType {
    if (sessionTypes.length === 0) return type;
    let cur: WorkoutType | undefined = type;
    const seen = new Set<WorkoutType>();
    while (cur && !seen.has(cur)) {
        if (sessionTypes.includes(cur)) return cur;
        seen.add(cur);
        cur = WORKOUT_TYPE_PARENT[cur];
    }
    return sessionTypes[0];
}

export const MIN_KG = 0.5;
export const MAX_KG = 500;
export const KG_TO_LBS = 2.20462;
export const CM_TO_IN = 1 / 2.54;

export function toDisplay(kg: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round(kg * KG_TO_LBS * 10) / 10;
    return kg;
}

export function toKg(value: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round((value / KG_TO_LBS) * 100) / 100;
    return value;
}

// Length conversion, mirroring toDisplay/toKg for weight. Measurements are
// stored canonically in cm; these convert for display ('in') and back to cm on
// input. A 'cm' unit is the identity so existing data needs no migration.
export function toLengthDisplay(cm: number, unit: LengthUnit): number {
    if (unit === 'in') return Math.round(cm * CM_TO_IN * 10) / 10;
    return cm;
}

export function toCm(value: number, unit: LengthUnit): number {
    if (unit === 'in') return Math.round((value / CM_TO_IN) * 100) / 100;
    return value;
}

// Parse a user-entered numeric string, accepting both '.' and ',' as the decimal
// separator. European keyboards/locales produce "2,5", which bare parseFloat
// truncates to 2 and silently corrupts the logged weight; we normalize the comma
// first. Returns NaN for empty/invalid input.
export function parseDecimalInput(s: string): number {
    if (typeof s !== 'string') return NaN;
    const normalized = s.trim().replace(',', '.');
    if (normalized === '') return NaN;
    return parseFloat(normalized);
}

export function getInitials(name: string, max = 3): string {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map((w) => w[0].toUpperCase())
        .join('');
}

// Map an absolute week into its 1-based position within a repeating block of
// `weeks` length: week 13 in a 12-week block → week 1 of block 2.
export function weekInBlock(week: number, weeks: number): number {
    return ((((week - 1) % weeks) + weeks) % weeks) + 1;
}

// Phase for a week, given the block length (default 12 = legacy behavior). Weeks
// beyond the block length wrap, since the program repeats.
export function getPhase(week: number, weeks = 12): Phase {
    const { phases } = buildProgram(weeks);
    const w = weekInBlock(week, weeks);
    return phases.find((p) => p.weeks.includes(w)) ?? phases[0];
}

export function getRIR(week: number, weeks = 12): number {
    const w = weekInBlock(week, weeks);
    const phase = getPhase(week, weeks);
    const idx = phase.weeks.indexOf(w);
    return idx !== -1 ? phase.rir[idx] : phase.rir[0];
}

// Planned working-set volume for a week within a (repeating) block.
export function volumeForWeek(week: number, weeks = 12): number {
    const { volume } = buildProgram(weeks);
    const w = weekInBlock(week, weeks);
    return volume.find((v) => v.week === w)?.sets ?? volume[0]?.sets ?? 0;
}

// A lift is plateaued when its best e1RM has not improved across the last
// `recentWeeks` logged weeks (no new high vs everything before them). Takes the
// e1RM history (from computeE1RMHistory) to stay decoupled and pure. Needs more
// than `recentWeeks` of history before it can call a stall.
export function computePlateau(history: Array<{ week: number; e1rm: number }>, recentWeeks = 3): boolean {
    if (history.length < recentWeeks + 1) return false;
    const sorted = [...history].sort((a, b) => a.week - b.week);
    const recent = sorted.slice(-recentWeeks);
    const prior = sorted.slice(0, -recentWeeks);
    const priorBest = Math.max(...prior.map((h) => h.e1rm));
    const recentBest = Math.max(...recent.map((h) => h.e1rm));
    return recentBest <= priorBest;
}

// True when a recent consecutive e1RM drop indicates the lift was just deloaded
// (and is now rebuilding), so we should not deload it again yet. Looks at the
// last `withinWeeks + 1` logged points (= `withinWeeks` consecutive pairs); a
// drop of at least (1 - DELOAD_DROP_THRESHOLD) between two points counts.
export function recentDrop(
    history: Array<{ week: number; e1rm: number }>,
    withinWeeks = DELOAD_REBUILD_WEEKS,
): boolean {
    const tail = [...history].sort((a, b) => a.week - b.week).slice(-(withinWeeks + 1));
    for (let i = 1; i < tail.length; i++) {
        if (tail[i].e1rm < tail[i - 1].e1rm * DELOAD_DROP_THRESHOLD) return true;
    }
    return false;
}

// A stalled lift should auto-deload only when it has plateaued AND has not just
// deloaded (so it deloads once, then rebuilds for ~DELOAD_REBUILD_WEEKS weeks).
export function shouldDeload(history: Array<{ week: number; e1rm: number }>): boolean {
    return computePlateau(history) && !recentDrop(history);
}

// The deloaded target for a stalled lift's set: DELOAD_FACTOR of the previous
// weight (rounded to the 2.5 grid the progression uses, floored at MIN_KG), with
// reps reset to the bottom of the rep range. Null when there is no prior set.
export function deloadTarget(
    previousEntry: LogEntry | undefined,
    repsRange: string,
): { kg: number; reps: number } | null {
    if (!previousEntry) return null;
    const nums = (repsRange.match(/\d+/g) ?? []).map(Number);
    const reps = nums.length ? nums[0] : previousEntry.reps;
    const kg = Math.max(MIN_KG, Math.round((previousEntry.kg * DELOAD_FACTOR) / 2.5) * 2.5);
    return { kg, reps };
}

// The adaptive decision the engine made for one lift in one week, ready to log
// as a DecisionEvent, or null when no tracked decision applies. Pure mirror of
// what ExerciseCard/SetLogger already compute on render: a stall auto-deloads
// (deload wins, matching `deloadTgt ?? progression`), otherwise hitting the
// prescribed RIR advances the lift (double progression). A set logged *harder*
// than planned backs the weight off but is autoregulation, not a tracked
// decision, so it returns null. Inputs are passed in (e1RM history, the prior
// week's set) to keep this decoupled and unit-testable.
export function decisionForExercise(args: {
    routineExerciseId: string;
    week: number;
    e1rmHistory: Array<{ week: number; e1rm: number }>;
    previousEntry: LogEntry | undefined;
    repsRange: string;
}): DecisionEvent | null {
    const { routineExerciseId, week, e1rmHistory, previousEntry, repsRange } = args;
    if (!previousEntry || week <= 1) return null;

    if (shouldDeload(e1rmHistory)) {
        const tgt = deloadTarget(previousEntry, repsRange);
        if (tgt) {
            return {
                type: 'deload',
                trigger: 'plateau',
                affectedArea: routineExerciseId,
                week,
                magnitude: { fromKg: previousEntry.kg, toKg: tgt.kg },
                confidence: null,
            };
        }
    }

    // Progression fires only when the prior set met or beat its prescribed RIR
    // (the same condition that separates an advance from a back-off inside
    // computeProgression). Otherwise the engine is reducing load, not progressing.
    if (previousEntry.rir >= getRIR(week - 1)) {
        const prog = computeProgression(previousEntry, repsRange, week);
        if (prog) {
            return {
                type: 'progression',
                trigger: 'targets_hit',
                affectedArea: routineExerciseId,
                week,
                magnitude: {
                    fromKg: previousEntry.kg,
                    toKg: prog.kg,
                    fromReps: previousEntry.reps,
                    toReps: prog.reps,
                },
                confidence: null,
            };
        }
    }

    return null;
}

export function logKey(week: number, routineExerciseId: string, setIdx: number): string {
    return `${week}-${routineExerciseId}-${setIdx}`;
}

// Key for the per-(week, slot) exercise swap map. Mirrors the Notes keying.
export function swapKey(week: number, routineExerciseId: string): string {
    return `${week}-${routineExerciseId}`;
}

// Candidate replacements for a swap: same movement pattern, excluding the
// original and any excluded ids (hidden + already in this session). Sorted by
// equipment overlap with the original (desc), then name. Exercises with no
// movement pattern are dropped.
export function swapCandidates(
    original: DbExercise,
    exercises: DbExercise[],
    opts: { excludeIds: Set<string> },
): DbExercise[] {
    const pattern = original.movement_pattern;
    if (!pattern) return [];
    const origEquip = new Set(original.equipment ?? []);
    const overlap = (e: DbExercise) => (e.equipment ?? []).filter((x) => origEquip.has(x)).length;
    return exercises
        .filter((e) => e.id !== original.id && !opts.excludeIds.has(e.id) && e.movement_pattern === pattern)
        .sort((a, b) => {
            const d = overlap(b) - overlap(a);
            return d !== 0 ? d : a.name.localeCompare(b.name);
        });
}

// Resolve the exercise a slot displays for a given week. A week-scoped swap
// overrides the slot's default exercise; falls back to the original if no swap
// exists or the substitute is gone (deleted/hidden).
export function resolveExercise(
    re: RoutineExercise,
    week: number,
    swaps: Swaps,
    exercisesById: Map<string, DbExercise>,
): DbExercise {
    const subId = swaps[swapKey(week, re.id)];
    if (!subId) return re.exercise;
    return exercisesById.get(subId) ?? re.exercise;
}

// Parse a log key of the form "<week>-<routineExerciseId>-<setIdx>".
// week is the number before the first '-', routineExerciseId is the slice
// between the first and last '-', setIdx is the number after the last '-'.
// Returns null when the structure is wrong, the middle is not a valid UUID,
// or either numeric segment is NaN.
export function parseLogKey(key: string): { week: number; routineExerciseId: string; setIdx: number } | null {
    const firstDash = key.indexOf('-');
    const lastDash = key.lastIndexOf('-');
    if (firstDash === -1 || lastDash === firstDash) return null;
    const routineExerciseId = key.slice(firstDash + 1, lastDash);
    if (!UUID_RE.test(routineExerciseId)) return null;
    const week = Number(key.slice(0, firstDash));
    const setIdx = Number(key.slice(lastDash + 1));
    if (isNaN(week) || isNaN(setIdx)) return null;
    return { week, routineExerciseId, setIdx };
}

export function parseMaxSets(s: string): number {
    const n = parseInt(s.split(/[–-]/).pop() ?? s, 10);
    return isNaN(n) ? 3 : n;
}

export function calcE1RM(kg: number, reps: number): number {
    return kg * (1 + reps / 30);
}

// A bodyweight exercise carries no equipment (empty/absent equipment array), so
// weight is optional when logging and progression is rep-based. Single source of
// truth for the "is this bodyweight?" rule used by SetLogger and the train cards.
export function isBodyweight(equipment: string[] | null | undefined): boolean {
    return (equipment?.length ?? 0) === 0;
}

export function computePRMap(logs: Logs): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        // New format: "<week>-<uuid>-<setIdx>"
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { routineExerciseId } = parsed;
        const e = calcE1RM(val.kg, val.reps);
        if (e > (map[routineExerciseId] ?? 0)) map[routineExerciseId] = e;
    }
    return map;
}

export function computeStreak(logs: Logs): number {
    const loggedWeeks = new Set(
        Object.entries(logs)
            .filter(([, v]) => v?.saved)
            .map(([k]) => parseInt(k.split('-')[0], 10))
            .filter((w) => !isNaN(w)),
    );
    if (loggedWeeks.size === 0) return 0;
    const maxWeek = Math.max(...loggedWeeks);
    let streak = 0;
    for (let w = maxWeek; w >= 1; w--) {
        if (loggedWeeks.has(w)) streak++;
        else break;
    }
    return streak;
}

export function computeSuggestion(previousEntry: LogEntry | undefined, week: number): number | null {
    if (!previousEntry || week <= 1) return null;
    const prevTargetRIR = getRIR(week - 1);
    if (previousEntry.rir > prevTargetRIR) return previousEntry.kg + 2.5;
    if (previousEntry.rir === prevTargetRIR) return previousEntry.kg;
    return Math.max(previousEntry.kg - 2.5, MIN_KG);
}

// Double progression: climb reps inside the rep range first, then add weight and
// reset to the bottom of the range. Compares the current set to the same set's
// previous session (previousEntry). Returns the next target { kg, reps }, or null
// when there is no history to progress from (week 1 / no previous entry).
//   - Harder than planned (rir < targetRIR)      -> deload weight, reps = lo
//   - Met/beat and at the top of the range        -> +2.5 kg, reps = lo
//   - Met/beat and mid-range                       -> same kg, reps + 1 (capped at hi)
// A single-number rep target (lo === hi) reduces to linear weight progression.
export function computeProgression(
    previousEntry: LogEntry | undefined,
    repsRange: string,
    week: number,
    bodyweight = false,
): { kg: number; reps: number } | null {
    if (!previousEntry || week <= 1) return null;
    const targetRIR = getRIR(week - 1);
    const nums = (repsRange.match(/\d+/g) ?? []).map(Number);
    const lo = nums.length ? nums[0] : previousEntry.reps;
    const hi = nums.length ? nums[nums.length - 1] : previousEntry.reps;
    // Bodyweight progression is rep-based: there is no external load to add, so
    // keep whatever was used (0 for pure bodyweight, or any added load) and aim
    // for one more rep. A set harder than target eases back to the range bottom.
    if (bodyweight) {
        if (previousEntry.rir < targetRIR) return { kg: previousEntry.kg, reps: lo };
        return { kg: previousEntry.kg, reps: previousEntry.reps + 1 };
    }
    if (previousEntry.rir < targetRIR) {
        return { kg: Math.max(previousEntry.kg - 2.5, MIN_KG), reps: lo };
    }
    if (previousEntry.reps >= hi) {
        return { kg: previousEntry.kg + 2.5, reps: lo };
    }
    return { kg: previousEntry.kg, reps: Math.min(previousEntry.reps + 1, hi) };
}

export function weekHasData(week: number, logs: Logs): boolean {
    const prefix = `${week}-`;
    return Object.keys(logs).some((k) => k.startsWith(prefix) && logs[k]?.saved);
}

// One pass over logs returning the set of weeks that have at least one saved set.
// Lets the 12-week strips do O(1) `.has(week)` lookups instead of scanning all
// logs once per week (which `weekHasData` does per call).
export function computeWeeksWithData(logs: Logs): Set<number> {
    const set = new Set<number>();
    for (const key of Object.keys(logs)) {
        if (!logs[key]?.saved) continue;
        const firstDash = key.indexOf('-');
        if (firstDash === -1) continue;
        const week = Number(key.slice(0, firstDash));
        if (!isNaN(week)) set.add(week);
    }
    return set;
}

export function buildHistory(logs: Logs): HistorySession[] {
    const sessions: Record<string, HistorySession> = {};

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        // New format: "<week>-<routineExerciseId>-<setIdx>"
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId, setIdx } = parsed;
        // Group by week only, type is no longer encoded in the key
        const sessionKey = String(week);
        if (!sessions[sessionKey]) {
            sessions[sessionKey] = { week, sets: [] };
        }
        sessions[sessionKey].sets.push({ routineExerciseId, setIdx, ...val });
    }

    return Object.values(sessions).sort((a, b) => b.week - a.week);
}

export function computeVolumeByTypeAndWeek(
    logs: Logs,
    routineExercises: RoutineExercise[],
): Record<number, Partial<Record<WorkoutType, number>>> {
    const typeMap = new Map<string, WorkoutType>(routineExercises.map((re) => [re.id, re.workout_type]));
    const result: Record<number, Partial<Record<WorkoutType, number>>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId } = parsed;
        const wt = typeMap.get(routineExerciseId);
        if (!wt) continue;
        if (!result[week]) result[week] = {};
        result[week][wt] = (result[week][wt] ?? 0) + 1;
    }
    return result;
}

export function computeE1RMHistory(logs: Logs, routineExerciseId: string): Array<{ week: number; e1rm: number }> {
    const weekBest: Record<number, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        if (parsed.routineExerciseId !== routineExerciseId) continue;
        const { week } = parsed;
        const e1rm = calcE1RM(val.kg, val.reps);
        if (e1rm > (weekBest[week] ?? 0)) weekBest[week] = e1rm;
    }
    return Object.entries(weekBest)
        .map(([w, e1rm]) => ({ week: Number(w), e1rm }))
        .sort((a, b) => a.week - b.week);
}

export function computeBestSets(logs: Logs): Record<string, BestSet> {
    const best: Record<string, BestSet> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId } = parsed;
        const e1rm = calcE1RM(val.kg, val.reps);
        if (!best[routineExerciseId] || e1rm > best[routineExerciseId].e1rm) {
            best[routineExerciseId] = {
                routineExerciseId,
                week,
                kg: val.kg,
                reps: val.reps,
                e1rm,
            };
        }
    }
    return best;
}

export function computeWarmupSets(
    workingWeightKg: number,
    unit: Unit,
): Array<{ percent: number; displayWeight: number; reps: number }> {
    if (workingWeightKg < 40) return [];
    return [
        { percent: 50, reps: 5 },
        { percent: 65, reps: 3 },
        { percent: 80, reps: 1 },
    ].map(({ percent, reps }) => {
        const roundedKg = Math.round((workingWeightKg * percent) / 100 / 2.5) * 2.5;
        const display = toDisplay(roundedKg, unit);
        const displayWeight = unit === 'lbs' ? Math.round(display / 5) * 5 : display;
        return { percent, displayWeight, reps };
    });
}

export function computeLastSession(
    logs: Logs,
    routineExerciseId: string,
    currentWeek: number,
): { kg: number; reps: number; setCount: number } | null {
    const byWeek = new Map<number, Array<{ kg: number; reps: number }>>();

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId: rid } = parsed;
        if (week >= currentWeek) continue;
        if (rid !== routineExerciseId) continue;
        if (!byWeek.has(week)) byWeek.set(week, []);
        byWeek.get(week)!.push({ kg: val.kg, reps: val.reps });
    }

    if (byWeek.size === 0) return null;
    const latestWeek = Math.max(...byWeek.keys());
    const sets = byWeek.get(latestWeek)!;
    return { kg: sets[0].kg, reps: sets[0].reps, setCount: sets.length };
}

// Last-session lookup for every exercise in a single pass, so a screen with N
// exercise cards builds them all in O(logs) instead of each card scanning the
// whole log set (O(logs) per card). Mirrors computeLastSession per exercise.
export function computeLastSessionMap(logs: Logs, currentWeek: number): Map<string, LastSession> {
    const byRidWeek = new Map<string, Map<number, Array<{ kg: number; reps: number }>>>();
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId: rid } = parsed;
        if (week >= currentWeek) continue;
        let weeks = byRidWeek.get(rid);
        if (!weeks) {
            weeks = new Map();
            byRidWeek.set(rid, weeks);
        }
        if (!weeks.has(week)) weeks.set(week, []);
        weeks.get(week)!.push({ kg: val.kg, reps: val.reps });
    }

    const result = new Map<string, LastSession>();
    for (const [rid, weeks] of byRidWeek) {
        const latestWeek = Math.max(...weeks.keys());
        const sets = weeks.get(latestWeek)!;
        result.set(rid, { kg: sets[0].kg, reps: sets[0].reps, setCount: sets.length });
    }
    return result;
}

export function computeShareStats(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
): ShareStats {
    const startMs = new Date(session.started_at).getTime();
    const endMs = new Date(completedAt).getTime();
    const diff = endMs - startMs;
    const durationMin = isNaN(diff) || diff < 0 ? 0 : Math.floor(diff / 60000);

    const baseLabel = workoutTypeLabelLong(session.workout_type as WorkoutType);
    const workoutLabel = session.variant ? `${baseLabel} · Variant ${session.variant}` : baseLabel;

    const date = new Date(completedAt).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    const exerciseIds = new Set(exercises.map((e) => e.id));
    const nameMap = new Map(exercises.map((e) => [e.id, e.exercise.name]));
    const bestByExercise = new Map<string, { kg: number; reps: number; e1rm: number }>();
    let totalSets = 0;

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week: w, routineExerciseId: rid } = parsed;
        if (w !== week) continue;
        if (!exerciseIds.has(rid)) continue;
        totalSets++;
        const e1rm = calcE1RM(val.kg, val.reps);
        const existing = bestByExercise.get(rid);
        if (!existing || e1rm > existing.e1rm) {
            bestByExercise.set(rid, { kg: val.kg, reps: val.reps, e1rm });
        }
    }

    const allLifts = [...bestByExercise.entries()]
        .sort(([, a], [, b]) => b.e1rm - a.e1rm)
        .map(([rid, { kg, reps, e1rm }]) => {
            const isPR = (prMap[rid] ?? 0) > 0 && e1rm >= prMap[rid];
            return {
                name: nameMap.get(rid) ?? rid,
                displayWeight: toDisplay(kg, unit),
                reps,
                isPR,
            };
        });

    return {
        workoutLabel,
        date,
        durationMin,
        totalSets,
        topLifts: allLifts.slice(0, 3),
        prCount: allLifts.filter((l) => l.isPR).length,
    };
}

// Mirrors the PR check inside computeShareStats: a set is a PR when its
// estimated 1RM meets or beats the recorded best for the exercise.
export function isSetPR(kg: number, reps: number, routineExerciseId: string, prMap: PRMap): boolean {
    if (kg <= 0 || reps <= 0) return false;
    const best = prMap[routineExerciseId] ?? 0;
    if (best <= 0) return false;
    return calcE1RM(kg, reps) >= best;
}

// Fractional-set per-muscle accumulation for one week, shared by the volume and
// recovery readouts so they apply the SAME attribution. Each saved set credits its
// exercise's category 1.0 (the primary), then, when the exercise has a movement
// pattern, the pattern's bucketed secondaries (muscleMap.secondarySets) on top, so
// a bench press also credits triceps/shoulders. RIR is credited at full weight to
// every touched category with a per-category count, so avgRir stays a true RIR
// average rather than a fractional one. Exercises with no movement_pattern (user-
// created, or an unseeded row) fall back to primary-only.
export function accumulatePerMuscle(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): {
    volume: Partial<Record<ExerciseCategory, number>>;
    rirSum: Partial<Record<ExerciseCategory, number>>;
    rirCount: Partial<Record<ExerciseCategory, number>>;
} {
    const catById = new Map<string, ExerciseCategory>();
    const patternById = new Map<string, MovementPattern>();
    for (const re of routineExercises) {
        if (re.exercise?.category) catById.set(re.id, re.exercise.category);
        if (re.exercise?.movement_pattern) patternById.set(re.id, re.exercise.movement_pattern);
    }
    const volume: Partial<Record<ExerciseCategory, number>> = {};
    const rirSum: Partial<Record<ExerciseCategory, number>> = {};
    const rirCount: Partial<Record<ExerciseCategory, number>> = {};
    const credit = (cat: ExerciseCategory, sets: number, rir: number) => {
        volume[cat] = (volume[cat] ?? 0) + sets;
        rirSum[cat] = (rirSum[cat] ?? 0) + rir;
        rirCount[cat] = (rirCount[cat] ?? 0) + 1;
    };
    for (const [key, val] of Object.entries(logs)) {
        if (!val.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        const cat = catById.get(parsed.routineExerciseId);
        if (!cat) continue;
        credit(cat, 1, val.rir);
        const pattern = patternById.get(parsed.routineExerciseId);
        if (pattern) {
            for (const [secCat, frac] of Object.entries(secondarySets(pattern, cat)) as [ExerciseCategory, number][]) {
                credit(secCat, frac, val.rir);
            }
        }
    }
    return { volume, rirSum, rirCount };
}

// Fractional working sets per exercise category for a single week (primary 1.0 plus
// bucketed pattern secondaries). Values are non-integer.
export function computePerMuscleVolume(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): Partial<Record<ExerciseCategory, number>> {
    return accumulatePerMuscle(logs, routineExercises, week).volume;
}

// Display rounding for fractional set counts: nearest 0.5. Shared by the volume
// bars and recovery chips so the same muscle never reads two different values.
export function roundSets(n: number): number {
    return Math.round(n * 2) / 2;
}

// The exercise categories a muscle priority bumps. 'arms' covers biceps + triceps.
const PRIORITY_TARGET_CATEGORIES: Record<PriorityMuscle, ExerciseCategory[]> = {
    glutes: ['glutes'],
    legs: ['legs'],
    chest: ['chest'],
    back: ['back'],
    shoulders: ['shoulders'],
    arms: ['biceps', 'triceps'],
};

const PRIORITY_TARGET_BUMP = 2;

// Raise the weekly set target band for the prioritized muscle so the Progress
// recovery/volume nudges stay coherent with a routine generated under that
// priority. Identity for a null priority; only bumps categories already in the
// base targets.
export function priorityAdjustedTargets(
    base: Partial<Record<ExerciseCategory, [number, number]>>,
    priority: PriorityMuscle | null,
): Partial<Record<ExerciseCategory, [number, number]>> {
    if (!priority) return base;
    const out: Partial<Record<ExerciseCategory, [number, number]>> = { ...base };
    for (const cat of PRIORITY_TARGET_CATEGORIES[priority]) {
        const range = base[cat];
        if (range) out[cat] = [range[0] + PRIORITY_TARGET_BUMP, range[1] + PRIORITY_TARGET_BUMP];
    }
    return out;
}

// One-line plain-language explanation of the priority-muscle volume tilt, shown
// next to the per-muscle volume bars. Null when there is no tilt (no priority /
// balanced), so the caller renders nothing. Takes the already-resolved priority
// (use resolvePriority on the raw profile value first).
export function priorityFocusLine(priority: PriorityMuscle | null): string | null {
    if (!priority) return null;
    const label = priority.charAt(0).toUpperCase() + priority.slice(1);
    return `${label} volume raised, your training priority.`;
}

// Per-muscle progress toward weekly set targets. Rows cover every targeted
// muscle (even at 0 sets); toGo is the sets still needed to reach the floor.
// Sorted lagging-first (highest toGo), then alphabetically for stability.
export function computeVolumeProgress(
    volume: Partial<Record<ExerciseCategory, number>>,
    targets: Partial<Record<ExerciseCategory, [number, number]>>,
): VolumeTargetRow[] {
    const rows: VolumeTargetRow[] = [];
    for (const [category, range] of Object.entries(targets) as Array<[ExerciseCategory, [number, number]]>) {
        const [min, max] = range;
        const actual = volume[category] ?? 0;
        rows.push({ category, actual, min, max, toGo: Math.max(0, min - actual) });
    }
    rows.sort((a, b) => b.toGo - a.toGo || a.category.localeCompare(b.category));
    return rows;
}

// Pairs weekly per-muscle volume with RIR to flag recovery status per targeted
// muscle. Resolves each set's category exactly like computePerMuscleVolume
// (re.exercise.category keyed by re.id), in one pass over the week's saved sets.
// Returns a status for every category present in `targets`, so it aligns 1:1
// with the rows computeVolumeProgress renders. Pure and deterministic.
export function computeRecoveryFlags(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
    targets: Partial<Record<ExerciseCategory, [number, number]>>,
): Partial<Record<ExerciseCategory, RecoveryDetail>> {
    const { volume, rirSum, rirCount } = accumulatePerMuscle(logs, routineExercises, week);
    const out: Partial<Record<ExerciseCategory, RecoveryDetail>> = {};
    for (const [category, range] of Object.entries(targets) as Array<[ExerciseCategory, [number, number]]>) {
        const [min, max] = range;
        const count = volume[category] ?? 0;
        const rc = rirCount[category] ?? 0;
        const avgRir = rc > 0 ? (rirSum[category] ?? 0) / rc : null;
        let status: RecoveryStatus;
        if (count < min) {
            status = 'under';
        } else if (count > max) {
            status = 'overreaching';
        } else {
            status = avgRir !== null && avgRir <= 0.5 ? 'high_fatigue' : 'optimal';
        }
        out[category] = { status, sets: count, avgRir, min, max, toGo: Math.max(0, min - count) };
    }
    return out;
}

export type PlateEquipment = 'barbell' | 'dumbbell';
export interface PlateResult {
    perSide: number[];
    achievable: boolean;
    remainderKg: number;
}

// Greedy per-side plate breakdown for a target weight on a barbell or a single
// dumbbell handle. achievable is false when the target sits below the empty
// bar/handle or leaves a remainder the available plates cannot fill.
export function computePlates(targetKg: number, equipment: PlateEquipment): PlateResult {
    const base = equipment === 'barbell' ? BARBELL_KG : DUMBBELL_HANDLE_KG;
    if (targetKg < base) return { perSide: [], achievable: false, remainderKg: 0 };
    let perSideKg = (targetKg - base) / 2;
    const perSide: number[] = [];
    for (const plate of PLATES_KG) {
        while (perSideKg >= plate - 1e-9) {
            perSide.push(plate);
            perSideKg = Math.round((perSideKg - plate) * 100) / 100;
        }
    }
    const remainderKg = Math.round(perSideKg * 100) / 100;
    return { perSide, achievable: remainderKg === 0, remainderKg };
}

// Overall strength proxy per week = sum of best E1RM across all slots that week.
export function computeStrengthByWeek(logs: Logs): Array<{ week: number; total: number }> {
    const bestPerSlotPerWeek = new Map<string, number>(); // `${week}|${reId}` -> best e1rm
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const k = `${parsed.week}|${parsed.routineExerciseId}`;
        const e = calcE1RM(val.kg, val.reps);
        if (e > (bestPerSlotPerWeek.get(k) ?? 0)) bestPerSlotPerWeek.set(k, e);
    }
    const totals = new Map<number, number>();
    for (const [k, e] of bestPerSlotPerWeek) {
        const week = Number(k.split('|')[0]);
        totals.set(week, (totals.get(week) ?? 0) + e);
    }
    return [...totals.entries()].map(([week, total]) => ({ week, total })).sort((a, b) => a.week - b.week);
}

function trendOf(delta: number, band: number): Trend {
    if (delta < -band) return 'down';
    if (delta > band) return 'up';
    return 'flat';
}

// Combine bodyweight, waist, and overall-strength trends into a recomp readout.
// Compares the latest value to the earliest in each series (chronological).
export function computeRecompSignal(args: {
    bodyweight: BodyweightEntry[];
    measurements: BodyMeasurement[];
    strengthByWeek: Array<{ week: number; total: number }>;
}): RecompReadout {
    const bw = [...args.bodyweight].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
    const waistPts = args.measurements
        .filter((m) => m.waist_cm != null)
        .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    const str = [...args.strengthByWeek].filter((s) => s.total > 0).sort((a, b) => a.week - b.week);

    let weight: Trend = 'none',
        weightDeltaKg: number | null = null;
    if (bw.length >= 2) {
        weightDeltaKg = bw[bw.length - 1].weight_kg - bw[0].weight_kg;
        weight = trendOf(weightDeltaKg, 0.5);
    }

    let waist: Trend = 'none',
        waistDeltaCm: number | null = null;
    if (waistPts.length >= 2) {
        waistDeltaCm = (waistPts[waistPts.length - 1].waist_cm as number) - (waistPts[0].waist_cm as number);
        waist = trendOf(waistDeltaCm, 0.5);
    }

    let strength: Trend = 'none',
        strengthDeltaPct: number | null = null;
    if (str.length >= 2 && str[0].total > 0) {
        strengthDeltaPct = ((str[str.length - 1].total - str[0].total) / str[0].total) * 100;
        strength = trendOf(strengthDeltaPct, 2);
    }

    const weightOk = weight === 'flat' || weight === 'down';
    const isRecomping = strength === 'up' && weightOk && waist === 'down';

    let verdict: string;
    if (weight === 'none' && strength === 'none' && waist === 'none') {
        verdict = 'Keep logging to see your recomp trend.';
    } else if (isRecomping) {
        verdict = `You're recomping: strength up, weight ${weight === 'down' ? 'down' : 'steady'}, waist down.`;
    } else if (strength === 'up' && weightOk && waist === 'none') {
        verdict = 'Likely recomping, strength up and weight steady. Log your waist to confirm.';
    } else if (strength === 'up' && weight === 'up') {
        verdict = 'Gaining: strength up but weight up too. Tighten nutrition if fat loss is the goal.';
    } else if ((strength === 'flat' || strength === 'down') && weight === 'down') {
        verdict = 'Cutting: weight down but strength flat. Hold protein and keep intensity up.';
    } else if (strength === 'down' && weight === 'up') {
        verdict = 'Strength dipping while weight rises, check recovery and nutrition.';
    } else {
        verdict = 'Keep logging to see your recomp trend.';
    }

    return { weight, strength, waist, isRecomping, verdict, weightDeltaKg, strengthDeltaPct, waistDeltaCm };
}

export function groupExercises(exercises: RoutineExercise[]): ExerciseItem[] {
    const items: ExerciseItem[] = [];
    let i = 0;
    while (i < exercises.length) {
        const re = exercises[i];
        if (
            re.superset_group_id !== null &&
            i + 1 < exercises.length &&
            exercises[i + 1].superset_group_id === re.superset_group_id
        ) {
            items.push([re, exercises[i + 1]]);
            i += 2;
        } else {
            items.push(re);
            i++;
        }
    }
    return items;
}
