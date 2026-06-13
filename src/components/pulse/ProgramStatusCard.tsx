'use client';
import { usePulse } from '@/context/PulseContext';
import { formatProgramStatus } from '@/lib/pulse/utils';
import Why from './Why';

// Pill tint per status tone.
const PILL_CLASS: Record<'success' | 'warn' | 'muted', string> = {
    success: 'text-pulse-success bg-pulse-success/10',
    warn: 'text-pulse-accent bg-pulse-accent/10',
    muted: 'text-pulse-muted bg-pulse-surface-2',
};

// ProgramStatusCard shows the current program position: status pill, progress
// bar, next deload, and this-week volume. Renders nothing when there is no
// active program position.
export default function ProgramStatusCard() {
    const { programPosition, activeRoutine } = usePulse();

    if (!programPosition) return null;

    const programWeeks = activeRoutine?.program_weeks ?? 12;
    const { statusLabel, statusTone, weekLabel, progress, nextDeloadWeek } = formatProgramStatus(
        programPosition,
        programWeeks,
    );

    const weeksAway = Math.max(0, nextDeloadWeek - programPosition.weekInteger);

    // Behind / lapsed get an on-demand, never-punish "why" on the pill (never an
    // always-on banner). Other statuses (on track, paused) stay plain.
    const explainConcept =
        programPosition.status === 'lapsed' ? 'lapsed' : programPosition.status === 'behind' ? 'behind' : null;
    const explainParams =
        explainConcept === 'lapsed'
            ? { daysAway: programPosition.daysSinceLastSession ?? undefined }
            : explainConcept === 'behind'
              ? { behindBy: programPosition.behindBy }
              : undefined;

    return (
        <div className="rounded-2xl bg-pulse-surface p-5">
            {/* Top row: status pill + week label */}
            <div className="flex items-center justify-between mb-3">
                <span
                    className={`font-pulse text-[0.72rem] font-semibold rounded-full px-[11px] py-1 ${PILL_CLASS[statusTone]}`}>
                    {explainConcept ? (
                        <Why concept={explainConcept} params={explainParams} variant="why">
                            {statusLabel}
                        </Why>
                    ) : (
                        statusLabel
                    )}
                </span>
                <span className="font-pulse text-[0.85rem] text-pulse-dim">{weekLabel}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-pulse-bg overflow-hidden">
                <div
                    className="h-full rounded-full bg-pulse-accent transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                    aria-label={`${Math.round(progress * 100)}% of program complete`}
                />
            </div>

            {/* Sub-stats */}
            <div className="flex gap-5 mt-3 flex-wrap">
                <span className="font-pulse text-[0.78rem] text-pulse-muted">
                    Next deload <strong className="font-semibold text-pulse-text">week {nextDeloadWeek}</strong>
                    {weeksAway > 0 && (
                        <span className="text-pulse-muted">
                            {', '}
                            {weeksAway} {weeksAway === 1 ? 'week' : 'weeks'} away
                        </span>
                    )}
                </span>
                {programPosition.behindBy > 0 && (
                    <span className="font-pulse text-[0.78rem] text-pulse-muted">
                        Behind by{' '}
                        <strong className="font-semibold text-pulse-text">
                            {programPosition.behindBy} {programPosition.behindBy === 1 ? 'session' : 'sessions'}
                        </strong>
                    </span>
                )}
            </div>
        </div>
    );
}
