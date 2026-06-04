import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { TabKey } from '@/lib/pulse/types';

function clampWeek(raw: number): number {
    return raw >= 1 && raw <= 12 ? raw : 1;
}

export function useUIState() {
    const [rawWeek, setRawWeek] = useLocalStorage<number>('pulse_week', 1);
    const activeWeek = clampWeek(rawWeek);
    const [activeTab, setActiveTab] = useState<TabKey>('push');
    const [autoAdvance, setAutoAdvance] = useLocalStorage<boolean>('pulse_autoadvance', false);
    const [workoutModeOpen, setWorkoutModeOpen] = useState<boolean>(false);

    const setActiveWeek = useCallback((week: number) => setRawWeek(week), [setRawWeek]);

    return {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        autoAdvance,
        setAutoAdvance,
        workoutModeOpen,
        setWorkoutModeOpen,
    };
}
