'use client';
import { useMemo } from 'react';
import { PulseContext } from '@/context/PulseContext';
import { useWorkoutLogs } from '@/hooks/pulse/useWorkoutLogs';
import { useProfile } from '@/hooks/pulse/useProfile';
import { useUIState } from '@/hooks/pulse/useUIState';
import { useRestTimer } from '@/hooks/pulse/useRestTimer';
import { computeStreak, computePRMap } from '@/lib/pulse/utils';
import type { Logs, Profile, BodyweightEntry } from '@/lib/pulse/types';

interface Props {
    initialLogs: Logs;
    initialProfile: Profile;
    initialBodyweightLogs: BodyweightEntry[];
    email: string;
    children: React.ReactNode;
}

export function PulseProvider({
    initialLogs,
    initialProfile,
    initialBodyweightLogs,
    email,
    children,
}: Props) {
    const { logs, saveError, updateLog, deleteLog, handleExport } = useWorkoutLogs(initialLogs);
    const { profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight } = useProfile(
        initialProfile,
        initialBodyweightLogs,
    );
    const { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab } = useUIState();
    const { timerTrigger, fireTrigger } = useRestTimer();

    const streak = useMemo(() => computeStreak(logs), [logs]);
    const prMap = useMemo(() => computePRMap(logs), [logs]);

    return (
        <PulseContext.Provider
            value={{
                logs,
                profile,
                bodyweightLogs,
                isLoading: false,
                saveError,
                streak,
                prMap,
                email,
                updateLog,
                deleteLog,
                handleExport,
                updateProfile,
                logBodyWeight,
                deleteBodyWeight,
                view,
                navigate,
                activeWeek,
                setActiveWeek,
                activeTab,
                setActiveTab,
                timerTrigger,
                fireTrigger,
            }}>
            {children}
        </PulseContext.Provider>
    );
}
