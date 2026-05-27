'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import type { Logs, Unit, BodyweightEntry, DbExercise, WorkoutType, WorkoutRoutine, RoutineExercise, ExerciseCategory } from '@/lib/pulse/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/pulse/login');
}

export async function saveLogs(logs: unknown) {
    if (!validateLogs(logs)) throw new Error('Invalid data');
    if (Object.keys(logs).length > 2000) throw new Error('Data too large');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const validLogs = logs as Logs;
    const savedEntries = Object.entries(validLogs).filter(([, v]) => v.saved);

    // Upsert all current saved entries
    if (savedEntries.length > 0) {
        const rows = savedEntries.map(([key, val]) => {
            // Parse new key format: "week-routineExerciseId-setIdx"
            // The middle segment is a UUID v4 (with internal dashes), setIdx is last segment
            const lastDash = key.lastIndexOf('-');
            const firstDash = key.indexOf('-');
            const week = Number(key.slice(0, firstDash));
            const routine_exercise_id = key.slice(firstDash + 1, lastDash);
            const set_idx = Number(key.slice(lastDash + 1));
            return {
                user_id: user.id,
                week,
                routine_exercise_id,
                set_idx,
                kg: val.kg,
                reps: val.reps,
                rir: val.rir,
                saved: true,
                updated_at: new Date().toISOString(),
            };
        });

        const { error } = await supabase
            .from('set_logs')
            .upsert(rows, { onConflict: 'user_id,week,routine_exercise_id,set_idx' });
        if (error) throw new Error('Failed to save');
    }

    // Delete rows in DB that are no longer in the current logs (e.g. user deleted a set)
    const currentKeys = new Set(savedEntries.map(([k]) => k));
    const { data: existing } = await supabase
        .from('set_logs')
        .select('week, routine_exercise_id, set_idx')
        .eq('user_id', user.id);

    const toDelete = (existing ?? []).filter(
        (row: { week: number; routine_exercise_id: string; set_idx: number }) =>
            !currentKeys.has(`${row.week}-${row.routine_exercise_id}-${row.set_idx}`),
    );

    if (toDelete.length > 0) {
        const keysToDelete = new Set(
            toDelete.map(
                (row: { week: number; routine_exercise_id: string; set_idx: number }) =>
                    `${row.week}-${row.routine_exercise_id}-${row.set_idx}`,
            ),
        );

        const { data: rowsWithIds } = await supabase
            .from('set_logs')
            .select('id, week, routine_exercise_id, set_idx')
            .eq('user_id', user.id);

        const idsToDelete = (rowsWithIds ?? [])
            .filter((r: { id: string; week: number; routine_exercise_id: string; set_idx: number }) =>
                keysToDelete.has(`${r.week}-${r.routine_exercise_id}-${r.set_idx}`),
            )
            .map((r: { id: string }) => r.id);

        if (idsToDelete.length > 0) {
            await supabase.from('set_logs').delete().in('id', idsToDelete).eq('user_id', user.id);
        }
    }

    revalidatePath('/pulse');
}

export async function updateProfile(
    displayName: string | null,
    unit: Unit,
    activeRoutineId?: string | null,
) {
    if (displayName !== null && displayName.trim().length > 50)
        throw new Error('Display name must be 50 characters or fewer');
    if (activeRoutineId !== undefined && activeRoutineId !== null && !UUID_RE.test(activeRoutineId))
        throw new Error('Invalid routine id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    if (activeRoutineId !== undefined && activeRoutineId !== null) {
        const { data: routine } = await supabase
            .from('workout_routines')
            .select('id')
            .eq('id', activeRoutineId)
            .eq('user_id', user.id)
            .single();
        if (!routine) throw new Error('Routine not found');
    }

    const { error } = await supabase
        .from('profiles')
        .upsert(
            {
                id: user.id,
                display_name: displayName,
                unit,
                ...(activeRoutineId !== undefined ? { active_routine_id: activeRoutineId } : {}),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' },
        );
    if (error) throw new Error('Failed to update profile');
}

export async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
    if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg < 0.5 || weightKg > 500)
        throw new Error('Invalid weight');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('bodyweight_logs')
        .upsert({ user_id: user.id, logged_at: today, weight_kg: weightKg }, { onConflict: 'user_id,logged_at' })
        .select('id, logged_at, weight_kg')
        .single();

    if (error || !data) throw new Error('Failed to log body weight');
    return { id: data.id, logged_at: data.logged_at, weight_kg: Number(data.weight_kg) };
}

export async function deleteBodyWeight(id: string) {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('bodyweight_logs').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete entry');
}

// ── Exercise actions ──────────────────────────────────────────────────────────

const VALID_CATEGORIES: ExerciseCategory[] = [
  'chest','shoulders','triceps','back','biceps','legs','glutes','calves','abs','other',
];

export async function createExercise(
    name: string,
    category: string,
    defaultSets: string,
    defaultReps: string,
): Promise<DbExercise> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid exercise name');
    if (!VALID_CATEGORIES.includes(category as ExerciseCategory)) throw new Error('Invalid category');
    const trimmedSets = defaultSets.trim();
    const trimmedReps = defaultReps.trim();
    if (!trimmedSets || !trimmedReps) throw new Error('Invalid default sets or reps');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('exercises')
        .insert({ user_id: user.id, name: trimmed, category, default_sets: trimmedSets, default_reps: trimmedReps })
        .select('id, name, category, default_sets, default_reps, user_id')
        .single();

    if (error || !data) throw new Error('Failed to create exercise');
    return data as DbExercise;
}

