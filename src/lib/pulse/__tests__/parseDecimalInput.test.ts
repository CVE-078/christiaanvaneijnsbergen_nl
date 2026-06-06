import { describe, it, expect } from 'vitest';
import { parseDecimalInput } from '../utils';

// Weight inputs must accept both the '.' and ',' decimal separators. European
// keyboards/locales (e.g. NL) produce "2,5", which bare parseFloat truncates to
// 2 and silently corrupts the logged weight.
describe('parseDecimalInput', () => {
    it('parses a plain decimal with a period', () => {
        expect(parseDecimalInput('2.5')).toBe(2.5);
    });

    it('parses a decimal with a comma separator (European locale)', () => {
        expect(parseDecimalInput('2,5')).toBe(2.5);
        expect(parseDecimalInput('22,5')).toBe(22.5);
    });

    it('parses an integer string', () => {
        expect(parseDecimalInput('10')).toBe(10);
    });

    it('trims surrounding whitespace', () => {
        expect(parseDecimalInput('  3,75 ')).toBe(3.75);
    });

    it('returns NaN for empty or non-numeric input', () => {
        expect(parseDecimalInput('')).toBeNaN();
        expect(parseDecimalInput('   ')).toBeNaN();
        expect(parseDecimalInput('abc')).toBeNaN();
    });
});
