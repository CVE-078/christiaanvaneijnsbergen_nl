import { describe, it, expect } from 'vitest';
import {
    DAY_NAMES,
    WORKOUT_TYPE_LABELS,
    WORKOUT_TYPE_ORDER,
    SUGGESTED_DAYS,
    EXPERIENCE_LEVEL_COLOR,
} from '../constants';

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

describe('SUGGESTED_DAYS', () => {
    it('2-3 maps to [1,3]', () => expect(SUGGESTED_DAYS['2-3']).toEqual([1, 3]));
    it('4 maps to [1,2,4,5]', () => expect(SUGGESTED_DAYS['4']).toEqual([1, 2, 4, 5]));
    it('5-6 maps to [1,2,3,4,5]', () => expect(SUGGESTED_DAYS['5-6']).toEqual([1, 2, 3, 4, 5]));
});

describe('EXPERIENCE_LEVEL_COLOR', () => {
    it('beginner has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.beginner).toBe('string'));
    it('intermediate has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.intermediate).toBe('string'));
    it('advanced has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.advanced).toBe('string'));
});
