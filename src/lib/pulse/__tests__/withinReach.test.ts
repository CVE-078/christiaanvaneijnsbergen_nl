import { describe, it, expect } from 'vitest';
import { computeWithinReach } from '../withinReach';

describe('computeWithinReach', () => {
    const base = { sessionsPerWeek: 4, programWeeks: 12, status: 'on_track' as const };

    it('nudges to finish the block when near its end', () => {
        // 44 of 48 done in a 12-week, 4-day block => 4 left.
        const r = computeWithinReach({ ...base, completedCount: 44 });
        expect(r).toEqual({ kind: 'block', text: '4 sessions to finish your 12-week block' });
    });

    it('uses the singular for a single remaining session', () => {
        const r = computeWithinReach({ ...base, completedCount: 47 });
        expect(r?.text).toBe('1 session to finish your 12-week block');
    });

    it('falls back to the next every-10 milestone when the block is not close', () => {
        // 28 done: 20 to finish the block (not close), 2 to the 30th workout (close).
        const r = computeWithinReach({ ...base, completedCount: 28 });
        expect(r).toEqual({ kind: 'milestone', text: '2 sessions to your 30th workout' });
    });

    it('prefers the more imminent of block vs milestone', () => {
        // 45 done: 3 to finish block, 5 to the 50th (not within window) => block.
        expect(computeWithinReach({ ...base, completedCount: 45 })?.kind).toBe('block');
    });

    it('returns null when nothing is close', () => {
        expect(computeWithinReach({ ...base, completedCount: 24 })).toBeNull();
    });

    it('stays quiet while paused or lapsed', () => {
        expect(computeWithinReach({ ...base, completedCount: 44, status: 'paused' })).toBeNull();
        expect(computeWithinReach({ ...base, completedCount: 44, status: 'lapsed' })).toBeNull();
    });

    it('returns null for empty / degenerate inputs', () => {
        expect(computeWithinReach({ ...base, completedCount: 0 })).toBeNull();
        expect(
            computeWithinReach({ completedCount: 10, sessionsPerWeek: 0, programWeeks: 12, status: 'on_track' }),
        ).toBeNull();
    });
});
