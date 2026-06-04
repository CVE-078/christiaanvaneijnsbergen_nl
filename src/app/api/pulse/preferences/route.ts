import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadHiddenExerciseIds } from '@/lib/pulse/queries';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let hidden: string[] = [];
    try {
        hidden = await loadHiddenExerciseIds(supabase, user.id);
    } catch {
        hidden = [];
    }
    return NextResponse.json(hidden);
}
