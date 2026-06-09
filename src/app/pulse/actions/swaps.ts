'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { SWAP_REASONS, type SwapReason } from '@/lib/pulse/types';
import { assertOwnsRoutineExercise } from './_shared';

export async function setExerciseSwap(
    routineExerciseId: string,
    week: number,
    exerciseId: string,
    reason?: SwapReason,
): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');
    if (reason !== undefined && !(SWAP_REASONS as readonly string[]).includes(reason)) {
        throw new Error('Invalid swap reason');
    }

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { data: exercise } = await supabase.from('exercises').select('user_id').eq('id', exerciseId).single();
    if (!exercise) throw new Error('Invalid exercise id');
    const exUserId = (exercise as { user_id: string | null }).user_id;
    if (exUserId !== null && exUserId !== user.id) throw new Error('Unauthorized');

    // Capture what this swap replaces (the slot's current catalog exercise) so
    // behavior learning (#7) has a reliable "from"; routine_exercises.exercise_id
    // is mutable (a permanent swap overwrites it), so it must be snapshotted now,
    // not recovered later.
    const { data: slot } = await supabase
        .from('routine_exercises')
        .select('exercise_id')
        .eq('id', routineExerciseId)
        .single();
    const fromExerciseId = (slot as { exercise_id: string } | null)?.exercise_id ?? null;

    const { error } = await supabase.from('exercise_swaps').upsert(
        {
            user_id: user.id,
            routine_exercise_id: routineExerciseId,
            week,
            exercise_id: exerciseId,
            from_exercise_id: fromExerciseId,
            // Refresh on re-swap so behavior learning's recency window (#7) dates
            // from the latest swap, not the first time this slot/week was touched.
            created_at: new Date().toISOString(),
            // #8: an un-tagged re-swap clears any prior reason (latest intent wins).
            reason: reason ?? null,
        },
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
