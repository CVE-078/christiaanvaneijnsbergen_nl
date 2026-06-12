import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicAuthPath } from '@/lib/pulse/authPaths';

/** Generate a per-request base64 nonce using the Web Crypto API available in the middleware runtime. */
export function generateNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Build the nonce-based Content-Security-Policy for /pulse.
 * Uses 'strict-dynamic' so Next's own inline bootstrap scripts load via the nonced script.
 * style-src keeps 'unsafe-inline' because Tailwind and inline styles need it.
 *
 * In development only, script-src also allows 'unsafe-eval': Next's dev webpack build
 * wraps every module in eval() (the eval-source-map devtool) and React Fast Refresh
 * uses eval, so without it the dev client bundle cannot execute, the page never
 * hydrates, and forms fall back to a native (no-JS) POST. That no-JS path then trips a
 * Next 15.1 regression that throws "cookies was called outside a request scope" inside
 * the server action (e.g. login / signup). Production webpack does not use eval, so the
 * strict policy (no 'unsafe-eval') is kept in prod.
 */
export function buildCsp(nonce: string, supabaseHost: string, isDev = false): string {
    const scriptSrc = isDev
        ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
        "img-src 'self' data:",
        "font-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; ');
}

function supabaseHostFromEnv(): string {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    }
    return new URL(url).host;
}

export async function updateSession(request: NextRequest) {
    // Per-request nonce. Propagated to Next via the x-nonce request header so
    // Server Components can apply it to inline scripts, and set on the CSP header.
    const nonce = generateNonce();
    const csp = buildCsp(nonce, supabaseHostFromEnv(), process.env.NODE_ENV !== 'production');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    let response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request: { headers: requestHeaders } });
                    response.headers.set('Content-Security-Policy', csp);
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        },
    );

    // Refresh session, must be called before any redirect logic
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicAuthPath(request.nextUrl.pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = '/pulse/login';
        const redirect = NextResponse.redirect(url);
        redirect.headers.set('Content-Security-Policy', csp);
        return redirect;
    }

    return response;
}
