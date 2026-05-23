import { PHASES } from './data';
import type { Phase, Logs, WorkoutType, HistorySession } from './types';

export function getPhase(week: number): Phase {
  return PHASES.find(p => p.weeks.includes(week)) ?? PHASES[0];
}

export function getRIR(week: number): number {
  const phase = getPhase(week);
  return phase.rir[phase.weeks.indexOf(week)];
}

export function logKey(week: number, type: WorkoutType, exIdx: number, setIdx: number): string {
  return `${week}-${type}-${exIdx}-${setIdx}`;
}

export function parseMaxSets(s: string): number {
  const n = parseInt(s.split('–').pop() ?? s, 10);
  return isNaN(n) ? 3 : n;
}

export function weekHasData(week: number, logs: Logs): boolean {
  const prefix = `${week}-`;
  return Object.keys(logs).some(k => k.startsWith(prefix) && logs[k]?.saved);
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

  return Object.values(sessions).sort(
    (a, b) => b.week - a.week || a.type.localeCompare(b.type),
  );
}
