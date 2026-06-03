import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadNotes } from '@/lib/pulse/queries';
import type { Notes } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let notes: Notes = {};
    try {
        notes = await loadNotes(supabase, user.id);
    } catch {
        notes = {};
    }
    return NextResponse.json(notes);
}
