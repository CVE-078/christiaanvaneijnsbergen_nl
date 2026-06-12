'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { decisionCopy, groupDecisionsByWeek } from '@/lib/pulse/decisionCopy';
import { getPhase, toDisplay } from '@/lib/pulse/utils';
import type { DecisionEventRow, DecisionEventType, Unit } from '@/lib/pulse/types';

// Reuse the same glyph and tone logic from CoachPanel.
const GLYPH: Record<DecisionEventType, string> = { progression: '↑', deload: '↓', ramp_back: '⟳', swap: '⇄' };

function tone(kind: DecisionEventType): string {
    return kind === 'progression' ? 'text-pulse-success' : 'text-pulse-accent';
}

function relativeDay(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

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

// The full timeline overlay, reused from CoachPanel logic but embedded here
// to keep CoachActivityTimeline self-contained.
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
                                            <span
                                                aria-hidden
                                                className={`grid shrink-0 place-items-center rounded-full border border-pulse-border bg-pulse-surface-2 h-[25px] w-[25px] text-[12px] ${tone(c.kind)}`}>
                                                {GLYPH[c.kind]}
                                            </span>
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

// CoachActivityTimeline shows the 3 most recent coach decisions as a visual
// timeline. Mirrors CoachPanel's data wiring exactly (decisions from usePulse,
// exercise names from routines). Renders nothing when there are no decisions.
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

    const recent = decisions.slice(0, 3);

    return (
        <>
            {/* Timeline rows */}
            <div className="relative pl-5">
                {/* Vertical connector line */}
                <div
                    aria-hidden
                    className="absolute left-1 top-2 bottom-2.5 w-0.5 rounded-full bg-pulse-border"
                />

                {recent.map((e) => {
                    const c = decisionCopy(e, nameFor(e.affectedArea));
                    return (
                        <div key={e.id} className="relative py-[9px]">
                            {/* Timeline dot */}
                            <div
                                aria-hidden
                                className={`absolute -left-5 top-[13px] h-[9px] w-[9px] rounded-full ${tone(c.kind).replace('text-', 'bg-')} shadow-[0_0_0_3px_var(--color-pulse-bg)]`}
                            />
                            <div className="font-pulse text-[0.86rem] font-medium text-pulse-text">
                                {c.headline}
                            </div>
                            <div className="font-pulse text-[0.76rem] text-pulse-muted mt-0.5">{c.why}</div>
                        </div>
                    );
                })}
            </div>

            {/* Show all link */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 cursor-pointer border-none bg-transparent p-0 font-pulse text-xs font-semibold text-pulse-accent hover:underline">
                Show all →
            </button>

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
