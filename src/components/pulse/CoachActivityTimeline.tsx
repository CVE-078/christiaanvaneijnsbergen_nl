'use client';
import { useMemo, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { decisionCopy, groupDecisionsByWeek } from '@/lib/pulse/decisionCopy';
import CoachTimelineModal, { tone } from './CoachTimelineModal';

// CoachActivityTimeline shows the 3 most recent coach decisions as a visual
// timeline. Mirrors CoachPanel's data wiring exactly (decisions from usePulse,
// exercise names from routines). "Show all" opens the shared CoachTimelineModal.
// Renders nothing when there are no decisions.
export default function CoachActivityTimeline() {
    const { decisions, routines, profile, activeRoutine } = usePulse();
    const [open, setOpen] = useState(false);
    const unit = profile.unit;
    const programWeeks = activeRoutine?.program_weeks ?? 12;

    // Mirror CoachPanel's name resolver: map routineExerciseId to exercise name.
    const nameFor = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of routines) {
            for (const re of r.exercises) map.set(re.id, re.exercise.name);
        }
        return (reId: string): string | null => map.get(reId) ?? null;
    }, [routines]);

    const groups = useMemo(() => groupDecisionsByWeek(decisions), [decisions]);

    if (decisions.length === 0) return null;

    const recent = decisions.slice(0, 4);

    return (
        <div className="flex flex-1 flex-col rounded-2xl bg-pulse-surface px-4 py-3">
            {/* Timeline rows */}
            <div className="relative pl-5">
                {/* Vertical connector line */}
                <div aria-hidden className="absolute bottom-2.5 left-1 top-2 w-0.5 rounded-full bg-pulse-border" />

                {recent.map((e) => {
                    const c = decisionCopy(e, nameFor(e.affectedArea));
                    return (
                        <div key={e.id} className="relative py-[9px]">
                            {/* Timeline dot */}
                            <div
                                aria-hidden
                                className={`absolute -left-5 top-[13px] h-[9px] w-[9px] rounded-full ${tone(c.kind).replace('text-', 'bg-')} shadow-[0_0_0_3px_var(--color-pulse-bg)]`}
                            />
                            <div className="font-pulse text-[0.86rem] font-medium text-pulse-text">{c.headline}</div>
                            <div className="mt-0.5 font-pulse text-[0.76rem] text-pulse-muted">{c.why}</div>
                        </div>
                    );
                })}
            </div>

            {/* Show all, matching the milestones card's full-width button */}
            {decisions.length > 4 && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mb-1 mt-auto flex w-full items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                    Show all {decisions.length} decisions
                    <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden>
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}

            <CoachTimelineModal
                open={open}
                onClose={() => setOpen(false)}
                groups={groups}
                nameFor={nameFor}
                unit={unit}
                programWeeks={programWeeks}
            />
        </div>
    );
}
