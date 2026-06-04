'use client';
import { useMemo } from 'react';
import { logKey, parseMaxSets, orderTabKeys } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import { tabKeyLabel } from '@/lib/pulse/constants';
import type { TabKey } from '@/lib/pulse/types';
import TabButton from './TabButton';

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByTabKey, logs, activeWeek } = usePulse();

    // Build ordered tab list via the shared comparator (base workout_type order,
    // then A before B). The provider clamps activeTab to a valid tab when this set
    // changes, so no set-state-during-effect is needed here.
    const tabs: TabKey[] = useMemo(
        () => orderTabKeys(Object.keys(routineExercisesByTabKey) as TabKey[]),
        [routineExercisesByTabKey],
    );

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
