'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogEntry } from '@/lib/pulse/validation';
import { parseLogKey, UUID_RE } from '@/lib/pulse/utils';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { EXERCISE_CATEGORIES } from '@/lib/pulse/types';
import { applyTemplateVolume, generateRoutine } from '@/lib/pulse/generation';
import type { ExerciseMeta } from '@/lib/pulse/generation';
import type { ExperienceLevel, OnboardingAnswers } from '@/lib/pulse/recommendation';
import type {
    LogEntry,
    Unit,
    BodyweightEntry,
    DbExercise,
    WorkoutType,
    WorkoutRoutine,
    RoutineExercise,
    ExerciseCategory,
    SessionTime,
} from '@/lib/pulse/types';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Verify the routine exercise exists and its routine is owned by the user.
// Throws to mirror the existing action error contract.
async function assertOwnsRoutineExercise(
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

    const reData = re as unknown as { workout_routines: { user_id: string } };
    const routineUserId = reData.workout_routines?.user_id;
    if (routineUserId !== userId) throw new Error('Unauthorized');
}

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/pulse/login');
}

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

export async function updateProfile(displayName: string | null, unit: Unit, activeRoutineId?: string | null) {
    if (unit !== 'kg' && unit !== 'lbs') throw new Error('Invalid unit');
    if (displayName !== null && displayName.trim().length > 50)
        throw new Error('Display name must be 50 characters or fewer');
    if (activeRoutineId !== undefined && activeRoutineId !== null && !UUID_RE.test(activeRoutineId))
        throw new Error('Invalid routine id');

    const { supabase, user } = await getUserOrThrow();

    if (activeRoutineId !== undefined && activeRoutineId !== null) {
        const { data: routine } = await supabase
            .from('workout_routines')
            .select('id')
            .eq('id', activeRoutineId)
            .eq('user_id', user.id)
            .single();
        if (!routine) throw new Error('Routine not found');
    }

    const { error } = await supabase.from('profiles').upsert(
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

export async function logBodyWeight(weightKg: number, date?: string): Promise<BodyweightEntry> {
    if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg < 0.5 || weightKg > 500)
        throw new Error('Invalid weight');
    if (date !== undefined && (typeof date !== 'string' || isNaN(new Date(date).getTime())))
        throw new Error('Invalid date');

    const { supabase, user } = await getUserOrThrow();

    const logged_at = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('bodyweight_logs')
        .upsert({ user_id: user.id, logged_at, weight_kg: weightKg }, { onConflict: 'user_id,logged_at' })
        .select('id, logged_at, weight_kg')
        .single();

    if (error || !data) throw new Error('Failed to log body weight');
    return { id: data.id, logged_at: data.logged_at, weight_kg: Number(data.weight_kg) };
}

export async function updateGoalWeight(goalWeightKg: number | null): Promise<void> {
    if (goalWeightKg !== null && (!Number.isFinite(goalWeightKg) || goalWeightKg < 0.5 || goalWeightKg > 500))
        throw new Error('Invalid goal weight');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('profiles').update({ goal_weight_kg: goalWeightKg }).eq('id', user.id);
    if (error) throw new Error('Failed to update goal weight');
    revalidatePath('/pulse');
}

export async function logBodyMeasurement(data: {
    measured_at?: string;
    waist_cm?: number;
    hips_cm?: number;
    chest_cm?: number;
    arms_cm?: number;
}): Promise<void> {
    // Validate each provided measurement is a finite number in a sane range (cm).
    const measurementFields = ['waist_cm', 'hips_cm', 'chest_cm', 'arms_cm'] as const;
    for (const field of measurementFields) {
        const value = data[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 500)
            throw new Error('Invalid measurement');
    }

    if (data.measured_at !== undefined) {
        if (typeof data.measured_at !== 'string' || isNaN(new Date(data.measured_at).getTime()))
            throw new Error('Invalid date');
    }

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        measured_at: data.measured_at ?? new Date().toISOString().split('T')[0],
        waist_cm: data.waist_cm ?? null,
        hips_cm: data.hips_cm ?? null,
        chest_cm: data.chest_cm ?? null,
        arms_cm: data.arms_cm ?? null,
    });
    if (error) throw new Error('Failed to log measurements');
    revalidatePath('/pulse');
}

