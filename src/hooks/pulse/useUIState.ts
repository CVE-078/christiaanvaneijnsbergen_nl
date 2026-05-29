import { useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { TabKey } from '@/lib/pulse/types';

function clampWeek(raw: number): number {
    return raw >= 1 && raw <= 12 ? raw : 1;
}

export function useUIState() {
    const [rawWeek, setRawWeek] = useLocalStorage<number>('pulse_week', 1);
    const activeWeek = clampWeek(rawWeek);
    const [activeTab, setActiveTab] = useState<TabKey>('push');

    function setActiveWeek(week: number) {
        setRawWeek(week);
    }

    return { activeWeek, setActiveWeek, activeTab, setActiveTab };
}
