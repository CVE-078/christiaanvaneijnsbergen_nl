'use client';
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { ScheduleEntry } from '@/lib/pulse/types';

function entryLabel(e: ScheduleEntry): string {
    return e.variant ? `${WORKOUT_TYPE_LABELS[e.workout_type]} ${e.variant}` : WORKOUT_TYPE_LABELS[e.workout_type];
}

// Non-destructive adherence nudge on Train, mirroring the plateau-nudge pattern.
// Surfaces a ramp-back offer after a long gap, or a catch-up prompt when a
// scheduled session is still open this week. Returns null when nothing applies.
export default function RegenNudge() {
    const { regenSuggestion, activeRoutine, acceptReentryDeload, dismissReentry, setActiveWeek, setActiveDay } =
        usePulse();
    const [dismissedCatchUp, setDismissedCatchUp] = useState(false);

    if (!regenSuggestion || !activeRoutine) return null;

    if (regenSuggestion.kind === 'reentry_deload') {
        const { weekInteger, daysAway } = regenSuggestion;
        return (
            <div className="mb-3 rounded-2xl border border-pulse-accent/30 bg-pulse-surface px-4 py-3.5">
                <p className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">Welcome back</p>
                <p className="mt-1 font-pulse text-[0.78125rem] text-pulse-dim">
                    It&apos;s been {daysAway} days since your last session. Want an easier ramp-back week before
                    resuming week {weekInteger}? A gentler RIR target eases you back in, then you pick up right where
                    you left off.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            acceptReentryDeload(activeRoutine.id, weekInteger, daysAway);
                            setActiveWeek(weekInteger);
                        }}
                        className="cursor-pointer rounded-lg border-none bg-pulse-accent px-3.5 py-1.5 font-pulse text-xs font-semibold text-pulse-bg">
                        Add ramp-back week
                    </button>
                    <button
                        type="button"
                        onClick={() => dismissReentry(activeRoutine.id, weekInteger)}
                        className="cursor-pointer rounded-lg border-none bg-pulse-surface-2 px-3.5 py-1.5 font-pulse text-xs font-semibold text-pulse-dim hover:text-pulse-text">
                        Resume normally
                    </button>
                </div>
            </div>
        );
    }

    // catch_up, informational; dismissible for this session (no persistence).
    if (dismissedCatchUp) return null;
    const missed = regenSuggestion.missed;
    if (missed.length === 0) return null;
    const first = missed[0];
    return (
        <div className="mb-3 rounded-2xl bg-pulse-surface px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">
                        {missed.length > 1
                            ? `${missed.length} sessions still open this week`
                            : `You missed ${entryLabel(first)} this week`}
                    </p>
                    <p className="mt-1 font-pulse text-[0.78125rem] text-pulse-dim">
                        Nothing&apos;s lost, train it next and your program slides forward.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setDismissedCatchUp(true)}
                    aria-label="Dismiss"
                    className="shrink-0 cursor-pointer border-none bg-transparent px-1 font-pulse text-base leading-none text-pulse-muted hover:text-pulse-text">
                    ×
                </button>
            </div>
            <div className="mt-2.5">
                <button
                    type="button"
                    onClick={() => setActiveDay(first.day_of_week)}
                    className="cursor-pointer rounded-lg border-none bg-pulse-accent px-3.5 py-1.5 font-pulse text-xs font-semibold text-pulse-bg">
                    Train {entryLabel(first)}
                    {missed.length > 1 ? ' first' : ''}
                </button>
            </div>
        </div>
    );
}
