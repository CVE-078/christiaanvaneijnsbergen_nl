import { PHASES } from './data';
import { BARBELL_KG, DUMBBELL_HANDLE_KG, PLATES_KG } from './constants';
import type {
    Phase,
    Logs,
    HistorySession,
    LogEntry,
    Unit,
    RoutineExercise,
    WorkoutType,
    BestSet,
    WorkoutSession,
    PRMap,
    ShareStats,
    ExerciseCategory,
    ExerciseItem,
} from './types';

// UUID v4 pattern used in new log keys
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORKOUT_LABELS: Partial<Record<WorkoutType, string>> = {
    push: 'Push Day',
    pull: 'Pull Day',
    legs: 'Leg Day',
    chest: 'Chest Day',
    back: 'Back Day',
    shoulders: 'Shoulder Day',
    arms: 'Arms Day',
    upper: 'Upper Day',
    lower: 'Lower Day',
    full_body: 'Full Body',
};

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

export function toDisplay(kg: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round(kg * KG_TO_LBS * 10) / 10;
    return kg;
}

export function toKg(value: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round((value / KG_TO_LBS) * 100) / 100;
    return value;
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

export function getPhase(week: number): Phase {
    return PHASES.find((p) => p.weeks.includes(week)) ?? PHASES[0];
}

export function getRIR(week: number): number {
    const phase = getPhase(week);
    const idx = phase.weeks.indexOf(week);
    return idx !== -1 ? phase.rir[idx] : phase.rir[0];
}

export function logKey(week: number, routineExerciseId: string, setIdx: number): string {
    return `${week}-${routineExerciseId}-${setIdx}`;
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

export function weekHasData(week: number, logs: Logs): boolean {
    const prefix = `${week}-`;
    return Object.keys(logs).some((k) => k.startsWith(prefix) && logs[k]?.saved);
}

export function buildHistory(logs: Logs): HistorySession[] {
    const sessions: Record<string, HistorySession> = {};

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        // New format: "<week>-<routineExerciseId>-<setIdx>"
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId, setIdx } = parsed;
        // Group by week only — type is no longer encoded in the key
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

    const baseLabel = WORKOUT_LABELS[session.workout_type as WorkoutType] ?? session.workout_type;
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

// Sum saved working sets per exercise category for a single week.
export function computePerMuscleVolume(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): Partial<Record<ExerciseCategory, number>> {
    const catById = new Map<string, ExerciseCategory>();
    for (const re of routineExercises) {
        if (re.exercise?.category) catById.set(re.id, re.exercise.category);
    }
    const out: Partial<Record<ExerciseCategory, number>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        const cat = catById.get(parsed.routineExerciseId);
        if (!cat) continue;
        out[cat] = (out[cat] ?? 0) + 1;
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
