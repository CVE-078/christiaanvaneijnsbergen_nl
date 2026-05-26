'use client';
import type { WorkoutType } from '@/lib/pulse/types';

interface Props {
    activeTab: WorkoutType;
    onSelect: (t: WorkoutType) => void;
}

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

export default function WorkoutTabs({ activeTab, onSelect }: Props) {
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
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`flex-1 py-3.5 text-center font-pulse text-[0.6875rem] tracking-[0.12em] uppercase bg-transparent border-0 border-b-2 -mb-px cursor-pointer ${
                            active ? 'text-white border-pulse-accent' : 'text-pulse-dim border-transparent'
                        }`}>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