export async function deleteBodyWeight(id: string) {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('bodyweight_logs').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete entry');
}

// ── Exercise actions ──────────────────────────────────────────────────────────

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
    if (!UUID_RE.test(id)) throw new Error('Invalid id');
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
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete exercise');
}

// ── Routine actions ───────────────────────────────────────────────────────────

export async function createRoutine(name: string): Promise<WorkoutRoutine> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid routine name');

    const { supabase, user } = await getUserOrThrow();

    const { data, error } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: trimmed })
        .select('id, user_id, name, created_at')
        .single();

    if (error || !data) throw new Error('Failed to create routine');
    return data as WorkoutRoutine;
}

export async function renameRoutine(id: string, name: string): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) throw new Error('Invalid routine name');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('workout_routines')
        .update({ name: trimmed })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to rename routine');
}

export async function deleteRoutine(id: string): Promise<void> {
    if (!UUID_RE.test(id)) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('workout_routines').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete routine');

    // If the deleted routine was active, clear active_routine_id on the profile
    const { data: profile } = await supabase.from('profiles').select('active_routine_id').eq('id', user.id).single();

    if (profile?.active_routine_id === id) {
        // Find the most recently created remaining routine to activate
        const { data: others } = await supabase
            .from('workout_routines')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

        const nextId = others?.[0]?.id ?? null;

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ active_routine_id: nextId })
            .eq('id', user.id);
        if (profileError) throw new Error('Failed to update active routine');
    }
}

export async function setActiveRoutine(routineId: string | null): Promise<void> {
    const { supabase, user } = await getUserOrThrow();

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
        .upsert({ id: user.id, active_routine_id: routineId }, { onConflict: 'id' });
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
    variant?: 'A' | 'B' | null,
): Promise<RoutineExercise> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');

    const { supabase, user } = await getUserOrThrow();

    // Verify the routine belongs to the user
    const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', user.id)
        .single();
    if (!routine) throw new Error('Routine not found');

    // Verify the exercise is either a global exercise (user_id null) or owned by the user
    const { data: exercise } = await supabase.from('exercises').select('id, user_id').eq('id', exerciseId).single();
    if (!exercise) throw new Error('Invalid exercise id');
    const exerciseUserId = (exercise as { user_id: string | null }).user_id;
    if (exerciseUserId !== null && exerciseUserId !== user.id) throw new Error('Unauthorized');

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
            variant: variant ?? null,
            order: nextOrder,
            sets,
            reps,
            starting_weight_kg: startingWeightKg,
        })
        .select(
            'id, routine_id, exercise_id, workout_type, variant, order, sets, reps, starting_weight_kg, superset_group_id, exercise:exercises ( id, name, category, default_sets, default_reps, user_id )',
        )
        .single();

    if (error || !data) throw new Error('Failed to add exercise to routine');
    return data as unknown as RoutineExercise;
}

export async function removeExerciseFromRoutine(routineExerciseId: string): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase.from('routine_exercises').delete().eq('id', routineExerciseId);
    if (error) throw new Error('Failed to remove exercise from routine');
}

export async function updateRoutineExercise(
    routineExerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    restSeconds: number | null,
): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');
    if (!sets.trim() || !reps.trim()) throw new Error('Sets and reps must not be empty');

    const { supabase, user } = await getUserOrThrow();

    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase
        .from('routine_exercises')
        .update({ sets, reps, starting_weight_kg: startingWeightKg, rest_seconds: restSeconds })
        .eq('id', routineExerciseId);
    if (error) throw new Error('Failed to update routine exercise');
}

export async function reorderRoutineExercises(routineId: string, orderedIds: string[]): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    if (!Array.isArray(orderedIds) || orderedIds.length > 100) throw new Error('Invalid data');
    if (!orderedIds.every((id) => UUID_RE.test(id))) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

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

// Volume sizing now lives in src/lib/pulse/generation.ts (applyTemplateVolume),
// keyed by session length and experience with a floor that prevents the old
// 30-minute bug of trimming a routine down to a single exercise.

