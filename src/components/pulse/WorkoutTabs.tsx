'use client';
import { useEffect } from 'react';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_ORDER, tabKeyLabel } from '@/lib/pulse/constants';
import type { TabKey, WorkoutType } from '@/lib/pulse/types';
import TabButton from './TabButton';

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByTabKey, logs, activeWeek } = usePulse();

    // Build ordered tab list: sort by base workout_type order, then A before B
    const tabs: TabKey[] = (() => {
        const keys = Object.keys(routineExercisesByTabKey) as TabKey[];
        return [...keys].sort((a, b) => {
            const baseA = a.includes(':') ? (a.split(':')[0] as WorkoutType) : (a as WorkoutType);
            const baseB = b.includes(':') ? (b.split(':')[0] as WorkoutType) : (b as WorkoutType);
            const orderA = WORKOUT_TYPE_ORDER.indexOf(baseA);
            const orderB = WORKOUT_TYPE_ORDER.indexOf(baseB);
            if (orderA !== orderB) return orderA - orderB;
            return a < b ? -1 : 1; // 'push:A' before 'push:B'
        });
    })();

    useEffect(() => {
        if (tabs.length > 0 && !tabs.includes(activeTab)) {
            setActiveTab(tabs[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.join(',')]);

    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveTab(tabs[(idx + 1) % tabs.length]);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
        }
    }

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
            {tabs.map((key, idx) => {
                const active = activeTab === key;
                const exercises = routineExercisesByTabKey[key] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                return (
                    <TabButton
                        key={key}
                        id={`tab-${key}`}
                        active={active}
                        controls={`panel-${key}`}
                        onClick={() => setActiveTab(key)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="flex items-center gap-2 py-2 px-4 rounded-full">
                        <span className="font-pulse text-sm font-semibold">{tabKeyLabel(key)}</span>
                    </TabButton>
                );
            })}
        </div>
    );
}
