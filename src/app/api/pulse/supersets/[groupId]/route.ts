import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const { groupId } = await params;
    if (!UUID_RE.test(groupId)) {
        return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the exercises belong to the user before clearing
    const { data: rows, error: fetchError } = await supabase
        .from('routine_exercises')
        .select('id, workout_routines!inner ( user_id )')
        .eq('superset_group_id', groupId);

    if (fetchError) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Superset not found' }, { status: 404 });

    const owned = (rows as Array<{ id: string; workout_routines: { user_id: string } }>)
        .every(r => r.workout_routines.user_id === user.id);
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error: updateError } = await supabase
        .from('routine_exercises')
        .update({ superset_group_id: null })
        .eq('superset_group_id', groupId);

    if (updateError) return NextResponse.json({ error: 'Failed to remove superset' }, { status: 500 });

    return NextResponse.json({ ok: true });
}
