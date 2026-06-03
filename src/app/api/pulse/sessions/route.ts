import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { nextVariant } from '@/lib/pulse/sessions';
import { UUID_RE } from '@/lib/pulse/utils';
import { WORKOUT_TYPES } from '@/lib/pulse/types';
import type { WorkoutType } from '@/lib/pulse/types';

export async function POST(req: NextRequest) {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    const body = (await req.json()) as { routineId: string; workoutType: string };
    const { routineId, workoutType } = body;

    if (!routineId || !workoutType) {
        return NextResponse.json({ error: 'Missing routineId or workoutType' }, { status: 400 });
    }

    if (!UUID_RE.test(routineId)) {
        return NextResponse.json({ error: 'Invalid routineId' }, { status: 400 });
    }

    if (!(WORKOUT_TYPES as readonly string[]).includes(workoutType)) {
        return NextResponse.json({ error: 'Invalid workoutType' }, { status: 400 });
    }

    // Verify the routine belongs to the current user before doing anything else.
    const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (!routine) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });

    // Return in-progress session if one exists
    const { data: existing } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('routine_id', routineId)
        .eq('workout_type', workoutType)
        .is('completed_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) return NextResponse.json(existing);

    // Check whether this workout type has A/B exercises
    const { data: variantRows } = await supabase
        .from('routine_exercises')
        .select('variant')
        .eq('routine_id', routineId)
        .eq('workout_type', workoutType)
        .not('variant', 'is', null)
        .limit(1);

    const hasVariants = (variantRows?.length ?? 0) > 0;

    let sessionVariant: 'A' | 'B' | null = null;
    if (hasVariants) {
        const { data: lastSession } = await supabase
            .from('workout_sessions')
            .select('variant')
            .eq('user_id', user.id)
            .eq('routine_id', routineId)
            .eq('workout_type', workoutType)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        sessionVariant = nextVariant(lastSession?.variant ?? null);
    }

    const { data: session, error } = await supabase
        .from('workout_sessions')
        .insert({
            user_id: user.id,
            routine_id: routineId,
            workout_type: workoutType as WorkoutType,
            variant: sessionVariant,
        })
        .select()
        .single();

    if (error || !session) return NextResponse.json(null, { status: 500 });
    return NextResponse.json(session, { status: 201 });
}
