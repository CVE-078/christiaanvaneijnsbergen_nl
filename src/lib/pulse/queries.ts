import type { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import { logKey } from '@/lib/pulse/utils';
import type { SwapHistoryRow } from './behavior';
import type {
    Logs,
    Notes,
    Swaps,
    Profile,
    BodyweightEntry,
    BodyMeasurement,
    DbExercise,
    RoutineWithExercises,
    WorkoutSession,
    ProgramAdjustment,
    AdjustmentKind,
    ProgramPause,
    DecisionEventRow,
    DecisionEventType,
    DecisionTrigger,
    EquipmentProfile,
    EquipmentKey,
} from '@/lib/pulse/types';

// Canonical Supabase server client type. Both the layout and the GET route
// handlers pass the same client returned by createClient.
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Canonical select strings. These are authoritative: the layout and the API
// routes should both call the loaders below rather than duplicating queries.
const LOGS_SELECT = 'week, routine_exercise_id, set_idx, kg, reps, rir, saved, drops';
const PROFILE_SELECT =
    'display_name, unit, length_unit, active_routine_id, active_equipment_profile_id, onboarding_completed, goal_weight_kg, gender, priority_muscle, timezone, accent_color, training_style, variety_preference, loading_lean, movement_restrictions';
const PRIORITY_MUSCLE_VALUES = ['glutes', 'legs', 'chest', 'back', 'shoulders', 'arms', 'balanced'];
const TRAINING_STYLE_VALUES = ['balanced', 'strength', 'bodybuilding', 'powerbuilding'];
const VARIETY_PREFERENCE_VALUES = ['consistent', 'varied'];
const LOADING_LEAN_VALUES = ['barbell', 'dumbbell', 'machine', 'cable'];
const BODYWEIGHT_SELECT = 'id, logged_at, weight_kg';
const MEASUREMENTS_SELECT = 'id, measured_at, waist_cm, hips_cm, chest_cm, arms_cm';
const EXERCISES_SELECT =
    'id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound';
const NOTES_SELECT = 'week, routine_exercise_id, note';
const SWAPS_SELECT = 'week, routine_exercise_id, exercise_id';
const HIDDEN_PREFS_SELECT = 'exercise_id';
const SESSIONS_SELECT =
    'id, user_id, routine_id, workout_type, variant, started_at, completed_at, session_rpe, session_note';
const ADJUSTMENTS_SELECT = 'id, routine_id, kind, effective_week, created_at, payload';
const PAUSES_SELECT = 'id, routine_id, paused_at, resumed_at, reason, created_at';
const DECISION_EVENTS_SELECT = 'id, routine_id, type, trigger, affected_area, week, magnitude, confidence, created_at';
const EQUIPMENT_PROFILES_SELECT = 'id, name, equipment, created_at, expires_at';
const ROUTINES_SELECT = `
            id, user_id, name, created_at, rationale, program_weeks, program_anchor,
            exercises:routine_exercises ( id, routine_id, exercise_id, workout_type, variant, order, sets, reps, starting_weight_kg, rest_seconds, superset_group_id, exercise:exercises ( id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound ) ),
            schedule:routine_schedule ( day_of_week, workout_type, variant )
        `;

export async function loadLogs(supabase: SupabaseServerClient, userId: string): Promise<Logs> {
    const { data, error } = await supabase.from('set_logs').select(LOGS_SELECT).eq('user_id', userId);
    if (error) throw error;

    const raw: Record<string, unknown> = {};
    for (const row of data ?? []) {
        raw[logKey(row.week, row.routine_exercise_id, row.set_idx)] = {
            kg: Number(row.kg),
            reps: row.reps,
            rir: row.rir,
            saved: row.saved,
            ...(Array.isArray(row.drops) && row.drops.length > 0 ? { drops: row.drops } : {}),
        };
    }
    return validateLogs(raw) ? raw : {};
}

export async function loadProfile(supabase: SupabaseServerClient, userId: string): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle();
    if (error) throw error;

    return {
        display_name: data?.display_name ?? null,
        unit: data?.unit === 'lbs' ? 'lbs' : 'kg',
        length_unit: data?.length_unit === 'in' ? 'in' : 'cm',
        active_routine_id: data?.active_routine_id ?? null,
        active_equipment_profile_id: data?.active_equipment_profile_id ?? null,
        onboarding_completed: data?.onboarding_completed ?? false,
        goal_weight_kg: data?.goal_weight_kg ? Number(data.goal_weight_kg) : null,
        gender: data?.gender === 'male' || data?.gender === 'female' ? data.gender : null,
        priority_muscle:
            data && (PRIORITY_MUSCLE_VALUES as readonly string[]).includes(data.priority_muscle as string)
                ? (data.priority_muscle as Profile['priority_muscle'])
                : null,
        training_style:
            data && (TRAINING_STYLE_VALUES as readonly string[]).includes(data.training_style as string)
                ? (data.training_style as Profile['training_style'])
                : null,
        variety_preference:
            data && (VARIETY_PREFERENCE_VALUES as readonly string[]).includes(data.variety_preference as string)
                ? (data.variety_preference as Profile['variety_preference'])
                : null,
        loading_lean:
            data && (LOADING_LEAN_VALUES as readonly string[]).includes(data.loading_lean as string)
                ? (data.loading_lean as Profile['loading_lean'])
                : null,
        movement_restrictions: data?.movement_restrictions ?? null,
        timezone: typeof data?.timezone === 'string' && data.timezone ? data.timezone : 'UTC',
        accent_color: typeof data?.accent_color === 'string' ? data.accent_color : null,
    };
}

