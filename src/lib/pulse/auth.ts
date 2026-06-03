import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type AuthUser = NonNullable<Awaited<ReturnType<SupabaseServerClient['auth']['getUser']>>['data']['user']>;

/**
 * Resolve the current authenticated user for Server Actions.
 * Throws Error('Unauthorized') when no user is signed in, mirroring the
 * existing action error contract.
 */
export async function getUserOrThrow(): Promise<{
    supabase: SupabaseServerClient;
    user: AuthUser;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    return { supabase, user };
}

/**
 * Resolve the current authenticated user for Route Handlers.
 * On success returns the user with a null response. When no user is signed in,
 * returns a 401 NextResponse so the caller can early-return it.
 */
export async function getUserOrUnauthorized(): Promise<
    | { supabase: SupabaseServerClient; user: AuthUser; response: null }
    | { supabase: SupabaseServerClient; user: null; response: NextResponse }
> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            supabase,
            user: null,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        };
    }
    return { supabase, user, response: null };
}
