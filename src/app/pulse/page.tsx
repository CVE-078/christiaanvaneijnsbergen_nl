import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/weight-tracker/validation';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs, Profile, BodyweightEntry } from '@/lib/weight-tracker/types';

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

    const [logsResult, profileResult, bwResult] = await Promise.all([
        supabase
            .from('set_logs')
            .select('week, workout_type, ex_idx, set_idx, kg, reps, rir, saved')
            .eq('user_id', user.id),
        supabase.from('profiles').select('display_name, unit').eq('id', user.id).single(),
        supabase
            .from('bodyweight_logs')
            .select('id, logged_at, weight_kg')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false })
            .limit(90),
    ]);

    let logs: Logs = {};
    try {
        if (logsResult.error) throw logsResult.error;
        const raw: Record<string, unknown> = {};
        for (const row of logsResult.data ?? []) {
            raw[`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`] = {
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
    };

    const bodyweightLogs: BodyweightEntry[] = (bwResult.data ?? []).map(
        (r: { id: string; logged_at: string; weight_kg: number }) => ({
            id: r.id,
            logged_at: r.logged_at,
            weight_kg: Number(r.weight_kg),
        }),
    );

    return (
        <TrackerClient
            initialLogs={logs}
            initialProfile={profile}
            initialBodyweightLogs={bodyweightLogs}
            email={user.email ?? ''}
        />
    );
}
