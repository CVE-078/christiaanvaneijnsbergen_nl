import { describe, it, expect } from 'vitest';
import { buildCsp, generateNonce } from '../middleware';

describe('generateNonce', () => {
    it('returns a non-empty base64 string', () => {
        const nonce = generateNonce();
        expect(nonce.length).toBeGreaterThan(0);
        // base64 alphabet only
        expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    it('returns a different value on each call', () => {
        expect(generateNonce()).not.toBe(generateNonce());
    });
});

describe('buildCsp', () => {
    const host = 'example.supabase.co';

    it('uses a nonce-based script-src with strict-dynamic', () => {
        const csp = buildCsp('abc123', host);
        expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    });

    it('does not allow unsafe-inline in script-src', () => {
        const csp = buildCsp('abc123', host);
        const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).not.toContain('unsafe-inline');
    });

    it('omits unsafe-eval from script-src in production (default)', () => {
        const scriptSrc = buildCsp('abc123', host)
            .split('; ')
            .find((d) => d.startsWith('script-src'));
        expect(scriptSrc).not.toContain('unsafe-eval');
    });

    it('adds unsafe-eval to script-src in development (Next dev eval bundle / Fast Refresh)', () => {
        const scriptSrc = buildCsp('abc123', host, true)
            .split('; ')
            .find((d) => d.startsWith('script-src'));
        expect(scriptSrc).toContain("'unsafe-eval'");
        // still nonce + strict-dynamic, and never unsafe-inline
        expect(scriptSrc).toContain("'nonce-abc123'");
        expect(scriptSrc).toContain("'strict-dynamic'");
        expect(scriptSrc).not.toContain('unsafe-inline');
    });

    it('keeps unsafe-inline in style-src', () => {
        const csp = buildCsp('abc123', host);
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('includes the supabase host in connect-src for https and wss', () => {
        const csp = buildCsp('abc123', host);
        expect(csp).toContain(`connect-src 'self' https://${host} wss://${host}`);
    });

    it('keeps frame-ancestors none', () => {
        const csp = buildCsp('abc123', host);
        expect(csp).toContain("frame-ancestors 'none'");
    });

    it('locks down object-src, base-uri and form-action', () => {
        const csp = buildCsp('abc123', host);
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'self'");
        expect(csp).toContain("form-action 'self'");
    });
});
