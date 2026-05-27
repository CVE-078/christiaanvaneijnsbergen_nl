'use client';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { WorkoutType } from '@/lib/pulse/types';

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByType, logs, activeWeek } = usePulse();

    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveTab(TABS[(idx + 1) % TABS.length].type);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveTab(TABS[(idx - 1 + TABS.length) % TABS.length].type);
        }
    }

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
            {TABS.map(({ type, label }, idx) => {
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
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => setActiveTab(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`flex items-center gap-2 py-2 px-4 rounded-full border cursor-pointer transition-all duration-150 ${
                            active
                                ? 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent'
                                : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text'
                        }`}>
                        <span className="font-pulse text-sm font-semibold">{label}</span>
                        {total > 0 && (
                            <span
                                className={`font-pulse text-xs rounded-full px-1.5 py-0.5 ${
                                    active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                                }`}>
                                {done}/{total}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
