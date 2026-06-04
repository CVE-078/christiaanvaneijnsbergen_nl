'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { EXERCISE_CATEGORIES } from '@/lib/pulse/types';
import { assertUuid } from './_shared';
import type { DbExercise, ExerciseCategory } from '@/lib/pulse/types';

export async function createExercise(
    name: string,
    category: string,
    defaultSets: string,
    defaultReps: string,
): Promise<DbExercise> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid exercise name');
    if (!EXERCISE_CATEGORIES.includes(category as ExerciseCategory)) throw new Error('Invalid category');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid default sets or reps');

    const { supabase, user } = await getUserOrThrow();

    const { data, error } = await supabase
        .from('exercises')
        .insert({ user_id: user.id, name: trimmed, category, default_sets: trimmedSets, default_reps: trimmedReps })
        .select('id, name, category, default_sets, default_reps, user_id')
        .single();

    if (error || !data) throw new Error('Failed to create exercise');
    return data as DbExercise;
}

export async function updateExercise(
    id: string,
    name: string,
    defaultSets: string,
    defaultReps: string,
): Promise<void> {
    assertUuid(id);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) throw new Error('Invalid exercise name');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid sets/reps');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('exercises')
        .update({ name: trimmedName, default_sets: trimmedSets, default_reps: trimmedReps })
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
