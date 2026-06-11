import { describe, it, expect } from 'vitest';
import { WEEKLY_FREQUENCIES, isWeeklyFrequency, SUGGESTED_DAYS, MAX_TRAINING_DAYS } from '../weeklyFrequency';

describe('WEEKLY_FREQUENCIES', () => {
    it('is exactly the numeric counts 2 through 6', () => expect([...WEEKLY_FREQUENCIES]).toEqual([2, 3, 4, 5, 6]));
});

describe('isWeeklyFrequency', () => {
    it('accepts every listed frequency', () => {
        for (const n of WEEKLY_FREQUENCIES) expect(isWeeklyFrequency(n)).toBe(true);
    });
    it('rejects out-of-range numbers', () => {
        expect(isWeeklyFrequency(1)).toBe(false);
        expect(isWeeklyFrequency(7)).toBe(false);
        expect(isWeeklyFrequency(0)).toBe(false);
    });
    it('rejects non-numbers (incl. the old bucket strings)', () => {
        expect(isWeeklyFrequency('4')).toBe(false);
        expect(isWeeklyFrequency('2-3')).toBe(false);
        expect(isWeeklyFrequency('5-6')).toBe(false);
        expect(isWeeklyFrequency(null)).toBe(false);
        expect(isWeeklyFrequency(undefined)).toBe(false);
    });
});

describe('SUGGESTED_DAYS', () => {
    it('has exactly the keys 2-6 and no bucket strings', () =>
        expect(Object.keys(SUGGESTED_DAYS).sort()).toEqual(['2', '3', '4', '5', '6']));
    it('seeds exactly n days for frequency n', () => {
        for (const n of WEEKLY_FREQUENCIES) expect(SUGGESTED_DAYS[n]).toHaveLength(n);
    });
    // Keys 2/4/5 byte-identical to what the old '2-3' / '4' / '5-6' buckets seeded.
    it('2 maps to [1,3]', () => expect(SUGGESTED_DAYS[2]).toEqual([1, 3]));
    it('4 maps to [1,2,4,5]', () => expect(SUGGESTED_DAYS[4]).toEqual([1, 2, 4, 5]));
    it('5 maps to [1,2,3,4,5]', () => expect(SUGGESTED_DAYS[5]).toEqual([1, 2, 3, 4, 5]));
    // New paths: 3 (the '2-3' bucket only ever seeded 2 days) and 6 (Mon-Sat).
    it('3 maps to [1,3,5]', () => expect(SUGGESTED_DAYS[3]).toEqual([1, 3, 5]));
    it('6 maps to [1,2,3,4,5,6]', () => expect(SUGGESTED_DAYS[6]).toEqual([1, 2, 3, 4, 5, 6]));
});

describe('MAX_TRAINING_DAYS', () => {
    it('has exactly the keys 2-6 and no bucket strings', () =>
        expect(Object.keys(MAX_TRAINING_DAYS).sort()).toEqual(['2', '3', '4', '5', '6']));
    it('caps each frequency at itself', () => {
        for (const n of WEEKLY_FREQUENCIES) expect(MAX_TRAINING_DAYS[n]).toBe(n);
    });
});
