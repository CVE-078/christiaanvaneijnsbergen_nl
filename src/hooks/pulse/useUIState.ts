import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { View, WorkoutType } from '@/lib/pulse/types';

function clampWeek(raw: number): number {
    return raw >= 1 && raw <= 12 ? raw : 1;
}

export function useUIState() {
    const [view, setView] = useState<View>('log');
    const [rawWeek, setRawWeek] = useLocalStorage<number>('pulse_week', 1);
    const activeWeek = clampWeek(rawWeek);
    const [activeTab, setActiveTab] = useState<WorkoutType>('push');

    function navigate(v: View) {
        setView(v);
    }

    function setActiveWeek(week: number) {
        setRawWeek(week);
    }

    return { view, navigate, activeWeek, setActiveWeek, activeTab, setActiveTab };
}
