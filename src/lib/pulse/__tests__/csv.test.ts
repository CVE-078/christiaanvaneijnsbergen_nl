import { describe, it, expect } from 'vitest';
import { buildWorkoutCsv, WORKOUT_CSV_HEADER } from '../csv';
import { logKey } from '../utils';
import type { Logs } from '../types';

const A = '550e8400-e29b-41d4-a716-446655440000';
const B = '550e8400-e29b-41d4-a716-446655440001';

describe('buildWorkoutCsv', () => {
    it('emits a header and one row per saved set, ordered by week/exercise/set', () => {
        const logs: Logs = {
            [logKey(2, A, 0)]: { kg: 100, reps: 5, rir: 2, saved: true },
            [logKey(1, B, 0)]: { kg: 60, reps: 8, rir: 1, saved: true },
            [logKey(1, A, 1)]: { kg: 80, reps: 6, rir: 0, saved: true },
            [logKey(1, A, 0)]: { kg: 0, reps: 0, rir: 0, saved: false }, // unsaved → skipped
        };
        const csv = buildWorkoutCsv(logs, { nameFor: (id) => (id === A ? 'Bench' : 'Row'), prMap: {} });
        const lines = csv.split('\n');
        expect(lines[0]).toBe(WORKOUT_CSV_HEADER.join(','));
        // week 1 Bench set 2, week 1 Row set 1, week 2 Bench set 1 (sorted)
        expect(lines.slice(1)).toEqual(['1,Bench,2,80,6,0,,', '1,Row,1,60,8,1,,', '2,Bench,1,100,5,2,,']);
    });

    it('flags PRs, renders drops, and escapes commas in names', () => {
        const logs: Logs = {
            [logKey(1, A, 0)]: { kg: 100, reps: 5, rir: 1, saved: true, drops: [{ kg: 80, reps: 8 }, { kg: 60, reps: 10 }] },
        };
        const csv = buildWorkoutCsv(logs, {
            nameFor: () => 'Press, Incline',
            prMap: { [A]: 100 }, // e1RM at/above this → PR
        });
        const row = csv.split('\n')[1];
        expect(row).toContain('"Press, Incline"'); // comma-containing name is quoted
        expect(row).toContain('PR');
        expect(row).toContain('80×8 · 60×10');
    });
});
