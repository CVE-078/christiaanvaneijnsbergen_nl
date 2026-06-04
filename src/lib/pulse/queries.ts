import type { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import { logKey } from '@/lib/pulse/utils';
import type { Logs, Notes, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

// Canonical Supabase server client type. Both the layout and the GET route
// handlers pass the same client returned by createClient.
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Canonical select strings. These are authoritative: the layout and the API
// routes should both call the loaders below rather than duplicating queries.
const LOGS_SELECT = 'week, routine_exercise_id, set_idx, kg, reps, rir, saved, drops';
const PROFILE_SELECT = 'display_name, unit, active_routine_id, onboarding_completed, goal_weight_kg';
const BODYWEIGHT_SELECT = 'id, logged_at, weight_kg';
const EXERCISES_SELECT = 'id, name, category, default_sets, default_reps, user_id';
const NOTES_SELECT = 'week, routine_exercise_id, note';
const ROUTINES_SELECT = `
            id, user_id, name, created_at,
            exercises:routine_exercises ( id, routine_id, exercise_id, workout_type, order, sets, reps, starting_weight_kg, rest_seconds, superset_group_id, exercise:exercises ( id, name, category, default_sets, default_reps, user_id ) ),
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
        active_routine_id: data?.active_routine_id ?? null,
        onboarding_completed: data?.onboarding_completed ?? false,
        goal_weight_kg: data?.goal_weight_kg ? Number(data.goal_weight_kg) : null,
    };
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
