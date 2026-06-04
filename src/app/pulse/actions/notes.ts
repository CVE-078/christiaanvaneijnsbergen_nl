'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { assertOwnsRoutineExercise } from './_shared';

export async function saveNote(week: number, routineExerciseId: string, note: string): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');
    const trimmed = note.trim();
    if (!trimmed || trimmed.length > 500) throw new Error('Invalid note');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase
        .from('exercise_notes')
        .upsert(
            { user_id: user.id, week, routine_exercise_id: routineExerciseId, note: trimmed },
            { onConflict: 'user_id,week,routine_exercise_id' },
        );
    if (error) throw new Error('Failed to save note');
}

export async function deleteNote(week: number, routineExerciseId: string): Promise<void> {
    if (!Number.isInteger(week) || week < 1 || week > 52) throw new Error('Invalid week');
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid routine exercise id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    await supabase
        .from('exercise_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('week', week)
        .eq('routine_exercise_id', routineExerciseId);
}
