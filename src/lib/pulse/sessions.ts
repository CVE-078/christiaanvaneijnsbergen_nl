import type { WorkoutVariant, WorkoutSession } from './types';
import { localDateKey } from './dates';

export function nextVariant(lastVariant: WorkoutVariant | null): WorkoutVariant {
    return lastVariant === 'A' ? 'B' : 'A';
}

// Group completed sessions by their tz-local calendar date (YYYY-MM-DD). In-
// progress sessions (completed_at === null) are excluded.
export function sessionsByDay(sessions: WorkoutSession[], tz: string): Map<string, WorkoutSession[]> {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sessions) {
        if (!s.completed_at) continue;
        const key = localDateKey(s.completed_at, tz);
        const bucket = map.get(key);
        if (bucket) {
            bucket.push(s);
        } else {
            map.set(key, [s]);
        }
    }
    return map;
}

// A single cell in a month calendar grid. Leading blanks before the first
// day of the month are represented by dateKey === '' and day === 0.
export interface MonthCell {
    dateKey: string; // YYYY-MM-DD, or '' for a blank leading cell
    day: number; // calendar day number, or 0 for blank
}

// Build an array of MonthCell for the given month (monthIndex0 is 0-based,
// e.g. 5 = June). Leading blank cells pad to a Monday-start week.
export function buildMonthCells(year: number, monthIndex0: number): MonthCell[] {
    const firstDay = new Date(Date.UTC(year, monthIndex0, 1));
    // getUTCDay(): 0=Sun,1=Mon,...,6=Sat; convert to Monday-start (0=Mon,...,6=Sun).
    const rawDow = firstDay.getUTCDay(); // 0-6 (Sun-Sat)
    const leadingBlanks = rawDow === 0 ? 6 : rawDow - 1; // Mon=0 ... Sun=6

    const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();

    const cells: MonthCell[] = [];

    // Leading blanks
    for (let i = 0; i < leadingBlanks; i++) {
        cells.push({ dateKey: '', day: 0 });
    }

    // Day cells
    const monthStr = String(monthIndex0 + 1).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        cells.push({ dateKey: `${year}-${monthStr}-${dayStr}`, day: d });
    }

    return cells;
}
