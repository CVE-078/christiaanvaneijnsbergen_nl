import { describe, it, expect } from 'vitest';
import { validatePassword, MIN_PASSWORD_LENGTH } from '../passwordValidation';

describe('validatePassword', () => {
    it('returns null for a valid matching password at the minimum length', () => {
        const pw = 'a'.repeat(MIN_PASSWORD_LENGTH);
        expect(validatePassword(pw, pw)).toBeNull();
    });

    it('rejects a too-short password', () => {
        const pw = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
        expect(validatePassword(pw, pw)).toMatch(/at least/i);
    });

    it('rejects a mismatch when both meet the length requirement', () => {
        expect(validatePassword('correcthorse', 'batterystaple')).toMatch(/do not match/i);
    });

    it('reports length before mismatch when both are wrong', () => {
        expect(validatePassword('short', 'different')).toMatch(/at least/i);
    });
});
