import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { RoutineWithExercises } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data, error } = await supabase
        .from('workout_routines')
        .select(`
            id, user_id, name, created_at,
            exercises:routine_exercises (
                id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg,
                exercise:exercises ( id, name, category, default_sets, default_reps, user_id )
            ),
            schedule:routine_schedule ( day_of_week, workout_type )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    if (error) return NextResponse.json(null, { status: 500 });

    // Sort each routine's exercises by "order" ascending and schedule by day_of_week
    const routines: RoutineWithExercises[] = (data ?? []).map((routine) => ({
        ...routine,
        exercises: [...(routine.exercises ?? [])].sort((a, b) => (a.order as number) - (b.order as number)),
        schedule: [...(routine.schedule ?? [])].sort((a, b) => a.day_of_week - b.day_of_week),
    })) as unknown as RoutineWithExercises[];

    return NextResponse.json(routines);
}
