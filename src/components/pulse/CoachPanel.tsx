'use client';
import { useMemo, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { decisionCopy, groupDecisionsByWeek } from '@/lib/pulse/decisionCopy';
import CoachTimelineModal, { Dot } from './CoachTimelineModal';

// The Coach Decision Timeline. `variant` switches the compact surface between the
// Train inline slot (a surface card, like RegenNudge) and the desktop right rail
// (a plain block among the other rail stats). "View all" opens the full timeline
// overlay. Renders nothing until there is a decision to show.
export default function CoachPanel({ variant = 'inline' }: { variant?: 'inline' | 'rail' }) {
    const { decisions, routines, activeRoutine, profile } = usePulse();
    const [open, setOpen] = useState(false);
    const unit = profile.unit;

    const nameFor = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of routines) for (const re of r.exercises) map.set(re.id, re.exercise.name);
        return (reId: string): string | null => map.get(reId) ?? null;
    }, [routines]);

    const programWeeks = activeRoutine?.program_weeks ?? 12;
    const groups = useMemo(() => groupDecisionsByWeek(decisions), [decisions]);

    if (decisions.length === 0) return null;

    const recent = decisions.slice(0, 3);
    const headingCls = 'font-pulse text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-pulse-muted';

    return (
        <>
            <section
                className={
                    variant === 'inline'
                        ? 'mb-3 rounded-2xl bg-pulse-surface px-4 py-3.5'
                        : 'mt-9 border-t border-pulse-border pt-6'
                }>
                <h2 className={headingCls}>Coach</h2>
                <div className="mt-2.5">
                    {recent.map((e) => {
                        const c = decisionCopy(e, nameFor(e.affectedArea));
                        return (
                            <div
                                key={e.id}
                                className="flex gap-2.5 border-b border-pulse-border py-2.5 last:border-b-0">
                                <Dot kind={c.kind} small />
                                <div className="min-w-0">
                                    <div className="font-pulse text-[0.8125rem] font-medium text-pulse-text">
                                        {c.headline}
                                    </div>
                                    <div className="font-pulse text-[0.72rem] text-pulse-muted">{c.why}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-3 cursor-pointer border-none bg-transparent p-0 font-pulse text-xs font-semibold text-pulse-accent hover:underline">
                    View all decisions →
                </button>
            </section>

            <CoachTimelineModal
                open={open}
                onClose={() => setOpen(false)}
                groups={groups}
                nameFor={nameFor}
                unit={unit}
                programWeeks={programWeeks}
            />
        </>
    );
}
