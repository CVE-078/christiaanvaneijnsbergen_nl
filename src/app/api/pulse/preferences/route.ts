import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadExercisePreferences } from '@/lib/pulse/queries';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let prefs: { hidden: string[]; favorite: string[] } = { hidden: [], favorite: [] };
    try {
        prefs = await loadExercisePreferences(supabase, user.id);
    } catch {
        prefs = { hidden: [], favorite: [] };
    }
    return NextResponse.json(prefs);
}
