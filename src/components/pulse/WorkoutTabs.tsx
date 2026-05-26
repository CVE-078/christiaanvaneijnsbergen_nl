'use client';
import { WORKOUTS } from '@/lib/pulse/data';
import { parseMaxSets } from '@/lib/pulse/utils';
// TODO(4.5): replace with routine-based logKey once WorkoutTabs is rewritten
function legacyLogKey(week: number, type: string, exIdx: number, setIdx: number): string {
    return `${week}-${type}-${exIdx}-${setIdx}`;
}
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
        return Array.from({ length: maxSets }, (_, s) => legacyLogKey(week, type, exIdx, s)).every((k) => logs[k]?.saved);
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
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
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
                        className={`flex items-center gap-2 py-2 px-4 rounded-full border cursor-pointer transition-all duration-150 ${
                            active
                                ? 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent'
                                : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text'
                        }`}>
                        <span className="font-pulse text-sm font-semibold">{label}</span>
                        <span
                            className={`font-pulse text-xs rounded-full px-1.5 py-0.5 ${
                                active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                            }`}>
                            {done}/{total}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
