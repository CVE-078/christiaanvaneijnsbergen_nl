'use client';
import { WORKOUTS } from '@/lib/pulse/data';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import type { WorkoutType, Logs } from '@/lib/pulse/types';

interface Props {
    activeTab: WorkoutType;
    onSelect: (t: WorkoutType) => void;
    logs: Logs;
    week: number;
}

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

function countDone(type: WorkoutType, week: number, logs: Logs): number {
    return WORKOUTS[type].exercises.filter((ex, exIdx) => {
        const maxSets = parseMaxSets(ex.sets);
        return Array.from({ length: maxSets }, (_, s) => logKey(week, type, exIdx, s)).every((k) => logs[k]?.saved);
    }).length;
}

export default function WorkoutTabs({ activeTab, onSelect, logs, week }: Props) {
    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSelect(TABS[(idx + 1) % TABS.length].type);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSelect(TABS[(idx - 1 + TABS.length) % TABS.length].type);
        }
    }

    return (
        <div role="tablist" className="flex border-b border-pulse-border">
            {TABS.map(({ type, label }, idx) => {
                const active = activeTab === type;
                const done = countDone(type, week, logs);
                const total = WORKOUTS[type].exercises.length;
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`flex-1 flex flex-col items-center py-2.5 pb-2 gap-[0.2rem] bg-transparent border-0 border-b-2 -mb-px cursor-pointer ${
                            active ? 'border-pulse-accent' : 'border-transparent'
                        }`}>
                        <span
                            className={`font-pulse text-[0.6875rem] tracking-[0.12em] uppercase ${active ? 'text-white' : 'text-pulse-dim'}`}>
                            {label}
                        </span>
                        <span
                            className={`font-pulse text-[0.5625rem] tracking-[0.04em] ${active ? 'text-pulse-dim' : 'text-pulse-muted'}`}>
                            {done} / {total}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
