import { describe, it, expect } from 'vitest';
import { DAY_NAMES, WORKOUT_TYPE_LABELS, WORKOUT_TYPE_ORDER, EXPERIENCE_LEVEL_COLOR, WARNING_COPY } from '../constants';

describe('DAY_NAMES', () => {
    it('has 7 entries', () => expect(DAY_NAMES).toHaveLength(7));
    it('starts with Sun at index 0', () => expect(DAY_NAMES[0]).toBe('Sun'));
    it('has Mon at index 1', () => expect(DAY_NAMES[1]).toBe('Mon'));
    it('has Sat at index 6', () => expect(DAY_NAMES[6]).toBe('Sat'));
});

describe('WORKOUT_TYPE_LABELS', () => {
    it('has 10 entries', () => expect(Object.keys(WORKOUT_TYPE_LABELS)).toHaveLength(10));
    it('push → Push', () => expect(WORKOUT_TYPE_LABELS.push).toBe('Push'));
    it('full_body → Full Body', () => expect(WORKOUT_TYPE_LABELS.full_body).toBe('Full Body'));
    it('upper → Upper', () => expect(WORKOUT_TYPE_LABELS.upper).toBe('Upper'));
});

describe('WORKOUT_TYPE_ORDER', () => {
    it('has 10 entries', () => expect(WORKOUT_TYPE_ORDER).toHaveLength(10));
    it('starts with push', () => expect(WORKOUT_TYPE_ORDER[0]).toBe('push'));
    it('ends with full_body', () => expect(WORKOUT_TYPE_ORDER[WORKOUT_TYPE_ORDER.length - 1]).toBe('full_body'));
});

// SUGGESTED_DAYS / MAX_TRAINING_DAYS moved to weeklyFrequency.ts (Issue 0);
// their tests live in weeklyFrequency.test.ts.

describe('WARNING_COPY', () => {
    it('has copy for the generator warning keys', () => {
        expect(WARNING_COPY.limited_variety).toBeDefined();
        expect(WARNING_COPY.no_compound).toBeDefined();
    });
    it('keeps the title and body non-empty for each key', () => {
        for (const key of ['limited_variety', 'no_compound'] as const) {
            expect(WARNING_COPY[key].title.trim().length, `${key} title`).toBeGreaterThan(0);
            expect(WARNING_COPY[key].body.trim().length, `${key} body`).toBeGreaterThan(0);
        }
    });
    it('preserves the meaning the old generation tests guarded', () => {
        expect(WARNING_COPY.limited_variety.body).toMatch(/fewer compound exercises/i);
        expect(WARNING_COPY.no_compound.title.toLowerCase()).toContain('accessory work only');
    });
    it('uses no em dash (house copy rule)', () => {
        for (const key of ['limited_variety', 'no_compound'] as const) {
            expect(WARNING_COPY[key].title).not.toContain('—');
            expect(WARNING_COPY[key].body).not.toContain('—');
        }
    });
});

describe('EXPERIENCE_LEVEL_COLOR', () => {
    it('beginner has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.beginner).toBe('string'));
    it('intermediate has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.intermediate).toBe('string'));
    it('advanced has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.advanced).toBe('string'));
});
