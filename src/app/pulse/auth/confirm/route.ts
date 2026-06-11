import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseConfirmParams, resolveSuccessRedirect } from './logic';

// Verifies the email OTP carried by Supabase confirmation / recovery links using
// the SSR-correct token_hash + verifyOtp flow (NOT a client ?code= exchange).
// On success a session cookie is set and the user is redirected into the app
// (or to the reset-password form for recovery).
export async function GET(request: NextRequest) {
    const parsed = parseConfirmParams(request.nextUrl.searchParams);
    if ('error' in parsed) {
        return NextResponse.redirect(new URL('/pulse/login?error=invalid_link', request.url));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: parsed.type, token_hash: parsed.tokenHash });
    if (error) {
        return NextResponse.redirect(new URL('/pulse/login?error=expired', request.url));
    }

    return NextResponse.redirect(new URL(resolveSuccessRedirect(parsed.type, parsed.next), request.url));
}
