import { PHASES } from './data';
import type { Phase, Logs, WorkoutType, HistorySession, LogEntry, Unit } from './types';

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

export function logKey(week: number, type: WorkoutType, exIdx: number, setIdx: number): string {
    return `${week}-${type}-${exIdx}-${setIdx}`;
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
        const parts = key.split('-');
        if (parts.length !== 4) continue;
        const [, type, exIdxStr] = parts;
        if (!['push', 'pull', 'legs'].includes(type)) continue;
        const exKey = `${type}-${exIdxStr}`;
        const e = calcE1RM(val.kg, val.reps);
        if (e > (map[exKey] ?? 0)) map[exKey] = e;
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
        const parts = key.split('-');
        if (parts.length !== 4) continue;
        const [week, type, exIdxStr, setIdxStr] = parts;
        if (!['push', 'pull', 'legs'].includes(type)) continue;
        const sessionKey = `${week}-${type}`;
        if (!sessions[sessionKey]) {
            sessions[sessionKey] = { week: Number(week), type: type as WorkoutType, sets: [] };
        }
        sessions[sessionKey].sets.push({ exIdx: Number(exIdxStr), setIdx: Number(setIdxStr), ...val });
    }

    return Object.values(sessions).sort((a, b) => b.week - a.week || a.type.localeCompare(b.type));
}
