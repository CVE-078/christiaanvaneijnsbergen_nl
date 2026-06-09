import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadPauses } from '@/lib/pulse/queries';
import type { ProgramPause } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let pauses: ProgramPause[] = [];
    try {
        pauses = await loadPauses(supabase, user.id);
    } catch {
        pauses = [];
    }
    return NextResponse.json(pauses);
}
