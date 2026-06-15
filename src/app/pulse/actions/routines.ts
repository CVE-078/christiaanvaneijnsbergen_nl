'use server';
import { revalidatePath } from 'next/cache';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import {
    applyTemplateVolume,
    buildRationale,
    generateRoutine,
    usablePool,
    orderTrainingDays,
    resolveStyle,
    resolvePriority,
    genderDefault,
} from '@/lib/pulse/generation';
import type { ExerciseMeta } from '@/lib/pulse/generation';
import { validateProgram } from '@/lib/pulse/programValidation';
import { EXPERIENCE_LEVELS, GOALS, type ExperienceLevel, type OnboardingAnswers } from '@/lib/pulse/recommendation';
import { isWeeklyFrequency } from '@/lib/pulse/weeklyFrequency';
import { EQUIPMENT_KEYS, RESTRICTION_FLAGS } from '@/lib/pulse/types';
import type {
    WorkoutType,
    WorkoutVariant,
    WorkoutRoutine,
    RoutineExercise,
    SessionTime,
    EquipmentKey,
    TrainingStyle,
    VarietyPreference,
    LoadingPreference,
    RestrictionFlag,
} from '@/lib/pulse/types';
import { assertUuid, assertOwnsRoutine, assertOwnsRoutineExercise } from './_shared';
import { loadHiddenExerciseIds, loadSwapHistory } from '@/lib/pulse/queries';
import { analyzeSwapBehavior, EMPTY_BEHAVIOR } from '@/lib/pulse/behavior';
import { BEHAVIOR_MIN_SWAPS, BEHAVIOR_RECENCY_DAYS } from '@/lib/pulse/constants';

// Allowed session-time values (matches the SessionTime union).
const SESSION_TIMES: readonly SessionTime[] = ['~30 min', '45–60 min', '90+ min'];

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
    assertUuid(id);
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

const PROGRAM_LENGTHS = [8, 10, 12, 16];

export async function updateRoutineProgramWeeks(id: string, weeks: number): Promise<void> {
    assertUuid(id);
    if (!PROGRAM_LENGTHS.includes(weeks)) throw new Error('Invalid program length');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('workout_routines')
        .update({ program_weeks: weeks })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update program length');
}

// Set when the program "week 1" begins. Drives only the calendar adherence
// overlay (calendar week / expected sessions / behind state), not completion-
// paced progression, so it never alters logged data.
export async function setProgramAnchor(id: string, anchorISO: string): Promise<void> {
    assertUuid(id);
    if (typeof anchorISO !== 'string' || isNaN(new Date(anchorISO).getTime()))
        throw new Error('Invalid program start date');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('workout_routines')
        .update({ program_anchor: anchorISO })
        .eq('id', id)
        .eq('user_id', user.id);
    if (error) throw new Error('Failed to update program start');
}

export async function deleteRoutine(id: string): Promise<void> {
    assertUuid(id);

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

export async function addExerciseToRoutine(
    routineId: string,
    exerciseId: string,
    sets: string,
    reps: string,
    startingWeightKg: number | null,
    workoutType: WorkoutType,
    variant?: WorkoutVariant | null,
): Promise<RoutineExercise> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    if (!UUID_RE.test(exerciseId)) throw new Error('Invalid exercise id');

    const { supabase, user } = await getUserOrThrow();

    // Verify the routine belongs to the user
    await assertOwnsRoutine(supabase, routineId, user.id);

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
    // The select aliases `exercise:exercises` to a single related row; the
    // generated client types it as an array, so narrow it to RoutineExercise.
    return data as unknown as RoutineExercise;
}

export async function removeExerciseFromRoutine(routineExerciseId: string): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');

    const { supabase, user } = await getUserOrThrow();

    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase.from('routine_exercises').delete().eq('id', routineExerciseId);
    if (error) throw new Error('Failed to remove exercise from routine');
}

