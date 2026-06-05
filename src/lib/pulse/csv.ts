import { parseLogKey, isSetPR } from './utils';
import type { Logs, PRMap } from './types';

// Quote a CSV field only when it contains a comma, quote, or newline, doubling
// any embedded quotes (RFC 4180).
function escapeCsv(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const WORKOUT_CSV_HEADER = ['Week', 'Exercise', 'Set', 'Weight (kg)', 'Reps', 'RIR', 'PR', 'Drop sets'];

// Build a one-row-per-logged-set CSV of the full workout history. Weights stay
// in canonical kg. Exercise names are resolved through `nameFor` (which the
// caller wires to honour week-scoped swaps); the PR column flags all-time E1RM
// records via the shared `isSetPR`. Rows are ordered by week, then exercise,
// then set. Unsaved sets are skipped.
export function buildWorkoutCsv(
    logs: Logs,
    opts: { nameFor: (routineExerciseId: string, week: number) => string; prMap: PRMap },
): string {
    const rows: string[][] = [];
    for (const [key, entry] of Object.entries(logs)) {
        if (!entry?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const drops = entry.drops?.length ? entry.drops.map((d) => `${d.kg}×${d.reps}`).join(' · ') : '';
        rows.push([
            String(parsed.week),
            opts.nameFor(parsed.routineExerciseId, parsed.week),
            String(parsed.setIdx + 1),
            String(entry.kg),
            String(entry.reps),
            String(entry.rir),
            isSetPR(entry.kg, entry.reps, parsed.routineExerciseId, opts.prMap) ? 'PR' : '',
            drops,
        ]);
    }
    rows.sort(
        (a, b) => Number(a[0]) - Number(b[0]) || a[1].localeCompare(b[1]) || Number(a[2]) - Number(b[2]),
    );
    return [WORKOUT_CSV_HEADER, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}
