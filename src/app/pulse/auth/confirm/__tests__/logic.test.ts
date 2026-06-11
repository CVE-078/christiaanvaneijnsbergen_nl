import { describe, it, expect } from 'vitest';
import { parseConfirmParams, resolveSuccessRedirect, validateNext, DEFAULT_NEXT, RECOVERY_NEXT } from '../logic';

const params = (obj: Record<string, string>) => new URLSearchParams(obj);

describe('validateNext', () => {
    it('accepts an internal /pulse path', () => {
        expect(validateNext('/pulse/history')).toBe('/pulse/history');
    });

    it('falls back for external, protocol-relative, empty, and missing values', () => {
        expect(validateNext('https://evil.com')).toBe(DEFAULT_NEXT);
        expect(validateNext('//evil.com')).toBe(DEFAULT_NEXT);
        expect(validateNext('/other')).toBe(DEFAULT_NEXT);
        expect(validateNext('')).toBe(DEFAULT_NEXT);
        expect(validateNext(null)).toBe(DEFAULT_NEXT);
        expect(validateNext(undefined)).toBe(DEFAULT_NEXT);
    });

    it('falls back when path traversal normalises out of /pulse', () => {
        expect(validateNext('/pulse/../admin')).toBe(DEFAULT_NEXT);
        expect(validateNext('/pulse/../../etc')).toBe(DEFAULT_NEXT);
        expect(validateNext('/pulse/..//evil.com')).toBe(DEFAULT_NEXT);
    });

    it('preserves query and hash on a valid /pulse path', () => {
        expect(validateNext('/pulse/history?week=3#top')).toBe('/pulse/history?week=3#top');
    });
});

describe('parseConfirmParams', () => {
    it('parses each valid type with a token_hash', () => {
        for (const type of ['signup', 'recovery', 'email_change'] as const) {
            const result = parseConfirmParams(params({ token_hash: 'abc', type }));
            expect(result).toEqual({ tokenHash: 'abc', type, next: DEFAULT_NEXT });
        }
    });

    it('carries a validated next through', () => {
        const result = parseConfirmParams(params({ token_hash: 'abc', type: 'signup', next: '/pulse/profile' }));
        expect(result).toEqual({ tokenHash: 'abc', type: 'signup', next: '/pulse/profile' });
    });

    it('rejects a missing token_hash', () => {
        expect(parseConfirmParams(params({ type: 'signup' }))).toEqual({ error: 'invalid_link' });
    });

    it('rejects a missing type', () => {
        expect(parseConfirmParams(params({ token_hash: 'abc' }))).toEqual({ error: 'invalid_link' });
    });

    it('rejects an unrecognised type', () => {
        expect(parseConfirmParams(params({ token_hash: 'abc', type: 'magiclink' }))).toEqual({ error: 'invalid_link' });
    });

    it('discards an external next even with valid token/type', () => {
        const result = parseConfirmParams(params({ token_hash: 'abc', type: 'signup', next: 'https://evil.com' }));
        expect(result).toEqual({ tokenHash: 'abc', type: 'signup', next: DEFAULT_NEXT });
    });
});

describe('resolveSuccessRedirect', () => {
    it('sends recovery to the reset-password form', () => {
        expect(resolveSuccessRedirect('recovery', '/pulse/anything')).toBe(RECOVERY_NEXT);
    });

    it('sends signup and email_change to the validated next', () => {
        expect(resolveSuccessRedirect('signup', '/pulse/profile')).toBe('/pulse/profile');
        expect(resolveSuccessRedirect('email_change', DEFAULT_NEXT)).toBe(DEFAULT_NEXT);
    });
});
