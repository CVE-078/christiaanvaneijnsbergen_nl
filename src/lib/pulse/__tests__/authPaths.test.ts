import { describe, it, expect } from 'vitest';
import { isPublicAuthPath } from '../authPaths';

describe('isPublicAuthPath', () => {
    it('returns true for each public auth path', () => {
        expect(isPublicAuthPath('/pulse/login')).toBe(true);
        expect(isPublicAuthPath('/pulse/signup')).toBe(true);
        expect(isPublicAuthPath('/pulse/forgot-password')).toBe(true);
        expect(isPublicAuthPath('/pulse/auth/confirm')).toBe(true);
        expect(isPublicAuthPath('/pulse/account-deleted')).toBe(true);
    });

    it('tolerates a single trailing slash', () => {
        expect(isPublicAuthPath('/pulse/login/')).toBe(true);
        expect(isPublicAuthPath('/pulse/auth/confirm/')).toBe(true);
    });

    it('returns false for protected paths', () => {
        expect(isPublicAuthPath('/pulse/train')).toBe(false);
        expect(isPublicAuthPath('/pulse/profile')).toBe(false);
        expect(isPublicAuthPath('/pulse/reset-password')).toBe(false);
    });

    it('returns false for subpaths of a public path (exact match only)', () => {
        expect(isPublicAuthPath('/pulse/login/extra')).toBe(false);
        expect(isPublicAuthPath('/pulse/auth/confirm/callback')).toBe(false);
    });

    it('returns false for lookalike and unrelated routes', () => {
        expect(isPublicAuthPath('/pulse/signupx')).toBe(false);
        expect(isPublicAuthPath('/pulse/loginish')).toBe(false);
        expect(isPublicAuthPath('/')).toBe(false);
        expect(isPublicAuthPath('/pulse')).toBe(false);
    });
});
