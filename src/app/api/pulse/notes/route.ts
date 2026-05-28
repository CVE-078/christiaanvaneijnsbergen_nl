import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Notes } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('exercise_notes')
        .select('week, routine_exercise_id, note')
        .eq('user_id', user.id);

    const notes: Notes = {};
    for (const row of data ?? []) {
        notes[`${row.week}-${row.routine_exercise_id}`] = row.note;
    }
    return NextResponse.json(notes);
}
