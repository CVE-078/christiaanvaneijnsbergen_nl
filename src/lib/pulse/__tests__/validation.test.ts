import { describe, it, expect } from 'vitest';
import { validateLogs } from '@/lib/pulse/validation';

const KEY = '3-11111111-1111-4111-8111-111111111111-0';
const base = { kg: 80, reps: 8, rir: 2, saved: true };

describe('validateLogs drops', () => {
    it('accepts a set with no drops', () => {
        expect(validateLogs({ [KEY]: base })).toBe(true);
    });
    it('accepts a valid drops array', () => {
        expect(
            validateLogs({
                [KEY]: {
                    ...base,
                    drops: [
                        { kg: 60, reps: 8 },
                        { kg: 40, reps: 8 },
                    ],
                },
            }),
        ).toBe(true);
    });
    it('accepts an empty drops array as a normal set', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [] } })).toBe(true);
    });
    it('rejects more than 6 drop segments', () => {
        const drops = Array.from({ length: 7 }, () => ({ kg: 40, reps: 8 }));
        expect(validateLogs({ [KEY]: { ...base, drops } })).toBe(false);
    });
    it('rejects a segment with bad kg', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [{ kg: 0, reps: 8 }] } })).toBe(false);
    });
    it('rejects a segment with non-integer reps', () => {
        expect(validateLogs({ [KEY]: { ...base, drops: [{ kg: 40, reps: 8.5 }] } })).toBe(false);
    });
});
