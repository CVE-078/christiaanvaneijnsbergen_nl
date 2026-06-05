import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

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
