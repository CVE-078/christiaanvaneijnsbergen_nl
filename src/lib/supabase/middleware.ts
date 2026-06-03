import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Generate a per-request base64 nonce using the Web Crypto API available in the middleware runtime. */
export function generateNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Build the nonce-based Content-Security-Policy for /pulse.
 * Uses 'strict-dynamic' so Next's own inline bootstrap scripts load via the nonced script.
 * style-src keeps 'unsafe-inline' because Tailwind and inline styles need it.
 */
export function buildCsp(nonce: string, supabaseHost: string): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
        "img-src 'self' data:",
        "font-src 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
}

function supabaseHostFromEnv(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : 'fjlkzzxwmyrksyockdko.supabase.co';
}

export async function updateSession(request: NextRequest) {
    // Per-request nonce. Propagated to Next via the x-nonce request header so
    // Server Components can apply it to inline scripts, and set on the CSP header.
    const nonce = generateNonce();
    const csp = buildCsp(nonce, supabaseHostFromEnv());

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

    // Refresh session — must be called before any redirect logic
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isLoginPage = request.nextUrl.pathname.startsWith('/pulse/login');
    if (!user && !isLoginPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/pulse/login';
        const redirect = NextResponse.redirect(url);
        redirect.headers.set('Content-Security-Policy', csp);
        return redirect;
    }

    return response;
}
