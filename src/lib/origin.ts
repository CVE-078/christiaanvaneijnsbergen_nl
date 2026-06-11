import { headers } from 'next/headers';

/**
 * Resolve the request's absolute origin (e.g. https://pulse.example.com) from
 * the forwarded headers, for building auth email redirect URLs server-side.
 * Works on Vercel (x-forwarded-*) and localhost. The resulting
 * `${origin}/pulse/auth/confirm` must be in Supabase Auth's redirect allow-list.
 */
export async function getOrigin(): Promise<string> {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
}