// The user's equipment profiles, most-recently-created first (id desc as a
// deterministic, not chronological, tiebreak for equal timestamps). Scoped to the
// user by RLS and the explicit user_id filter (defense in depth, matching the
// other loaders). The pre-fill resolution rule that consumes these lives in Branch B.
export async function loadEquipmentProfiles(
    supabase: SupabaseServerClient,
    userId: string,
): Promise<EquipmentProfile[]> {
    const { data, error } = await supabase
        .from('equipment_profiles')
        .select(EQUIPMENT_PROFILES_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        equipment: (r.equipment ?? []) as EquipmentKey[],
        created_at: r.created_at,
        expires_at: r.expires_at ?? null,
    }));
}

export async function loadBodyweight(supabase: SupabaseServerClient, userId: string): Promise<BodyweightEntry[]> {
    const { data, error } = await supabase
        .from('bodyweight_logs')
        .select(BODYWEIGHT_SELECT)
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(90);
    if (error) throw error;

    return (data ?? []).map((r: { id: string; logged_at: string; weight_kg: number }) => ({
        id: r.id,
        logged_at: r.logged_at,
        weight_kg: Number(r.weight_kg),
    }));
}

export async function loadBodyMeasurements(supabase: SupabaseServerClient, userId: string): Promise<BodyMeasurement[]> {
    const { data, error } = await supabase
        .from('body_measurements')
        .select(MEASUREMENTS_SELECT)
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(90);
    if (error) throw error;

    // numeric(5,1) columns come back as strings from the client; coerce like
    // loadBodyweight so the declared `number | null` type holds at runtime.
    const num = (v: unknown): number | null => (v == null ? null : Number(v));
    const rows = (data ?? []) as Array<{
        id: string;
        measured_at: string;
        waist_cm: unknown;
        hips_cm: unknown;
        chest_cm: unknown;
        arms_cm: unknown;
    }>;
    return rows.map((r) => ({
        id: r.id,
        measured_at: r.measured_at,
        waist_cm: num(r.waist_cm),
        hips_cm: num(r.hips_cm),
        chest_cm: num(r.chest_cm),
        arms_cm: num(r.arms_cm),
    }));
}

export async function loadExercises(supabase: SupabaseServerClient, userId: string): Promise<DbExercise[]> {
    // Returns all global exercises (user_id IS NULL) + the user's own exercises.
    const { data, error } = await supabase
        .from('exercises')
        .select(EXERCISES_SELECT)
        .or(`user_id.is.null,user_id.eq.${userId}`)
        .order('name', { ascending: true });
    if (error) throw error;

    // Sort: global first (user_id IS NULL), then user's own, both alphabetically by name.
    return (data ?? []).sort((a, b) => {
        if (a.user_id === null && b.user_id !== null) return -1;
        if (a.user_id !== null && b.user_id === null) return 1;
        return a.name.localeCompare(b.name);
    });
}

export async function loadRoutines(supabase: SupabaseServerClient, userId: string): Promise<RoutineWithExercises[]> {
    const { data, error } = await supabase
        .from('workout_routines')
        .select(ROUTINES_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error) throw error;

    // Sort each routine's exercises by "order" ascending and schedule by day_of_week.
    // Load-bearing cast: the client types the embedded `exercise:exercises` join as
    // an array, but the select returns one related row, so the inferred row shape
    // does not structurally match RoutineWithExercises. Narrowing via `unknown`.
    return ((data ?? []) as unknown as RoutineWithExercises[]).map((routine) => ({
        ...routine,
        program_weeks: routine.program_weeks ?? 12,
        exercises: [...(routine.exercises ?? [])].sort((a, b) => a.order - b.order),
        schedule: [...(routine.schedule ?? [])].sort((a, b) => a.day_of_week - b.day_of_week),
    }));
}

