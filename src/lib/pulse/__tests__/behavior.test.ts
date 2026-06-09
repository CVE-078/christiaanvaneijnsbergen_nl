import { describe, it, expect } from 'vitest';
import { analyzeSwapBehavior, EMPTY_BEHAVIOR, type SwapHistoryRow } from '@/lib/pulse/behavior';

const NOW = Date.parse('2026-06-09T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const row = (fromExerciseId: string, d: number): SwapHistoryRow => ({ fromExerciseId, createdAt: daysAgo(d) });
const rowR = (fromExerciseId: string, d: number, reason: string | null): SwapHistoryRow => ({
    fromExerciseId,
    createdAt: daysAgo(d),
    reason,
});
const opts = { minCount: 3, recencyMs: 120 * 86400000, nowMs: NOW };

describe('analyzeSwapBehavior', () => {
    it('empty input -> EMPTY_BEHAVIOR', () => {
        expect(analyzeSwapBehavior([], opts)).toEqual(EMPTY_BEHAVIOR);
    });
    it('demotes an exercise swapped away from >= minCount recent times', () => {
        const rows = [row('a', 1), row('a', 5), row('a', 9)];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a'] });
    });
    it('does not demote below the threshold', () => {
        expect(analyzeSwapBehavior([row('a', 1), row('a', 5)], opts)).toEqual({ demote: [] });
    });
    it('excludes stale swaps outside the recency window', () => {
        const rows = [row('a', 1), row('a', 5), row('a', 200)]; // third is stale, drops to 2
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
    });
    it('returns a sorted, deterministic demote list', () => {
        const rows = [
            row('z', 1), row('z', 2), row('z', 3),
            row('a', 1), row('a', 2), row('a', 3),
        ];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a', 'z'] });
    });
    it('ignores rows with an unparseable timestamp', () => {
        const rows = [
            { fromExerciseId: 'a', createdAt: 'not-a-date' },
            row('a', 1),
            row('a', 2),
            row('a', 3),
        ];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a'] });
    });

    // Smart substitution v2 (#8): constraint-reason swaps must not teach a demote.
    it('excludes constraint-reason swaps from demote', () => {
        const rows = [rowR('a', 1, 'pain'), rowR('a', 2, 'no_equipment'), rowR('a', 3, 'crowded')];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
    });
    it('a single constraint row keeps an exercise under the threshold', () => {
        const rows = [row('a', 1), row('a', 2), rowR('a', 3, 'pain')]; // only 2 count
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: [] });
    });
    it('null-reason (preference) rows still count', () => {
        const rows = [rowR('a', 1, null), rowR('a', 2, null), rowR('a', 3, null)];
        expect(analyzeSwapBehavior(rows, opts)).toEqual({ demote: ['a'] });
    });
});