export async function cloneTemplate(
    slug: string,
    trainingDays?: number[],
    sessionTime?: string,
    experience?: ExperienceLevel,
): Promise<WorkoutRoutine> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');

    const { supabase, user } = await getUserOrThrow();

    const { data: template } = await supabase
        .from('routine_templates')
        .select(
            'id, name, schedule_pattern, default_days, template_exercises(exercise_id, workout_type, variant, order, sets, reps)',
        )
        .eq('slug', slug)
        .single();
    if (!template) throw new Error('Template not found');

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: template.name })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    const rawExercises = (template as any).template_exercises as Array<{
        exercise_id: string;
        workout_type: string;
        variant: string | null;
        order: number;
        sets: string;
        reps: string;
    }>;
    const exercises =
        sessionTime && experience
            ? applyTemplateVolume(rawExercises, sessionTime as SessionTime, experience)
            : rawExercises;

    if (exercises.length > 0) {
        const { error: exErr } = await supabase.from('routine_exercises').insert(
            exercises.map((te) => ({
                routine_id: routine.id,
                exercise_id: te.exercise_id,
                workout_type: te.workout_type,
                variant: te.variant ?? null,
                order: te.order,
                sets: te.sets,
                reps: te.reps,
                starting_weight_kg: null,
            })),
        );
        if (exErr) throw new Error('Failed to clone template exercises');
    }

    // Create schedule — zip user's chosen days with the template pattern
    const pattern: string[] = (template as any).schedule_pattern ?? [];
    const defaultDays: number[] = (template as any).default_days ?? [];
    const daysToUse = trainingDays ?? defaultDays;

    if (daysToUse.length > 0 && pattern.length > 0) {
        const sortedDays = [...daysToUse].sort((a, b) => a - b);
        const scheduleRows = sortedDays.map((day, i) => ({
            routine_id: routine.id,
            day_of_week: day,
            workout_type: pattern[i % pattern.length],
        }));
        const { error: schedErr } = await supabase.from('routine_schedule').insert(scheduleRows);
        if (schedErr) throw new Error('Failed to create schedule');
    }

    // Set as active routine
    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, active_routine_id: routine.id }, { onConflict: 'id' });
    if (profileErr) throw new Error('Failed to set active routine');

    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}

export async function generateAndSaveRoutine(
    answers: OnboardingAnswers,
    trainingDays: number[],
    sessionTime: SessionTime,
    name?: string,
): Promise<WorkoutRoutine> {
    const { supabase, user } = await getUserOrThrow();
    if (!trainingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('Invalid training days');

    const { data: pool } = await supabase
        .from('exercises')
        .select('id, category, equipment, movement_pattern, is_compound')
        .is('user_id', null);

    const blueprint = generateRoutine({
        answers,
        sessionTime,
        trainingDays,
        pool: (pool ?? []) as unknown as ExerciseMeta[],
    });

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: name ?? 'Generated routine' })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    if (blueprint.exercises.length > 0) {
        const { error: exErr } = await supabase.from('routine_exercises').insert(
            blueprint.exercises.map((e) => ({
                routine_id: routine.id,
                exercise_id: e.exercise_id,
                workout_type: e.workout_type,
                variant: e.variant,
                order: e.order,
                sets: e.sets,
                reps: e.reps,
                starting_weight_kg: null,
            })),
        );
        if (exErr) throw new Error('Failed to save generated exercises');
    }

    // Schedule maps day -> workout_type. There is no variant column on
    // routine_schedule; A/B lives on routine_exercises and is surfaced via the
    // train-screen tabs.
    const scheduleRows = blueprint.schedule.map((s) => ({
        routine_id: routine.id,
        day_of_week: s.day_of_week,
        workout_type: s.workout_type,
    }));
    if (scheduleRows.length > 0) {
        const { error: schedErr } = await supabase.from('routine_schedule').insert(scheduleRows);
        if (schedErr) throw new Error('Failed to create schedule');
    }

    const { error: profileErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, active_routine_id: routine.id }, { onConflict: 'id' });
    if (profileErr) throw new Error('Failed to set active routine');

    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}

export async function completeOnboarding(): Promise<void> {
    const { supabase, user } = await getUserOrThrow();
    await supabase.from('profiles').upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' });
    revalidatePath('/pulse');
}

// ── Exercise notes actions ────────────────────────────────────────────────────

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
