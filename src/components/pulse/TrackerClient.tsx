'use client';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import type { Logs, Profile, BodyweightEntry } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    email: string;
}

export default function TrackerClient({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    email,
}: Props) {
    return (
        <PulseProvider
            initialLogs={initialLogs}
            initialProfile={initialProfile}
            initialBodyweightLogs={initialBodyweightLogs}
            email={email}>
            <AppShell />
        </PulseProvider>
    );
}
