'use client';
import { forwardRef } from 'react';
import type { SessionSummary, Unit } from '@/lib/pulse/types';

interface Props {
    summary: SessionSummary;
    week: number;
    unit: Unit;
}

// Clean, screenshot/export-only card. No inputs or private notes. Rendered
// off-screen by FinishDebrief and rasterized with html-to-image.
const ShareImageCard = forwardRef<HTMLDivElement, Props>(function ShareImageCard({ summary, week, unit }, ref) {
    return (
        <div ref={ref} className="w-[360px] bg-pulse-bg p-6">
            <div className="font-pulse-display text-base font-extrabold tracking-[-0.02em] text-pulse-text">
                Pulse<span className="text-pulse-accent">.</span>
            </div>
            <div className="mt-4 font-pulse-display text-[2rem] font-extrabold uppercase leading-[0.95] tracking-[-0.01em] text-pulse-text">
                {summary.workoutLabel}
            </div>
            <div className="mt-1.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                {summary.date} · {summary.durationMin} min · Week {week}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                    { v: `${summary.totalSets}`, k: 'Sets' },
                    { v: `${summary.tonnage}`, k: `Volume ${unit}` },
                    { v: `${summary.prCount}`, k: summary.prCount === 1 ? 'PR' : 'PRs' },
                ].map((s) => (
                    <div key={s.k} className="rounded-xl border border-pulse-border bg-pulse-surface px-3 py-3">
                        <div className="font-pulse-display text-2xl font-extrabold leading-none text-pulse-text">
                            {s.v}
                        </div>
                        <div className="mt-1.5 font-pulse-body text-[0.5625rem] uppercase tracking-[0.14em] text-pulse-muted">
                            {s.k}
                        </div>
                    </div>
                ))}
            </div>
            {summary.topLifts.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                    {summary.topLifts.map((lift) => (
                        <div key={lift.name} className="flex items-center gap-2">
                            <span className="flex-1 truncate font-pulse text-[0.8125rem] text-pulse-text">
                                {lift.name}
                            </span>
                            <span className="shrink-0 font-pulse text-[0.8125rem] font-medium text-pulse-text">
                                {lift.displayWeight} {unit} × {lift.reps}
                            </span>
                            {lift.isPR && (
                                <span className="shrink-0 font-pulse text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-pulse-accent">
                                    PR
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default ShareImageCard;
