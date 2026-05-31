import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { exerciseAId, exerciseBId } = body as Record<string, unknown>;
    if (typeof exerciseAId !== 'string' || !UUID_RE.test(exerciseAId) ||
        typeof exerciseBId !== 'string' || !UUID_RE.test(exerciseBId)) {
        return NextResponse.json({ error: 'Invalid exercise IDs' }, { status: 400 });
    }
    if (exerciseAId === exerciseBId) {
        return NextResponse.json({ error: 'Cannot pair an exercise with itself' }, { status: 400 });
    }

    // Verify both exercises belong to a routine owned by the user and are not already paired
    const { data: rows, error: fetchError } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, superset_group_id, workout_routines!inner ( user_id )')
        .in('id', [exerciseAId, exerciseBId]);

    if (fetchError || !rows || rows.length !== 2) {
        return NextResponse.json({ error: 'Exercises not found' }, { status: 404 });
    }

    const [a, b] = rows as Array<{ id: string; routine_id: string; superset_group_id: string | null; workout_routines: { user_id: string } }>;
    if (a.workout_routines.user_id !== user.id || b.workout_routines.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (a.routine_id !== b.routine_id) {
        return NextResponse.json({ error: 'Exercises must belong to the same routine' }, { status: 400 });
    }
    if (a.superset_group_id !== null || b.superset_group_id !== null) {
        return NextResponse.json({ error: 'One or both exercises are already in a superset' }, { status: 409 });
    }

    const groupId = crypto.randomUUID();

    const { error: updateError } = await supabase
        .from('routine_exercises')
        .update({ superset_group_id: groupId })
        .in('id', [exerciseAId, exerciseBId]);

    if (updateError) return NextResponse.json({ error: 'Failed to create superset' }, { status: 500 });

    return NextResponse.json({ groupId });
}
