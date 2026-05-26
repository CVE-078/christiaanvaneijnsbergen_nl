'use client';
import { PHASES } from '@/lib/pulse/data';
import { weekHasData } from '@/lib/pulse/utils';
import type { Logs } from '@/lib/pulse/types';

interface Props {
    activeWeek: number;
    onSelect: (w: number) => void;
    logs: Logs;
}

export default function WeekSelector({ activeWeek, onSelect, logs }: Props) {
    return (
        <div className="flex flex-col gap-4">
            {PHASES.map((phase) => (
                <div key={phase.label}>
                    <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                        {phase.label} · {phase.subtitle}
                    </div>
                    <div className="flex gap-1.5">
                        {phase.weeks.map((w) => {
                            const active = activeWeek === w;
                            return (
                                <button
                                    key={w}
                                    onClick={() => onSelect(w)}
                                    className={`flex-1 pt-2 pb-1.5 px-2 rounded-sm cursor-pointer font-pulse text-[0.8125rem] font-bold border transition-all duration-[120ms] ${
                                        active
                                            ? 'bg-pulse-accent text-black border-pulse-accent'
                                            : 'bg-pulse-surface text-pulse-dim border-pulse-border'
                                    }`}>
                                    {w}
                                    <span
                                        className={`block w-1 h-1 rounded-full mx-auto mt-0.5 ${
                                            weekHasData(w, logs)
                                                ? active
                                                    ? 'bg-black'
                                                    : 'bg-pulse-accent'
                                                : 'bg-transparent'
                                        }`}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
