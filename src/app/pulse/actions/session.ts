'use server';
import { validateLogEntry } from '@/lib/pulse/validation';
import { parseLogKey } from '@/lib/pulse/utils';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { assertOwnsRoutineExercise } from './_shared';
import type { LogEntry } from '@/lib/pulse/types';

// Upsert a single set log by its "week-routineExerciseId-setIdx" key. Replaces the
// old whole-table saveLogs rewrite: one targeted upsert per save instead of
// re-writing and re-diffing every logged set on the hot path.
export async function upsertLog(key: string, entry: LogEntry): Promise<void> {
    const parsed = parseLogKey(key);
    if (!parsed) throw new Error('Invalid data');
    if (parsed.week < 1 || parsed.week > 52 || parsed.setIdx < 0 || parsed.setIdx > 9) throw new Error('Invalid data');
    if (!validateLogEntry(entry)) throw new Error('Invalid data');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, parsed.routineExerciseId, user.id);

    const { error } = await supabase.from('set_logs').upsert(
        {
            user_id: user.id,
            week: parsed.week,
            routine_exercise_id: parsed.routineExerciseId,
            set_idx: parsed.setIdx,
            kg: entry.kg,
            reps: entry.reps,
            rir: entry.rir,
            saved: true,
            drops: Array.isArray(entry.drops) && entry.drops.length > 0 ? entry.drops : null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,week,routine_exercise_id,set_idx' },
    );
    if (error) throw new Error('Failed to save');
}

// Delete a single set log by its key (the user removed a set).
export async function deleteLogRow(key: string): Promise<void> {
    const parsed = parseLogKey(key);
    if (!parsed) throw new Error('Invalid data');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutineExercise(supabase, parsed.routineExerciseId, user.id);

    const { error } = await supabase
        .from('set_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('week', parsed.week)
        .eq('routine_exercise_id', parsed.routineExerciseId)
        .eq('set_idx', parsed.setIdx);
    if (error) throw new Error('Failed to delete');
}
