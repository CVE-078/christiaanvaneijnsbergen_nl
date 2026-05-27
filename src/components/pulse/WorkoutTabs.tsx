'use client';
import { useEffect } from 'react';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { WorkoutType } from '@/lib/pulse/types';
import { WORKOUT_TYPE_LABELS, WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
import TabButton from './TabButton';

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByType, logs, activeWeek } = usePulse();
    const tabs = WORKOUT_TYPE_ORDER.filter((t) => routineExercisesByType[t] !== undefined);

    useEffect(() => {
        if (tabs.length > 0 && !tabs.includes(activeTab as WorkoutType)) {
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
            {tabs.map((type, idx) => {
                const active = activeTab === type;
                const exercises = routineExercisesByType[type] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                return (
                    <TabButton
                        key={type}
                        id={`tab-${type}`}
                        active={active}
                        controls={`panel-${type}`}
                        onClick={() => setActiveTab(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="flex items-center gap-2 py-2 px-4 rounded-full">
                        <span className="font-pulse text-sm font-semibold">{WORKOUT_TYPE_LABELS[type]}</span>
                    </TabButton>
                );
            })}
        </div>
    );
}