export async function updateExercise(id: string, name: string): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid exercise name');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('exercises')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update exercise');
}

export async function deleteExercise(id: string): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete exercise');
}

// ── Routine actions ───────────────────────────────────────────────────────────

export async function createRoutine(name: string): Promise<WorkoutRoutine> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid routine name');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: trimmed })
        .select('id, user_id, name, created_at')
        .single();

    if (error || !data) throw new Error('Failed to create routine');
    return data as WorkoutRoutine;
}

export async function deleteRoutine(id: string): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { error } = await supabase.from('workout_routines').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete routine');

    // If the deleted routine was active, clear active_routine_id on the profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('active_routine_id')
        .eq('id', user.id)
        .single();

    if (profile?.active_routine_id === id) {
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ active_routine_id: null })
            .eq('id', user.id);
        if (profileError) throw new Error('Failed to clear active routine');
    }
}

export async function setActiveRoutine(routineId: string | null): Promise<void> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    if (routineId !== null) {
        if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
        const { data: routine } = await supabase
            .from('workout_routines')
            .select('id')
            .eq('id', routineId)
            .eq('user_id', user.id)
            .single();
        if (!routine) throw new Error('Routine not found');
    }

    const { error } = await supabase
        .from('profiles')
        .update({ active_routine_id: routineId })
        .eq('id', user.id);
    if (error) throw new Error('Failed to set active routine');
}

// ── Routine exercise actions ──────────────────────────────────────────────────

export async function addExerciseToRoutine(
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
): Promise<RoutineExercise> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Verify the routine belongs to the user
    const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', user.id)
        .single();
    if (!routine) throw new Error('Routine not found');

    // Determine next order
    const { data: existing } = await supabase
        .from('routine_exercises')
        .select('order')
        .eq('routine_id', routineId)
        .order('order', { ascending: false })
        .limit(1);

    const nextOrder = existing && existing.length > 0 ? (existing[0].order as number) + 1 : 1;

    const { data, error } = await supabase
        .from('routine_exercises')
        .insert({
            routine_id: routineId,
            exercise_id: exerciseId,
            workout_type: workoutType,
            order: nextOrder,
            sets,
            reps,
            starting_weight_kg: startingWeightKg,
        })
        .select('id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, exercise:exercises ( id, name, category, default_sets, default_reps, user_id )')
        .single();

    if (error || !data) throw new Error('Failed to add exercise to routine');
    return data as unknown as RoutineExercise;
}

export async function removeExerciseFromRoutine(routineExerciseId: string): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership via the routine
    const { data: re } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, workout_routines!inner ( user_id )')
        .eq('id', routineExerciseId)
        .single();

    if (!re) throw new Error('Not found');

    const reData = re as unknown as { workout_routines: { user_id: string } };
    const routineUserId = reData.workout_routines?.user_id;
    if (routineUserId !== user.id) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('routine_exercises')
        .delete()
        .eq('id', routineExerciseId);
    if (error) throw new Error('Failed to remove exercise from routine');
}

export async function updateRoutineExercise(
    routineExerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');
    if (!sets.trim() || !reps.trim()) throw new Error('Sets and reps must not be empty');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Verify ownership via the routine
    const { data: re } = await supabase
        .from('routine_exercises')
        .select('id, routine_id, workout_routines!inner ( user_id )')
        .eq('id', routineExerciseId)
        .single();

    if (!re) throw new Error('Not found');

    const reData = re as unknown as { workout_routines: { user_id: string } };
    const routineUserId = reData.workout_routines?.user_id;
    if (routineUserId !== user.id) throw new Error('Unauthorized');

    const { error } = await supabase
        .from('routine_exercises')
        .update({ sets, reps, starting_weight_kg: startingWeightKg })
        .eq('id', routineExerciseId);
    if (error) throw new Error('Failed to update routine exercise');
}

export async function reorderRoutineExercises(
    routineId: string,
    orderedIds: string[],
): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Verify the routine belongs to the user
    const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', user.id)
        .single();
    if (!routine) throw new Error('Routine not found');

    const results = await Promise.all(
        orderedIds.map((id, index) =>
            supabase
                .from('routine_exercises')
                .update({ order: index + 1 })
                .eq('id', id)
                .eq('routine_id', routineId),
        ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error('Failed to reorder exercises');
}

export async function cloneTemplate(slug: string): Promise<WorkoutRoutine> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: template } = await supabase
        .from('routine_templates')
        .select('id, name, template_exercises(exercise_id, workout_type, order, sets, reps)')
        .eq('slug', slug)
        .single();
    if (!template) throw new Error('Template not found');

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: template.name })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    const exercises = (template as any).template_exercises as Array<{
        exercise_id: string; workout_type: string; order: number; sets: string; reps: string;
    }>;

    if (exercises.length > 0) {
        const { error: exErr } = await supabase.from('routine_exercises').insert(
            exercises.map((te) => ({
                routine_id: routine.id,
                exercise_id: te.exercise_id,
                workout_type: te.workout_type,
                order: te.order,
                sets: te.sets,
                reps: te.reps,
                starting_weight_kg: null,
            })),
        );
        if (exErr) throw new Error('Failed to clone template exercises');
    }

    // Side effect by design: cloning a template immediately activates it for onboarding flow.
    const { error: profileErr } = await supabase
        .from('profiles')
        .update({ active_routine_id: routine.id })
        .eq('id', user.id);
    if (profileErr) throw new Error('Failed to activate cloned routine');
    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}

export async function completeOnboarding(): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
    revalidatePath('/pulse');
}
