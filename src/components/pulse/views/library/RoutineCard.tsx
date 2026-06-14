'use client';
import { routineSessionChips } from '@/lib/pulse/library';
import type { RoutineWithExercises } from '@/lib/pulse/types';

export default function RoutineCard({
    routine,
    isActive,
    progress,
    meta,
    onOpen,
}: {
    routine: RoutineWithExercises;
    isActive: boolean;
    /** Active routine only: { fraction 0-1, label } from formatProgramStatus. */
    progress?: { fraction: number; label: string } | null;
    /** Meta line (e.g. "6 days/week · 12-week plan" or "4 exercises · no fixed schedule"). */
    meta: string;
    onOpen: () => void;
}) {
    const chips = routineSessionChips(routine);
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Manage ${routine.name}`}
            className={`flex w-full flex-col gap-2 rounded-2xl border bg-pulse-surface px-3.5 py-3 text-left ${isActive ? 'border-pulse-accent/40' : 'border-pulse-border'}`}>
            <div className="flex items-center gap-2">
                <span className="flex-1 truncate font-pulse text-[0.95rem] font-medium text-pulse-text">
                    {routine.name}
                </span>
                {isActive && (
                    <span className="shrink-0 rounded-md border border-pulse-accent/35 bg-pulse-accent/10 px-2 py-0.5 font-pulse text-[0.5625rem] uppercase tracking-[0.06em] text-pulse-accent">
                        Active
                    </span>
                )}
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="shrink-0 text-pulse-muted"
                    aria-hidden>
                    <polyline points="6 3 11 8 6 13" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                    <span
                        key={c}
                        className="rounded-md bg-pulse-surface-2 px-2 py-0.5 font-pulse text-[0.66rem] text-pulse-dim">
                        {c}
                    </span>
                ))}
            </div>
            {isActive && progress && (
                <div className="h-[5px] overflow-hidden rounded-full bg-pulse-surface-2">
                    <div
                        className="h-full rounded-full bg-pulse-accent"
                        style={{ width: `${Math.round(progress.fraction * 100)}%` }}
                    />
                </div>
            )}
            <span className="font-pulse text-[0.71rem] text-pulse-dim">
                {isActive && progress ? progress.label : meta}
            </span>
        </button>
    );
}