export async function swapRoutineExercisePermanently(routineExerciseId: string, newExerciseId: string): Promise<void> {
    if (!UUID_RE.test(routineExerciseId)) throw new Error('Invalid id');
    if (!UUID_RE.test(newExerciseId)) throw new Error('Invalid exercise id');

    const { supabase, user } = await getUserOrThrow();

    await assertOwnsRoutineExercise(supabase, routineExerciseId, user.id);

    const { error } = await supabase
        .from('routine_exercises')
        .update({ exercise_id: newExerciseId })
        .eq('id', routineExerciseId);
    if (error) throw new Error('Failed to swap routine exercise');
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
    await assertOwnsRoutine(supabase, routineId, user.id);

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

// Shape of a row in routine_templates.template_exercises (the embedded join).
interface TemplateExerciseRow {
    exercise_id: string;
    workout_type: string;
    variant: string | null;
    order: number;
    sets: string;
    reps: string;
}

// Shape of the routine_templates row returned by cloneTemplate's select.
interface RoutineTemplateRow {
    id: string;
    name: string;
    schedule_pattern: string[] | null;
    default_days: number[] | null;
    template_exercises: TemplateExerciseRow[] | null;
}

export async function cloneTemplate(
    slug: string,
    trainingDays?: number[],
    sessionTime?: string,
    experience?: ExperienceLevel,
    startAnchor?: string,
): Promise<WorkoutRoutine> {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');
    // Harden the client-supplied shaping inputs (mirrors generateAndSaveRoutine):
    // trainingDays become routine_schedule.day_of_week rows, so an out-of-range day
    // would write a junk schedule entry; sessionTime/experience drive volume sizing.
    if (trainingDays !== undefined && !trainingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
        throw new Error('Invalid training days');
    if (sessionTime !== undefined && !SESSION_TIMES.includes(sessionTime as SessionTime))
        throw new Error('Invalid session time');
    if (experience !== undefined && !EXPERIENCE_LEVELS.includes(experience)) throw new Error('Invalid experience');
    if (startAnchor !== undefined && (typeof startAnchor !== 'string' || isNaN(new Date(startAnchor).getTime())))
        throw new Error('Invalid start date');

    const { supabase, user } = await getUserOrThrow();

    const { data: templateRow } = await supabase
        .from('routine_templates')
        .select(
            'id, name, schedule_pattern, default_days, template_exercises(exercise_id, workout_type, variant, order, sets, reps)',
        )
        .eq('slug', slug)
        .single();
    if (!templateRow) throw new Error('Template not found');
    const template = templateRow as RoutineTemplateRow;

    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: template.name })
        .select('id, user_id, name, created_at')
        .single();
    if (routineErr || !routine) throw new Error('Failed to create routine');

    const rawExercises: TemplateExerciseRow[] = template.template_exercises ?? [];
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

    // Create schedule, zip user's chosen days with the template pattern
    const pattern: string[] = template.schedule_pattern ?? [];
    const defaultDays: number[] = template.default_days ?? [];
    const daysToUse = trainingDays ?? defaultDays;

    if (daysToUse.length > 0 && pattern.length > 0) {
        // Order from the start weekday (default Monday) so the pattern's first
        // session lands on the first trained day on/after the start date, not on
        // the lowest weekday number (which would pin it to Sunday when selected).
        const anchorDow = startAnchor ? new Date(startAnchor).getUTCDay() : new Date().getUTCDay();
        const sortedDays = orderTrainingDays(daysToUse, anchorDow);
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

// Shape of an exercise pool row used to seed the generator.
interface ExercisePoolRow {
    id: string;
    name: string;
    category: ExerciseMeta['category'];
    equipment: EquipmentKey[] | null;
    movement_pattern: ExerciseMeta['movement_pattern'];
    is_compound: boolean;
    fatigue: number | null;
    substitution_class: string | null;
    unilateral: boolean | null;
    contraindications: RestrictionFlag[] | null;
    difficulty: ExerciseMeta['difficulty'] | null;
}

export async function generateAndSaveRoutine(
    answers: OnboardingAnswers,
    trainingDays: number[],
    sessionTime: SessionTime,
    styleKey: string,
    name?: string,
    trainingStyle?: TrainingStyle,
    varietyPreference?: VarietyPreference,
    loadingLean?: LoadingPreference,
    movementRestrictions?: RestrictionFlag[],
    startAnchor?: string,
): Promise<WorkoutRoutine> {
    if (!trainingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) throw new Error('Invalid training days');

    // Harden the onboarding answers against forged values.
    if (!EXPERIENCE_LEVELS.includes(answers.experience)) throw new Error('Invalid data');
    if (!GOALS.includes(answers.goal)) throw new Error('Invalid data');
    if (!isWeeklyFrequency(answers.days)) throw new Error('Invalid data');
    if (!(answers.equipment instanceof Set) || ![...answers.equipment].every((e) => EQUIPMENT_KEYS.includes(e)))
        throw new Error('Invalid data');
    if (!SESSION_TIMES.includes(sessionTime)) throw new Error('Invalid data');
    const TRAINING_STYLE_VALUES = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'] as const;
    if (trainingStyle !== undefined && !TRAINING_STYLE_VALUES.includes(trainingStyle)) throw new Error('Invalid data');
    const VARIETY_PREFERENCE_VALUES = ['consistent', 'varied'] as const;
    if (varietyPreference !== undefined && !VARIETY_PREFERENCE_VALUES.includes(varietyPreference))
        throw new Error('Invalid data');
    const LOADING_LEAN_VALUES = ['barbell', 'dumbbell', 'machine', 'cable'] as const;
    if (loadingLean !== undefined && !LOADING_LEAN_VALUES.includes(loadingLean)) throw new Error('Invalid data');
    if (
        movementRestrictions !== undefined &&
        (!Array.isArray(movementRestrictions) || !movementRestrictions.every((r) => RESTRICTION_FLAGS.includes(r)))
    )
        throw new Error('Invalid data');
    if (startAnchor !== undefined && (typeof startAnchor !== 'string' || isNaN(new Date(startAnchor).getTime())))
        throw new Error('Invalid data');

    // The start date's weekday drives session ordering so session A lands on the
    // first trained day on/after the anchor. Absent anchor falls back to today.
    const anchorDow = startAnchor ? new Date(startAnchor).getUTCDay() : new Date().getUTCDay();

    const style = resolveStyle(styleKey, trainingDays.length);

    // Default the routine name to the chosen program style (e.g. "Classic Upper /
    // Lower"); an explicit, non-empty name overrides it.
    let routineName = style.name;
    if (name !== undefined) {
        const trimmed = name.trim();
        if (trimmed.length > 80) throw new Error('Invalid data');
        if (trimmed) routineName = trimmed;
    }

    const { supabase, user } = await getUserOrThrow();

    const { data: poolData } = await supabase
        .from('exercises')
        .select(
            'id, name, category, equipment, movement_pattern, is_compound, fatigue, substitution_class, unilateral, contraindications, difficulty',
        )
        .is('user_id', null);

    // The persisted muscle priority tilts each session's emphasis toward that
    // muscle. When the user has never chosen one (null), fall back to the
    // gender-seeded default (female → glutes) so the gender-aware behavior takes
    // effect without requiring a visit to Profile.
    const { data: profileRow } = await supabase
        .from('profiles')
        .select('priority_muscle, gender, training_style, variety_preference, loading_lean, movement_restrictions')
        .eq('id', user.id)
        .maybeSingle();
    const priority = resolvePriority(profileRow?.priority_muscle ?? genderDefault(profileRow?.gender ?? null));
    const resolvedTrainingStyle: TrainingStyle =
        trainingStyle ?? (profileRow?.training_style as TrainingStyle) ?? 'balanced';
    // Param wins over the stored value, which falls back to 'varied' (identity).
    const resolvedVariety: VarietyPreference =
        varietyPreference ?? (profileRow?.variety_preference as VarietyPreference) ?? 'varied';
    // Param wins over stored value; null stored value = no preference (identity).
    const resolvedLoadingLean: LoadingPreference | undefined =
        loadingLean ?? (profileRow?.loading_lean as LoadingPreference) ?? undefined;
    // Param wins over the stored value; absent param falls back to stored, then [].
    const resolvedRestrictions: RestrictionFlag[] =
        movementRestrictions ?? (profileRow?.movement_restrictions as RestrictionFlag[]) ?? [];

    // Exclude the user's hidden exercises so generation never surfaces them. The
    // smaller pool flows through the existing equipment filter + thin-pool
    // fallback in generateRoutine.
    const hidden = new Set(await loadHiddenExerciseIds(supabase, user.id));

    const pool: ExerciseMeta[] = ((poolData ?? []) as ExercisePoolRow[])
        .filter((row) => !hidden.has(row.id))
        .map((row) => ({
            id: row.id,
            // Name feeds the canonical-anchor rank (CANONICAL_ANCHORS, Bug 2). Without
            // this the rank can never fire in production (every name would be
            // undefined), so the fix is dead despite passing the synthetic tests.
            name: row.name,
            category: row.category,
            equipment: row.equipment ?? [],
            movement_pattern: row.movement_pattern,
            is_compound: row.is_compound,
            substitution_class: row.substitution_class,
            unilateral: row.unilateral ?? false,
            contraindications: row.contraindications ?? [],
            ...(row.fatigue !== null ? { fatigue: row.fatigue } : {}),
            ...(row.difficulty !== null ? { difficulty: row.difficulty } : {}),
        }));

    // Behavior-driven adaptation (#7): learn from recent repeated swaps and
    // soft-deprioritize exercises the user keeps rejecting. Never block
    // generation on the learning layer.
    let behavior = EMPTY_BEHAVIOR;
    try {
        const swapRows = await loadSwapHistory(supabase, user.id);
        behavior = analyzeSwapBehavior(swapRows, {
            minCount: BEHAVIOR_MIN_SWAPS,
            recencyMs: BEHAVIOR_RECENCY_DAYS * 86400000,
            nowMs: Date.now(),
        });
    } catch {
        behavior = EMPTY_BEHAVIOR;
    }
    // Names for the rationale, from the same catalog rows minus hidden ones, so
    // we never name a lift the generator could not have surfaced anyway.
    const nameById = new Map(
        ((poolData ?? []) as ExercisePoolRow[]).filter((r) => !hidden.has(r.id)).map((r) => [r.id, r.name]),
    );
    const demotedNames = behavior.demote.map((id) => nameById.get(id)).filter((n): n is string => !!n);
    const rationale = buildRationale(answers, sessionTime, style, priority, resolvedTrainingStyle, demotedNames);

    const blueprint = generateRoutine({
        style,
        answers,
        sessionTime,
        trainingDays,
        pool,
        priority,
        trainingStyle: resolvedTrainingStyle,
        varietyPreference: resolvedVariety,
        loadingLean: resolvedLoadingLean,
        restrictions: resolvedRestrictions,
        behavior,
        anchorDow,
        makeGroupId: () => crypto.randomUUID(),
    });

    // Item 2 / P2.3: the per-session inline warnings (blueprint.warnings) plus the
    // week-level checks from the post-generation validator (push/pull balance, label
    // integrity, vertical-pull coverage). Both are non-blocking notice KEYS persisted
    // to the routine's `warnings` column, rendered on the Plan page from WARNING_COPY.
    // Validate against the USABLE pool (equipment-owned, not contraindicated), the
    // same set the generator drew from, so a check like "no vertical pull" only
    // fires when the user could actually have had one (a dumbbell-only user with no
    // pulldown/pull-up bar is not nagged about a movement they cannot perform).
    const usable = usablePool(pool, answers.equipment, new Set(resolvedRestrictions));
    const weekWarnings = validateProgram(blueprint, usable);
    const warnings = [...blueprint.warnings, ...weekWarnings.filter((w) => !blueprint.warnings.includes(w))];
    const { data: routine, error: routineErr } = await supabase
        .from('workout_routines')
        .insert({ user_id: user.id, name: routineName, rationale, warnings })
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
                superset_group_id: e.superset_group_id,
            })),
        );
        if (exErr) throw new Error('Failed to save generated exercises');
    }

    // Schedule maps day -> workout_type and pins the per-day variant (A–D) so
    // the train screen jumps straight to that session's tab.
    const scheduleRows = blueprint.schedule.map((s) => ({
        routine_id: routine.id,
        day_of_week: s.day_of_week,
        workout_type: s.workout_type,
        variant: s.variant,
        label: s.label ?? null,
    }));
    if (scheduleRows.length > 0) {
        const { error: schedErr } = await supabase.from('routine_schedule').insert(scheduleRows);
        if (schedErr) throw new Error('Failed to create schedule');
    }

    const profileUpsert: Record<string, unknown> = {
        id: user.id,
        active_routine_id: routine.id,
        training_style: resolvedTrainingStyle,
        variety_preference: resolvedVariety,
    };
    // Persist restrictions only when explicitly provided. An absent param must
    // never clear a stored safety flag (a re-generate that omits the step).
    if (movementRestrictions !== undefined) profileUpsert.movement_restrictions = movementRestrictions;
    const { error: profileErr } = await supabase.from('profiles').upsert(profileUpsert, { onConflict: 'id' });
    if (profileErr) throw new Error('Failed to set active routine');

    revalidatePath('/pulse');
    return routine as WorkoutRoutine;
}
