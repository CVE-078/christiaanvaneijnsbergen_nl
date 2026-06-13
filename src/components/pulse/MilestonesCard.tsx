'use client';
import { useState } from 'react';
import ModalSheet from './ModalSheet';
import { ModalGroupHeader, ModalIconBadge } from './ui/ModalList';
import { formatLogDate } from '@/lib/pulse/dates';
import type { Milestone, MilestoneKind } from '@/lib/pulse/milestones';

// Icon per kind (presentation lives here, not in the model).
function Icon({ kind }: { kind: MilestoneKind }) {
    const common = {
        width: 17,
        height: 17,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };
    if (kind === 'pr')
        return (
            <svg {...common}>
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
        );
    if (kind === 'streak')
        return (
            <svg {...common}>
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
            </svg>
        );
    if (kind === 'week_completed')
        return (
            <svg {...common} strokeWidth={2.2}>
                <path d="M20 6 9 17l-5-5" />
            </svg>
        );
    return (
        <svg {...common}>
            <path d="m6.5 6.5 11 11" />
            <path d="m21 21-1-1" />
            <path d="m3 3 1 1" />
            <path d="m18 22 4-4" />
            <path d="m2 6 4-4" />
            <path d="m3 10 7-7" />
            <path d="m14 21 7-7" />
        </svg>
    );
}

const ICON_WRAP: Record<MilestoneKind, string> = {
    pr: 'bg-pulse-accent/15 text-pulse-accent',
    streak: 'bg-pulse-warn/15 text-pulse-warn',
    week_completed: 'bg-pulse-success/15 text-pulse-success',
    session_count: 'bg-pulse-surface-2 text-pulse-dim',
};

function Row({ m, today }: { m: Milestone; today: string }) {
    return (
        <div className="flex items-center gap-3 border-b border-pulse-border py-3 last:border-b-0">
            <ModalIconBadge className={ICON_WRAP[m.kind]}>
                <Icon kind={m.kind} />
            </ModalIconBadge>
            <div className="min-w-0 flex-1">
                <div className="font-pulse text-[0.9rem] font-medium text-pulse-text">{m.title}</div>
                <div className="mt-[2px] font-pulse text-[0.74rem] text-pulse-muted">{m.detail}</div>
            </div>
            <span className="shrink-0 font-pulse text-[0.72rem] text-pulse-muted">
                {formatLogDate(m.dateIso.split('T')[0], today)}
            </span>
        </div>
    );
}

// Month groups for the "Show all" modal, mirroring AllWorkoutsModal: input is
// newest-first, so groups come out newest month first with items in given order.
function groupByMonth(milestones: Milestone[]): { key: string; label: string; items: Milestone[] }[] {
    const groups: { key: string; label: string; items: Milestone[] }[] = [];
    for (const m of milestones) {
        const monthKey = m.dateIso.slice(0, 7);
        let g = groups.find((x) => x.key === monthKey);
        if (!g) {
            const label = new Date(m.dateIso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            g = { key: monthKey, label, items: [] };
            groups.push(g);
        }
        g.items.push(m);
    }
    return groups;
}

export default function MilestonesCard({ milestones }: { milestones: Milestone[] }) {
    const [allOpen, setAllOpen] = useState(false);
    if (milestones.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    const top = milestones.slice(0, 4);

    return (
        <div className="flex flex-1 flex-col rounded-2xl bg-pulse-surface px-4 py-1.5">
            {top.map((m) => (
                <Row key={m.id} m={m} today={today} />
            ))}
            {milestones.length > 4 && (
                <button
                    type="button"
                    onClick={() => setAllOpen(true)}
                    className="mb-1 mt-auto flex w-full items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                    Show all {milestones.length} milestones
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
            <ModalSheet
                open={allOpen}
                onClose={() => setAllOpen(false)}
                title="Milestones"
                subtitle={`${milestones.length} ${milestones.length === 1 ? 'milestone' : 'milestones'}`}>
                <div className="flex-1 overflow-y-auto px-6 pb-1">
                    {groupByMonth(milestones).map((group) => (
                        <div key={group.key}>
                            <ModalGroupHeader
                                label={group.label}
                                count={`${group.items.length} ${group.items.length === 1 ? 'milestone' : 'milestones'}`}
                            />
                            {group.items.map((m) => (
                                <Row key={m.id} m={m} today={today} />
                            ))}
                        </div>
                    ))}
                </div>
            </ModalSheet>
        </div>
    );
}
