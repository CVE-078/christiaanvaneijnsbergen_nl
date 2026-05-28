'use client';
import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from './ToastContainer';
import type { View, Logs, Profile, BodyweightEntry, DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

const PATH_TO_VIEW: Record<string, View> = {
    '/pulse/train': 'train',
    '/pulse/plan': 'plan',
    '/pulse/progress': 'progress',
    '/pulse/profile': 'profile',
    '/pulse/explore': 'explore',
};

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    initialExercises: DbExercise[];
    initialRoutines: RoutineWithExercises[];
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ children, ...providerProps }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = (pathname ? PATH_TO_VIEW[pathname] : undefined) ?? 'train';

    const navigate = useCallback((v: View) => {
        router.push(`/pulse/${v}`);
    }, [router]);

    return (
        <ToastProvider>
            <PulseProvider {...providerProps} navigate={navigate}>
                <AppShell view={view} navigate={navigate}>
                    {children}
                </AppShell>
                <ToastContainer />
            </PulseProvider>
        </ToastProvider>
    );
}
