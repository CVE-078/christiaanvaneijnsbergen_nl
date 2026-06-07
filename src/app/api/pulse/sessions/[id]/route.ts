import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    // An empty body means "complete this session" (the original behavior). A body
    // with rpe/note means "save the debrief" on an already-completed session.
    const body = (await req.json().catch(() => ({}))) as { rpe?: number | null; note?: string | null };
    const isDebrief = 'rpe' in body || 'note' in body;

    if (isDebrief) {
        const update: { session_rpe?: number | null; session_note?: string | null } = {};
        if ('rpe' in body) {
            const rpe = body.rpe ?? null;
            if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) {
                return NextResponse.json({ error: 'rpe must be an integer 1-10 or null' }, { status: 400 });
            }
            update.session_rpe = rpe;
        }
        if ('note' in body) {
            const note = body.note;
            if (note !== null && typeof note !== 'string') {
                return NextResponse.json({ error: 'note must be a string or null' }, { status: 400 });
            }
            const trimmed = typeof note === 'string' ? note.trim().slice(0, 1000) : null;
            update.session_note = trimmed && trimmed.length > 0 ? trimmed : null;
        }
        const { data, error } = await supabase
            .from('workout_sessions')
            .update(update)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();
        if (error || !data) return NextResponse.json(null, { status: 404 });
        return NextResponse.json(data);
    }

    // Completion path (unchanged).
    const { data, error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

    if (error || !data) return NextResponse.json(null, { status: 404 });

    // Anchor the program calendar to the first completed session of the routine
    // (clock starts when training actually begins). Best-effort; never blocks
    // the completion response. The `is null` guard makes this a one-time set.
    if (data.routine_id && data.completed_at) {
        await supabase
            .from('workout_routines')
            .update({ program_anchor: data.completed_at })
            .eq('id', data.routine_id)
            .eq('user_id', user.id)
            .is('program_anchor', null);
    }

    return NextResponse.json(data);
}
