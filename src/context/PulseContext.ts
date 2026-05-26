import { createContext, useContext } from 'react';
import type { Logs, Profile, BodyweightEntry, WorkoutType, Unit, LogEntry, View, PRMap } from '@/lib/pulse/types';

export interface PulseContextValue {
    // Data
    logs: Logs;
    profile: Profile;
    bodyweightLogs: BodyweightEntry[];
    isLoading: boolean;
    saveError: string | null;

    // Computed (memoized in PulseProvider)
    streak: number;
    prMap: PRMap;

    // Auth
    email: string;

    // Log mutations
    updateLog: (key: string, entry: LogEntry) => void;
    deleteLog: (key: string) => void;
    handleExport: () => void;

    // Profile mutations
    updateProfile: (displayName: string | null, unit: Unit) => Promise<void>;
    logBodyWeight: (weightKg: number) => Promise<BodyweightEntry>;
    deleteBodyWeight: (id: string) => Promise<void>;

    // UI state
    view: View;
    navigate: (view: View) => void;
    activeWeek: number;
    setActiveWeek: (week: number) => void;
    activeTab: WorkoutType;
    setActiveTab: (tab: WorkoutType) => void;

    // Rest timer
    timerTrigger: number;
    fireTrigger: () => void;
}

export const PulseContext = createContext<PulseContextValue | null>(null);

export function usePulse(): PulseContextValue {
    const ctx = useContext(PulseContext);
    if (!ctx) throw new Error('usePulse must be used inside PulseProvider');
    return ctx;
}
