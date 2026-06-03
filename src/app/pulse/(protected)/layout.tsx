import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadLogs, loadProfile, loadBodyweight, loadExercises, loadRoutines, loadNotes } from '@/lib/pulse/queries';
import PulseLayout from '@/components/pulse/PulseLayout';

export const revalidate = 0;

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    // Run the per-domain loaders in parallel. Each rejection is mapped to the
    // same domain-specific error message the layout used before.
    const [logs, profile, bodyweightLogs, exercises, routines, initialNotes] = await Promise.all([
        loadLogs(supabase, user.id).catch(() => {
            throw new Error('Failed to load training data.');
        }),
        loadProfile(supabase, user.id).catch(() => {
            throw new Error('Failed to load profile data.');
        }),
        loadBodyweight(supabase, user.id).catch(() => {
            throw new Error('Failed to load body weight data.');
        }),
        loadExercises(supabase, user.id).catch(() => {
            throw new Error('Failed to load exercises.');
        }),
        loadRoutines(supabase, user.id).catch(() => {
            throw new Error('Failed to load routines.');
        }),
        loadNotes(supabase, user.id),
    ]);

    return (
        <PulseLayout
            initialLogs={logs}
            initialProfile={profile}
            initialBodyweightLogs={bodyweightLogs}
            initialExercises={exercises}
            initialRoutines={routines}
            initialNotes={initialNotes}
            email={user.email ?? ''}>
            {children}
        </PulseLayout>
    );
}
