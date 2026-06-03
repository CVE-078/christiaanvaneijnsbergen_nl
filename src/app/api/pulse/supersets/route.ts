import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';

export async function POST(request: Request) {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (response) return response;

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
        .select('id, routine_id, order, superset_group_id, workout_routines!inner ( user_id )')
        .in('id', [exerciseAId, exerciseBId]);

    if (fetchError || !rows || rows.length !== 2) {
        return NextResponse.json({ error: 'Exercises not found' }, { status: 404 });
    }

    const [a, b] = rows as unknown as Array<{ id: string; routine_id: string; order: number; superset_group_id: string | null; workout_routines: { user_id: string } }>;
    if (a.workout_routines.user_id !== user.id || b.workout_routines.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (a.routine_id !== b.routine_id) {
        return NextResponse.json({ error: 'Exercises must belong to the same routine' }, { status: 400 });
    }
    // Adjacency by sorted position, not raw order values: deletes leave gaps in
    // `order`, so two genuinely adjacent rows can differ by more than 1.
    const { data: routineRows, error: orderError } = await supabase
        .from('routine_exercises')
        .select('id, order')
        .eq('routine_id', a.routine_id)
        .order('order', { ascending: true });
    if (orderError || !routineRows) {
        return NextResponse.json({ error: 'Failed to verify adjacency' }, { status: 500 });
    }
    const posA = routineRows.findIndex((r) => r.id === exerciseAId);
    const posB = routineRows.findIndex((r) => r.id === exerciseBId);
    if (posA === -1 || posB === -1 || Math.abs(posA - posB) !== 1) {
        return NextResponse.json({ error: 'Exercises must be adjacent in the routine' }, { status: 400 });
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
