'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { decisionCopy, groupDecisionsByWeek } from '@/lib/pulse/decisionCopy';
import { getPhase, toDisplay } from '@/lib/pulse/utils';
import type { DecisionEventRow, DecisionEventType, Unit } from '@/lib/pulse/types';

const GLYPH: Record<DecisionEventType, string> = { progression: '↑', deload: '↓', ramp_back: '⟳', swap: '⇄' };

// Progressions read as positive (the success green); everything else uses the
// themeable accent so the surface still tracks a user-picked accent colour.
function tone(kind: DecisionEventType): string {
    return kind === 'progression' ? 'text-pulse-success' : 'text-pulse-accent';
}

// Relative recency for the meta line. Client-only (this is a client component).
function relativeDay(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

// The "what changed by how much, when" line. Weight deltas convert to the user's
// unit; ramp-back shows its volume/RIR adjustment instead.
function metaLine(e: DecisionEventRow, unit: Unit): string {
    const parts: string[] = [];
    if (e.type === 'ramp_back') {
        if (e.magnitude.volumeFactor != null) parts.push(`volume ×${e.magnitude.volumeFactor}`);
        if (e.magnitude.rirBonus != null) parts.push(`RIR +${e.magnitude.rirBonus}`);
    } else if (e.magnitude.fromKg != null && e.magnitude.toKg != null) {
        parts.push(`${toDisplay(e.magnitude.fromKg, unit)} → ${toDisplay(e.magnitude.toKg, unit)} ${unit}`);
    }
    parts.push(relativeDay(e.created_at));
    return parts.join(' · ');
}

function Dot({ kind, small }: { kind: DecisionEventType; small?: boolean }) {
    return (
        <span
            aria-hidden
            className={`grid shrink-0 place-items-center rounded-full border border-pulse-border bg-pulse-surface-2 ${tone(kind)} ${
                small ? 'h-[21px] w-[21px] text-[11px]' : 'h-[25px] w-[25px] text-[12px]'
            }`}>
            {GLYPH[kind]}
        </span>
    );
}

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

            {open && (
                <CoachTimelineOverlay
                    groups={groups}
                    nameFor={nameFor}
                    unit={unit}
                    programWeeks={programWeeks}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

function CoachTimelineOverlay({
    groups,
    nameFor,
    unit,
    programWeeks,
    onClose,
}: {
    groups: Array<{ week: number; events: DecisionEventRow[] }>;
    nameFor: (reId: string) => string | null;
    unit: Unit;
    programWeeks: number;
    onClose: () => void;
}) {
    // Close on Escape; lock body scroll while open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Coach decision timeline"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
            onClick={onClose}>
            <div
                className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-pulse-bg px-6 pb-10 pt-6 sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-pulse text-lg font-semibold tracking-[-0.01em] text-pulse-text">
                        Coach decisions
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent p-1 font-pulse text-xl leading-none text-pulse-muted hover:text-pulse-text">
                        ×
                    </button>
                </div>

                {groups.map((g) => {
                    const phase = getPhase(g.week, programWeeks);
                    return (
                        <div key={g.week}>
                            <div className="mb-3 mt-6 flex items-baseline gap-2 first:mt-0">
                                <span className="font-pulse text-xs font-semibold tracking-[0.03em] text-pulse-text">
                                    Week {g.week}
                                </span>
                                {phase?.label && (
                                    <span className="font-pulse text-[0.6875rem] tracking-[0.04em] text-pulse-muted">
                                        · {phase.label}
                                    </span>
                                )}
                                <span className="h-px flex-1 bg-pulse-border" />
                            </div>
                            <div className="flex flex-col">
                                {g.events.map((e) => {
                                    const c = decisionCopy(e, nameFor(e.affectedArea));
                                    return (
                                        <div key={e.id} className="flex gap-3 py-3">
                                            <Dot kind={c.kind} />
                                            <div className="min-w-0 flex-1">
                                                <div className="font-pulse text-sm font-medium tracking-[-0.01em] text-pulse-text">
                                                    {c.headline}
                                                </div>
                                                <div className="mt-0.5 font-pulse text-[0.78rem] text-pulse-dim">
                                                    {c.why}
                                                </div>
                                                {c.next && (
                                                    <div className="mt-1 font-pulse text-[0.75rem] text-pulse-muted">
                                                        {c.next}
                                                    </div>
                                                )}
                                                <div className="mt-1.5 font-pulse text-[0.6875rem] tracking-[0.02em] text-pulse-muted">
                                                    {metaLine(e, unit)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
