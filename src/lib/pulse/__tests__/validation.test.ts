import { describe, it, expect } from 'vitest';
import { validateLogs, validateDecisionEvent } from '@/lib/pulse/validation';

const KEY = '3-11111111-1111-4111-8111-111111111111-0';
const base = { kg: 80, reps: 8, rir: 2, saved: true };

describe('validateLogs timed holds (P1.3b)', () => {
    it('accepts a hold: duration_s set, kg/reps 0', () => {
        expect(validateLogs({ [KEY]: { kg: 0, reps: 0, rir: 0, saved: true, duration_s: 45 } })).toBe(true);
    });
    it('rejects a hold with out-of-range or non-integer duration_s', () => {
        for (const d of [0, 3601, 12.5]) {
            expect(validateLogs({ [KEY]: { kg: 0, reps: 0, rir: 0, saved: true, duration_s: d } })).toBe(false);
        }
    });
    it('rejects a hold that also carries drops', () => {
        expect(
            validateLogs({ [KEY]: { kg: 0, reps: 0, rir: 0, saved: true, duration_s: 45, drops: [{ kg: 40, reps: 8 }] } }),
        ).toBe(false);
    });
    it('still rejects a NORMAL set with kg 0 or reps 0 (rails unchanged for non-holds)', () => {
        expect(validateLogs({ [KEY]: { kg: 0, reps: 8, rir: 2, saved: true } })).toBe(false);
        expect(validateLogs({ [KEY]: { kg: 80, reps: 0, rir: 2, saved: true } })).toBe(false);
    });
    it('still accepts a normal weighted set', () => {
        expect(validateLogs({ [KEY]: base })).toBe(true);
    });
});

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

describe('validateDecisionEvent', () => {
    const evt = {
        type: 'deload',
        trigger: 'plateau',
        affectedArea: '11111111-1111-4111-8111-111111111111',
        week: 6,
        magnitude: { fromKg: 100, toKg: 90 },
        confidence: null,
    };

    it('accepts a well-formed deload event', () => {
        expect(validateDecisionEvent(evt)).toBe(true);
    });
    it('accepts a program-wide event with an empty affectedArea', () => {
        expect(validateDecisionEvent({ ...evt, type: 'ramp_back', trigger: 'gap', affectedArea: '' })).toBe(true);
    });
    it('accepts a manual trigger (user-initiated lighten)', () => {
        expect(validateDecisionEvent({ ...evt, type: 'ramp_back', trigger: 'manual', affectedArea: '' })).toBe(true);
    });
    it('accepts a numeric confidence in [0,1]', () => {
        expect(validateDecisionEvent({ ...evt, confidence: 0.8 })).toBe(true);
    });
    it('rejects an unknown type', () => {
        expect(validateDecisionEvent({ ...evt, type: 'volume_bump' })).toBe(false);
    });
    it('rejects an unknown trigger', () => {
        expect(validateDecisionEvent({ ...evt, trigger: 'vibes' })).toBe(false);
    });
    it('rejects a non-integer or out-of-range week', () => {
        expect(validateDecisionEvent({ ...evt, week: 0 })).toBe(false);
        expect(validateDecisionEvent({ ...evt, week: 53 })).toBe(false);
        expect(validateDecisionEvent({ ...evt, week: 5.5 })).toBe(false);
    });
    it('rejects a non-string affectedArea', () => {
        expect(validateDecisionEvent({ ...evt, affectedArea: 123 })).toBe(false);
    });
    it('rejects magnitude that is not a flat record of finite numbers', () => {
        expect(validateDecisionEvent({ ...evt, magnitude: { fromKg: 'x' } })).toBe(false);
        expect(validateDecisionEvent({ ...evt, magnitude: { fromKg: Infinity } })).toBe(false);
        expect(validateDecisionEvent({ ...evt, magnitude: [1, 2] })).toBe(false);
        expect(validateDecisionEvent({ ...evt, magnitude: null })).toBe(false);
    });
    it('rejects an out-of-range confidence', () => {
        expect(validateDecisionEvent({ ...evt, confidence: 1.5 })).toBe(false);
        expect(validateDecisionEvent({ ...evt, confidence: -0.1 })).toBe(false);
    });
    it('rejects a non-object', () => {
        expect(validateDecisionEvent(null)).toBe(false);
        expect(validateDecisionEvent('deload')).toBe(false);
    });
});
