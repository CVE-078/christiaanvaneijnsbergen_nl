import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { nextVariant } from '@/lib/pulse/sessions';
import { loadSessions } from '@/lib/pulse/queries';
import { UUID_RE } from '@/lib/pulse/utils';
import { WORKOUT_TYPES } from '@/lib/pulse/types';
import type { WorkoutType, WorkoutVariant, WorkoutSession } from '@/lib/pulse/types';

// All of the user's sessions, oldest first. Feeds the client-side adherence
// engine (completion-paced position + calendar adherence).
export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let sessions: WorkoutSession[] = [];
    try {
        sessions = await loadSessions(supabase, user.id);
    } catch {
        sessions = [];
    }
    return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    const body = (await req.json()) as { routineId: string; workoutType: string; variant?: string | null };
    const { routineId, workoutType } = body;
    // The active day pins its variant (routine_schedule.variant), surfaced to the
    // client as the active tab. When provided we record that exact session; only
    // legacy routines without a pin fall back to the A/B toggle below.
    const pinnedVariant: WorkoutVariant | null =
        body.variant === 'A' || body.variant === 'B' || body.variant === 'C' || body.variant === 'D'
            ? body.variant
            : null;

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

    // Return in-progress session if one exists. Match the variant too when one is
    // pinned, so starting Full Body B does not resume an in-progress Full Body A.
    let existingQuery = supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('routine_id', routineId)
        .eq('workout_type', workoutType)
        .is('completed_at', null);
    if (pinnedVariant !== null) existingQuery = existingQuery.eq('variant', pinnedVariant);
    const { data: existing } = await existingQuery.order('started_at', { ascending: false }).limit(1).maybeSingle();

    if (existing) return NextResponse.json(existing);

    let sessionVariant: WorkoutVariant | null = pinnedVariant;
    if (pinnedVariant === null) {
        // Legacy routines without a per-day variant pin: keep the A/B toggle keyed
        // on the last completed session of this workout type.
        const { data: variantRows } = await supabase
            .from('routine_exercises')
            .select('variant')
            .eq('routine_id', routineId)
            .eq('workout_type', workoutType)
            .not('variant', 'is', null)
            .limit(1);

        if ((variantRows?.length ?? 0) > 0) {
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
