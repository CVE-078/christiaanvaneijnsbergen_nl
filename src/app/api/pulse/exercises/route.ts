import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadExercises } from '@/lib/pulse/queries';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    try {
        const exercises = await loadExercises(supabase, user.id);
        return NextResponse.json(exercises);
    } catch {
        return NextResponse.json(null, { status: 500 });
    }
}
