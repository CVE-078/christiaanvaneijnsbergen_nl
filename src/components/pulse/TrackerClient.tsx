'use client';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import type { Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    email: string;
}

export default function TrackerClient({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    initialExercises,
    initialRoutines,
    email,
}: Props) {
    return (
        <PulseProvider
            initialLogs={initialLogs}
            initialProfile={initialProfile}
            initialBodyweightLogs={initialBodyweightLogs}
            initialExercises={initialExercises}
            initialRoutines={initialRoutines}
            email={email}>
            <AppShell />
        </PulseProvider>
    );
}
