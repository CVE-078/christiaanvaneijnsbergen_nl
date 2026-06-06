'use client';
import { usePulse } from '@/context/PulseContext';
import { computePerMuscleVolume, computeVolumeProgress, roundSets, priorityAdjustedTargets } from '@/lib/pulse/utils';
import { resolvePriority } from '@/lib/pulse/generation';
import { VOLUME_TARGETS } from '@/lib/pulse/data';

// Per-muscle weekly volume for the desktop right rail (Tier 1 #1). Uses the same
// attribution and targets as the Progress view (computePerMuscleVolume +
// priorityAdjustedTargets + computeVolumeProgress), so the rail and Progress never
// disagree. Rows sort lagging-first; the bar fills toward the weekly ceiling, a
// tick marks the floor (weekly minimum), and the fill turns the success green once
// the floor is hit. Renders nothing without an active routine.
export default function RailMuscleVolume() {
    const { logs, activeRoutine, currentWeek, profile } = usePulse();
    if (!activeRoutine) return null;

    const volume = computePerMuscleVolume(logs, activeRoutine.exercises ?? [], currentWeek);
    const targets = priorityAdjustedTargets(VOLUME_TARGETS, resolvePriority(profile.priority_muscle));
    const rows = computeVolumeProgress(volume, targets);
    if (rows.length === 0) return null;

    return (
        <div className="mt-9">
            <div className="text-xs uppercase tracking-[0.08em] text-pulse-muted">This week</div>
            <div className="mt-3.5 flex flex-col gap-1">
                {rows.map((r) => {
                    const done = r.actual >= r.min;
                    const fillPct = r.max > 0 ? Math.min(100, (r.actual / r.max) * 100) : 0;
                    const tickPct = r.max > 0 ? Math.min(100, (r.min / r.max) * 100) : 0;
                    const name = r.category.charAt(0).toUpperCase() + r.category.slice(1);
                    return (
                        <div key={r.category} className="grid grid-cols-[58px_1fr_auto] items-center gap-2.5 py-[3px]">
                            <span
                                className={`font-pulse text-[0.75rem] ${done ? 'text-pulse-dim' : 'text-pulse-text'}`}>
                                {name}
                            </span>
                            <span className="relative h-1.5 overflow-hidden rounded-full bg-pulse-surface-2">
                                <span
                                    className={`absolute inset-y-0 left-0 rounded-full ${done ? 'bg-pulse-success' : 'bg-pulse-accent'}`}
                                    style={{ width: `${fillPct}%` }}
                                />
                                <span
                                    className="absolute inset-y-0 w-px bg-pulse-muted/60"
                                    style={{ left: `${tickPct}%` }}
                                />
                            </span>
                            <span className="min-w-[2.1rem] text-right font-pulse text-[0.6875rem] tabular-nums text-pulse-muted">
                                <span className="font-semibold text-pulse-text">{roundSets(r.actual)}</span>/{r.min}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
