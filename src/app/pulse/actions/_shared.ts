import type { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/pulse/utils';

// Shared internals for the server-action files. This module is NOT a 'use server'
// file: it exports a type and synchronous helpers that the action files call
// internally. Server actions stay in the sibling domain files.

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Throw the standard "Invalid id" error unless the value is a UUID.
export function assertUuid(id: string): void {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');
}

// Verify a routine exists and is owned by the user. Mirrors the repeated
// "select id from workout_routines where id and user_id, throw if missing" guard.
export async function assertOwnsRoutine(
    supabase: SupabaseServerClient,
    routineId: string,
    userId: string,
): Promise<void> {
    const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', userId)
        .single();
    if (!routine) throw new Error('Routine not found');
}

interface RoutineExerciseOwnerRow {
    workout_routines: { user_id: string } | null;
}

// Verify the routine exercise exists and its routine is owned by the user.
// Throws to mirror the existing action error contract.
export async function assertOwnsRoutineExercise(
    supabase: SupabaseServerClient,
    routineExerciseId: string,
    userId: string,
): Promise<void> {
    const { data: re } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, workout_routines!inner ( user_id )')
        .eq('id', routineExerciseId)
        .single();

    if (!re) throw new Error('Not found');

    const reData = re as unknown as RoutineExerciseOwnerRow;
    const routineUserId = reData.workout_routines?.user_id;
    if (routineUserId !== userId) throw new Error('Unauthorized');
}
