import { describe, it, expect } from 'vitest';
import { computeStrengthScoreSeries, strengthDeltaLabel } from '@/lib/pulse/strength';

const bench = { name: 'Barbell Bench Press', history: [
    { week: 1, e1rm: 90 }, { week: 2, e1rm: 95 }, { week: 3, e1rm: 100 },
] };

describe('computeStrengthScoreSeries', () => {
    it('produces a rising, week-sorted series of non-null scores', () => {
        const s = computeStrengthScoreSeries({ gender: 'male', bodyweightKg: 80, liftsByWeek: [bench] });
        expect(s.length).toBeGreaterThanOrEqual(2);
        expect(s.map((p) => p.week)).toEqual([...s.map((p) => p.week)].sort((a, b) => a - b));
        expect(s[s.length - 1].score).toBeGreaterThanOrEqual(s[0].score);
    });

    it('returns empty when bodyweight is null', () => {
        expect(computeStrengthScoreSeries({ gender: 'male', bodyweightKg: null, liftsByWeek: [bench] })).toEqual([]);
    });

    it('returns empty when no main lifts are present', () => {
        const curl = { name: 'Bicep Curl', history: [{ week: 1, e1rm: 30 }] };
        expect(computeStrengthScoreSeries({ gender: 'male', bodyweightKg: 80, liftsByWeek: [curl] })).toEqual([]);
    });
});

describe('strengthDeltaLabel', () => {
    it('says "log lifts to see" with fewer than two points', () => {
        expect(strengthDeltaLabel([]).tone).toBe('none');
        expect(strengthDeltaLabel([{ week: 1, score: 40 }]).text).toBe('log lifts to see');
    });
    it('reports a rising delta', () => {
        const r = strengthDeltaLabel([{ week: 1, score: 40 }, { week: 4, score: 46 }]);
        expect(r.tone).toBe('up');
        expect(r.text).toBe('▲ 6 this cycle');
    });
    it('reports a falling delta', () => {
        const r = strengthDeltaLabel([{ week: 1, score: 46 }, { week: 4, score: 44 }]);
        expect(r.tone).toBe('down');
        expect(r.text).toBe('▼ 2 this cycle');
    });
    it('reports no change', () => {
        expect(strengthDeltaLabel([{ week: 1, score: 40 }, { week: 4, score: 40 }]).text).toBe('no change');
    });
});
