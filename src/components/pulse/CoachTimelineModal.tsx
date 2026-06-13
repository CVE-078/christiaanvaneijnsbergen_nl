'use client';
import ModalSheet from './ModalSheet';
import { decisionCopy } from '@/lib/pulse/decisionCopy';
import { getPhase, toDisplay } from '@/lib/pulse/utils';
import type { DecisionEventRow, DecisionEventType, Unit } from '@/lib/pulse/types';

const GLYPH: Record<DecisionEventType, string> = { progression: '↑', deload: '↓', ramp_back: '⟳', swap: '⇄' };

// Progressions read as positive (success green); everything else uses the
// themeable accent so the surface still tracks a user-picked accent colour.
export function tone(kind: DecisionEventType): string {
    return kind === 'progression' ? 'text-pulse-success' : 'text-pulse-accent';
}

// The round glyph badge for a decision. Shared by the compact CoachPanel rows and
// the full timeline below, so the two surfaces never drift.
export function Dot({ kind, small }: { kind: DecisionEventType; small?: boolean }) {
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

// The full Coach Decision Timeline, on the shared ModalSheet shell (bottom-sheet
// on mobile with a swipe-to-dismiss grip, centered dialog on desktop). Entries are
// grouped by program week, newest week first. Used by both the Train CoachPanel and
// the Progress CoachActivityTimeline so the two open the same surface.
export default function CoachTimelineModal({
    open,
    onClose,
    groups,
    nameFor,
    unit,
    programWeeks,
}: {
    open: boolean;
    onClose: () => void;
    groups: Array<{ week: number; events: DecisionEventRow[] }>;
    nameFor: (reId: string) => string | null;
    unit: Unit;
    programWeeks: number;
}) {
    const count = groups.reduce((n, g) => n + g.events.length, 0);
    return (
        <ModalSheet
            open={open}
            onClose={onClose}
            title="Coach decisions"
            ariaLabel="Coach decision timeline"
            subtitle={`${count} ${count === 1 ? 'decision' : 'decisions'}`}>
            <div className="flex-1 overflow-y-auto px-6 pb-1">
                {groups.map((g) => {
                    const phase = getPhase(g.week, programWeeks);
                    return (
                        <div key={g.week}>
                            <div className="sticky top-0 z-10 -mx-6 mb-3 flex items-baseline gap-2 bg-pulse-surface px-6 pb-2 pt-6 first:pt-2">
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
        </ModalSheet>
    );
}
