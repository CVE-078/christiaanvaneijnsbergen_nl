import { describe, it, expect } from 'vitest';
import { recoveryReadout } from '@/lib/pulse/utils';

describe('recoveryReadout', () => {
    it('returns "No data" for an empty map', () => {
        const r = recoveryReadout({});
        expect(r.tone).toBe('none');
        expect(r.word).toBe('No data');
    });

    it('returns "Fresh" when every tracked category is optimal', () => {
        const r = recoveryReadout({ chest: { status: 'optimal' }, back: { status: 'optimal' } });
        expect(r.tone).toBe('fresh');
        expect(r.word).toBe('Fresh');
        expect(r.detail).toBe('all muscles optimal');
    });

    it('returns "Ready" when some are under and none are fatigued', () => {
        const r = recoveryReadout({ chest: { status: 'under' }, back: { status: 'optimal' } });
        expect(r.tone).toBe('ready');
        expect(r.word).toBe('Ready');
        expect(r.detail).toBe('room to build');
    });

    it('returns "Watch" with the fatigued muscles when high_fatigue present', () => {
        const r = recoveryReadout({ back: { status: 'high_fatigue' }, legs: { status: 'high_fatigue' }, chest: { status: 'under' } });
        expect(r.tone).toBe('watch');
        expect(r.word).toBe('Watch');
        expect(r.detail).toBe('back · legs');
        expect(r.muscles).toEqual(['back', 'legs']);
    });

    it('returns "Ease off" when any category is overreaching (worst state wins)', () => {
        const r = recoveryReadout({ chest: { status: 'overreaching' }, back: { status: 'high_fatigue' } });
        expect(r.tone).toBe('easeoff');
        expect(r.word).toBe('Ease off');
        expect(r.detail).toBe('high fatigue · chest');
    });

    it('caps the muscle list at two with a +N overflow', () => {
        const r = recoveryReadout({ back: { status: 'high_fatigue' }, legs: { status: 'high_fatigue' }, chest: { status: 'high_fatigue' } });
        expect(r.detail).toBe('back · legs +1');
    });
});
