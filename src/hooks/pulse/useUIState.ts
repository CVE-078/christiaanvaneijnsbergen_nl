import { useCallback, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { TabKey } from '@/lib/pulse/types';

// Programs repeat their block indefinitely and can be up to 16 weeks long, so
// the week is monotonic and can exceed 12 (week 13 = block 2, week 1). Clamp
// only against junk / absurd values, not the block length. ~10 years of weeks.
const MAX_WEEK = 520;
function clampWeek(raw: number): number {
    return Number.isFinite(raw) && raw >= 1 && raw <= MAX_WEEK ? Math.floor(raw) : 1;
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
