'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { EXERCISE_CATEGORIES } from '@/lib/pulse/types';
import { assertUuid } from './_shared';
import type { DbExercise, ExerciseCategory, ExercisePreference } from '@/lib/pulse/types';

// Set or clear a user's preference for an exercise. preference is 'hidden'
// (never-show), 'favorite' (pin to top), or null to clear. The row is keyed
// to auth.uid() and RLS-scoped, so a user can only ever affect their own
// preferences.
export async function setExercisePreference(
    exerciseId: string,
    preference: ExercisePreference | null,
): Promise<void> {
    assertUuid(exerciseId);
    if (preference !== null && preference !== 'hidden' && preference !== 'favorite')
        throw new Error('Invalid preference');

    const { supabase, user } = await getUserOrThrow();

    if (preference === null) {
        const { error } = await supabase
            .from('user_exercise_preferences')
            .delete()
            .eq('user_id', user.id)
            .eq('exercise_id', exerciseId);
        if (error) throw new Error('Failed to update preference');
        return;
    }

    const { error } = await supabase
        .from('user_exercise_preferences')
        .upsert({ user_id: user.id, exercise_id: exerciseId, preference }, { onConflict: 'user_id,exercise_id' });
    if (error) throw new Error('Failed to update preference');
}

export interface ExerciseMetaInput {
    movement_pattern?: string | null;
    equipment?: string[] | null;
    is_compound?: boolean | null;
}

export async function createExercise(
    name: string,
    category: string,
    defaultSets: string,
    defaultReps: string,
    meta?: ExerciseMetaInput,
): Promise<DbExercise> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid exercise name');
    if (!EXERCISE_CATEGORIES.includes(category as ExerciseCategory)) throw new Error('Invalid category');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid default sets or reps');

    const { supabase, user } = await getUserOrThrow();

    const insert: Record<string, unknown> = {
        user_id: user.id, name: trimmed, category, default_sets: trimmedSets, default_reps: trimmedReps,
    };
    if (meta?.movement_pattern !== undefined) insert.movement_pattern = meta.movement_pattern;
    if (meta?.equipment !== undefined) insert.equipment = meta.equipment;
    if (meta?.is_compound !== undefined) insert.is_compound = meta.is_compound;

    const { data, error } = await supabase
        .from('exercises')
        .insert(insert)
        .select('id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound, substitution_class, contraindications')
        .single();

    if (error || !data) throw new Error('Failed to create exercise');
    return data as DbExercise;
}

export async function updateExercise(
    id: string,
    name: string,
    category: string,
    defaultSets: string,
    defaultReps: string,
    meta?: ExerciseMetaInput,
): Promise<void> {
    assertUuid(id);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) throw new Error('Invalid exercise name');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid sets/reps');
    if (!EXERCISE_CATEGORIES.includes(category as ExerciseCategory)) throw new Error('Invalid category');

    const { supabase, user } = await getUserOrThrow();

    const update: Record<string, unknown> = { name: trimmedName, category, default_sets: trimmedSets, default_reps: trimmedReps };
    if (meta?.movement_pattern !== undefined) update.movement_pattern = meta.movement_pattern;
    if (meta?.equipment !== undefined) update.equipment = meta.equipment;
    if (meta?.is_compound !== undefined) update.is_compound = meta.is_compound;

    const { error } = await supabase
        .from('exercises')
        .update(update)
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update exercise');
}

export async function deleteExercise(id: string): Promise<void> {
    assertUuid(id);

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete exercise');
}
