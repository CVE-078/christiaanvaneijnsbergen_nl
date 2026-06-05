'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { assertOwnsRoutineExercise } from './_shared';

export async function setExerciseSwap(
    routineExerciseId: string,
    week: number,
    exerciseId: string,
): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { data: exercise } = await supabase.from('exercises').select('user_id').eq('id', exerciseId).single();
    if (!exercise) throw new Error('Invalid exercise id');
    const exUserId = (exercise as { user_id: string | null }).user_id;
    if (exUserId !== null && exUserId !== user.id) throw new Error('Unauthorized');

    const { error } = await supabase.from('exercise_swaps').upsert(
        { user_id: user.id, routine_exercise_id: routineExerciseId, week, exercise_id: exerciseId },
        { onConflict: 'user_id,routine_exercise_id,week' },
    );
    if (error) throw new Error('Failed to save swap');
}

export async function clearExerciseSwap(routineExerciseId: string, week: number): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase
        .from('exercise_swaps')
        .delete()
        .eq('user_id', user.id)
        .eq('week', week)
        .eq('routine_exercise_id', routineExerciseId);
    if (error) throw new Error('Failed to clear swap');
}