export async function loadNotes(supabase: SupabaseServerClient, userId: string): Promise<Notes> {
    const { data, error } = await supabase.from('exercise_notes').select(NOTES_SELECT).eq('user_id', userId);
    if (error) throw error;

    const notes: Notes = {};
    for (const row of data ?? []) {
        notes[`${row.week}-${row.routine_exercise_id}`] = row.note;
    }
    return notes;
}

export async function loadSwaps(supabase: SupabaseServerClient, userId: string): Promise<Swaps> {
    const { data, error } = await supabase.from('exercise_swaps').select(SWAPS_SELECT).eq('user_id', userId);
    if (error) throw error;

    const swaps: Swaps = {};
    for (const row of data ?? []) {
        swaps[`${row.week}-${row.routine_exercise_id}`] = row.exercise_id;
    }
    return swaps;
}

// Swap history for behavior learning (#7): the recorded from-exercise of each
// swap, user-scoped. Drops rows with a null from (historical rows pre-dating the
// from_exercise_id column).
export async function loadSwapHistory(supabase: SupabaseServerClient, userId: string): Promise<SwapHistoryRow[]> {
    const { data, error } = await supabase
        .from('exercise_swaps')
        .select('from_exercise_id, created_at')
        .eq('user_id', userId)
        .not('from_exercise_id', 'is', null);
    if (error) throw error;
    return (data ?? [])
        .filter((r) => r.from_exercise_id != null)
        .map((r) => ({ fromExerciseId: r.from_exercise_id as string, createdAt: r.created_at as string }));
}

export async function loadHiddenExerciseIds(supabase: SupabaseServerClient, userId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('user_exercise_preferences')
        .select(HIDDEN_PREFS_SELECT)
        .eq('user_id', userId)
        .eq('preference', 'hidden');
    if (error) throw error;
    return (data ?? []).map((r: { exercise_id: string }) => r.exercise_id);
}

// All of the user's workout sessions (both routines, completed and in-progress),
// oldest first. The adherence engine is the spine consumer: it filters to
// completed sessions for the active routine and attributes them to program
// weeks. Set logs carry no timestamp, so sessions are the only real-date source.
export async function loadSessions(supabase: SupabaseServerClient, userId: string): Promise<WorkoutSession[]> {
    const { data, error } = await supabase
        .from('workout_sessions')
        .select(SESSIONS_SELECT)
        .eq('user_id', userId)
        .order('started_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        routine_id: r.routine_id ?? null,
        workout_type: r.workout_type,
        variant: r.variant ?? null,
        started_at: r.started_at,
        completed_at: r.completed_at ?? null,
        session_rpe: r.session_rpe ?? null,
        session_note: r.session_note ?? null,
    }));
}

// Append-only ramp-back adjustments for the user, oldest first.
export async function loadAdjustments(supabase: SupabaseServerClient, userId: string): Promise<ProgramAdjustment[]> {
    const { data, error } = await supabase
        .from('program_adjustments')
        .select(ADJUSTMENTS_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((r) => ({
        id: r.id,
        routine_id: r.routine_id,
        kind: r.kind as AdjustmentKind,
        effective_week: Number(r.effective_week),
        created_at: r.created_at,
        payload: (r.payload ?? {}) as ProgramAdjustment['payload'],
    }));
}

// Program pauses for the user, oldest first. The engine scopes them per routine.
export async function loadPauses(supabase: SupabaseServerClient, userId: string): Promise<ProgramPause[]> {
    const { data, error } = await supabase
        .from('program_pauses')
        .select(PAUSES_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((r) => ({
        id: r.id,
        routine_id: r.routine_id,
        paused_at: r.paused_at,
        resumed_at: r.resumed_at ?? null,
        reason: r.reason ?? null,
        created_at: r.created_at,
    }));
}

// The unified decision log for the user, newest first (the Coach Decision Timeline
// reads it in render order).
export async function loadDecisionEvents(supabase: SupabaseServerClient, userId: string): Promise<DecisionEventRow[]> {
    const { data, error } = await supabase
        .from('decision_events')
        .select(DECISION_EVENTS_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((r) => ({
        id: r.id,
        routine_id: r.routine_id,
        type: r.type as DecisionEventType,
        trigger: r.trigger as DecisionTrigger,
        affectedArea: r.affected_area ?? '',
        week: Number(r.week),
        magnitude: (r.magnitude ?? {}) as Record<string, number>,
        confidence: r.confidence == null ? null : Number(r.confidence),
        created_at: r.created_at,
    }));
}
