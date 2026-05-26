import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DbExercise } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    // Returns all global exercises (user_id IS NULL) + user's own exercises
    const { data, error } = await supabase
        .from('exercises')
        .select('id, name, category, default_sets, default_reps, user_id')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name', { ascending: true });

    if (error) return NextResponse.json(null, { status: 500 });

    // Sort: global first (user_id IS NULL), then user's own, both alphabetically by name
    const exercises: DbExercise[] = (data ?? []).sort((a, b) => {
        if (a.user_id === null && b.user_id !== null) return -1;
        if (a.user_id !== null && b.user_id === null) return 1;
        return a.name.localeCompare(b.name);
    });

    return NextResponse.json(exercises);
}
