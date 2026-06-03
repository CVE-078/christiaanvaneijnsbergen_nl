import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadRoutines } from '@/lib/pulse/queries';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    try {
        const routines = await loadRoutines(supabase, user.id);
        return NextResponse.json(routines);
    } catch {
        return NextResponse.json(null, { status: 500 });
    }
}
