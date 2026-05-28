import { PHASES } from './data';
import type { Phase, Logs, HistorySession, LogEntry, Unit, RoutineExercise, WorkoutType } from './types';

// UUID v4 pattern used in new log keys
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        // Extract week (first segment) and routineExerciseId (middle UUID segment)
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const routineExerciseId = key.slice(firstDash + 1, lastDash);
        if (!UUID_RE.test(routineExerciseId)) continue;
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
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const weekStr = key.slice(0, firstDash);
        const routineExerciseId = key.slice(firstDash + 1, lastDash);
        const setIdxStr = key.slice(lastDash + 1);
        if (!UUID_RE.test(routineExerciseId)) continue;
        const week = Number(weekStr);
        // Group by week only — type is no longer encoded in the key
        const sessionKey = weekStr;
        if (!sessions[sessionKey]) {
            sessions[sessionKey] = { week, sets: [] };
        }
        sessions[sessionKey].sets.push({ routineExerciseId, setIdx: Number(setIdxStr), ...val });
    }

    return Object.values(sessions).sort((a, b) => b.week - a.week);
}

export function computeVolumeByTypeAndWeek(
    logs: Logs,
    routineExercises: RoutineExercise[],
): Record<number, Partial<Record<WorkoutType, number>>> {
    const typeMap = new Map<string, WorkoutType>(
        routineExercises.map((re) => [re.id, re.workout_type]),
    );
    const result: Record<number, Partial<Record<WorkoutType, number>>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const routineExerciseId = key.slice(firstDash + 1, lastDash);
        if (!UUID_RE.test(routineExerciseId)) continue;
        const week = Number(key.slice(0, firstDash));
        const wt = typeMap.get(routineExerciseId);
        if (!wt) continue;
        if (!result[week]) result[week] = {};
        result[week][wt] = (result[week][wt] ?? 0) + 1;
    }
    return result;
}

export function computeE1RMHistory(
    logs: Logs,
    routineExerciseId: string,
): Array<{ week: number; e1rm: number }> {
    const weekBest: Record<number, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const firstDash = key.indexOf('-');
        const lastDash = key.lastIndexOf('-');
        if (firstDash === -1 || lastDash === firstDash) continue;
        const id = key.slice(firstDash + 1, lastDash);
        if (id !== routineExerciseId) continue;
        const week = Number(key.slice(0, firstDash));
        const e1rm = calcE1RM(val.kg, val.reps);
        if (e1rm > (weekBest[week] ?? 0)) weekBest[week] = e1rm;
    }
    return Object.entries(weekBest)
        .map(([w, e1rm]) => ({ week: Number(w), e1rm }))
        .sort((a, b) => a.week - b.week);
}
