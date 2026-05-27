import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import TrackerClient from '@/components/pulse/TrackerClient';
import type { Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

export const metadata: Metadata = {
    title: 'Pulse',
    robots: { index: false, follow: false },
};

export const revalidate = 0;

export default async function PulsePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    const [logsResult, profileResult, bwResult, exercisesResult, routinesResult] = await Promise.all([
        supabase
            .from('set_logs')
            .select('week, routine_exercise_id, set_idx, kg, reps, rir, saved')
            .eq('user_id', user.id),
        supabase.from('profiles').select('display_name, unit, active_routine_id, onboarding_completed').eq('id', user.id).single(),
        supabase
            .from('bodyweight_logs')
            .select('id, logged_at, weight_kg')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false })
            .limit(90),
        supabase
            .from('exercises')
            .select('id, name, category, default_sets, default_reps, user_id')
            .or(`user_id.is.null,user_id.eq.${user.id}`)
            .order('name', { ascending: true }),
        supabase
            .from('workout_routines')
            .select(`
                id, user_id, name, created_at,
                exercises:routine_exercises (
                    id, routine_id, exercise_id, order, sets, reps, starting_weight_kg,
                    exercise:exercises ( id, name, category, default_sets, default_reps, user_id )
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
    ]);

    let logs: Logs = {};
    try {
        if (logsResult.error) throw logsResult.error;
        const raw: Record<string, unknown> = {};
        for (const row of logsResult.data ?? []) {
            raw[`${row.week}-${row.routine_exercise_id}-${row.set_idx}`] = {
                kg: Number(row.kg),
                reps: row.reps,
                rir: row.rir,
                saved: row.saved,
            };
        }
        if (validateLogs(raw)) logs = raw;
    } catch {
        throw new Error('Failed to load training data. Please try again.');
    }

    const profileRow = profileResult.data;
    const profile: Profile = {
        display_name: profileRow?.display_name ?? null,
        unit: profileRow?.unit === 'lbs' ? 'lbs' : 'kg',
        active_routine_id: profileRow?.active_routine_id ?? null,
        onboarding_completed: profileRow?.onboarding_completed ?? false,
    };

    const bodyweightLogs: BodyweightEntry[] = (bwResult.data ?? []).map(
        (r: { id: string; logged_at: string; weight_kg: number }) => ({
            id: r.id,
            logged_at: r.logged_at,
            weight_kg: Number(r.weight_kg),
        }),
    );

    // Sort: global exercises first (user_id IS NULL), then user's own, both alphabetically
    const rawExercises = (exercisesResult.data ?? []) as DbExercise[];
    const exercises: DbExercise[] = rawExercises.sort((a, b) => {
        if (a.user_id === null && b.user_id !== null) return -1;
        if (a.user_id !== null && b.user_id === null) return 1;
        return a.name.localeCompare(b.name);
    });

    const routines: RoutineWithExercises[] = (
        (routinesResult.data ?? []) as unknown as RoutineWithExercises[]
    ).map((routine) => ({
        ...routine,
        exercises: [...(routine.exercises ?? [])].sort((a, b) => a.order - b.order),
    }));

    return (
        <TrackerClient
            initialLogs={logs}
            initialProfile={profile}
            initialBodyweightLogs={bodyweightLogs}
            initialExercises={exercises}
            initialRoutines={routines}
            email={user.email ?? ''}
        />
    );
}
