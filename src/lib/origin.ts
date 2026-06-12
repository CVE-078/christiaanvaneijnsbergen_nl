import { headers } from 'next/headers';

/**
 * Resolve the app's absolute origin (e.g. https://pulse.example.com) for building
 * auth email redirect URLs server-side. The resulting `${origin}/pulse/auth/confirm`
 * must be in Supabase Auth's redirect allow-list.
 *
 * Prefers the configured NEXT_PUBLIC_SITE_URL so the origin NEVER depends on
 * request headers in production (a poisoned `x-forwarded-host` cannot redirect an
 * auth email to an attacker's domain). Falls back to the forwarded headers only
 * when the env var is unset, for local dev / preview deploys. Set NEXT_PUBLIC_SITE_URL
 * in production.
 */
export async function getOrigin(): Promise<string> {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
    if (configured) return configured;

    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
}
