import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
import { headers } from 'next/headers';
import { getOrigin } from '../origin';

const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
    vi.clearAllMocks();
});

describe('getOrigin', () => {
    it('uses NEXT_PUBLIC_SITE_URL and ignores a poisoned x-forwarded-host when set', async () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://pulse.example.com';
        (headers as Mock).mockResolvedValue(
            new Headers({ 'x-forwarded-host': 'evil.com', 'x-forwarded-proto': 'https' }),
        );
        expect(await getOrigin()).toBe('https://pulse.example.com');
    });

    it('strips a trailing slash from the configured origin', async () => {
        process.env.NEXT_PUBLIC_SITE_URL = 'https://pulse.example.com/';
        expect(await getOrigin()).toBe('https://pulse.example.com');
    });

    it('falls back to forwarded headers when the env var is unset', async () => {
        delete process.env.NEXT_PUBLIC_SITE_URL;
        (headers as Mock).mockResolvedValue(
            new Headers({ 'x-forwarded-host': 'host.example.com', 'x-forwarded-proto': 'https' }),
        );
        expect(await getOrigin()).toBe('https://host.example.com');
    });
});
