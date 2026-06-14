'use client';
import { toDisplay } from '@/lib/pulse/utils';
import type { SessionTargetRow, Unit } from '@/lib/pulse/types';
// SessionTargetRow + Unit both live in types.ts (the single source for types).
import SectionLabel from './SectionLabel';
import { BTN_PRIMARY } from './ui';

interface Props {
    // Session name (e.g. "Upper A") and the day it is scheduled (e.g. "Tue").
    sessionLabel: string;
    dayLabel: string;
    rows: SessionTargetRow[];
    unit: Unit;
    // Jump straight into this session on the Train screen.
    onStart: () => void;
}

// The working weight the Train screen will prefill, formatted per row. Bodyweight
// lifts read "Bodyweight" (or "+N" added load); a lift with no prior set and no
// starting weight shows the "—" no-data placeholder.
function targetLabel(row: SessionTargetRow, unit: Unit): string {
    if (row.bodyweight) {
        return row.weightKg && row.weightKg > 0 ? `+${toDisplay(row.weightKg, unit)} ${unit}` : 'Bodyweight';
    }
    return row.weightKg !== null ? `${toDisplay(row.weightKg, unit)} ${unit}` : '—';
}

// Read-only preview of the next scheduled session and the weights the engine will
// prefill, so the Plan screen shows what you will actually lift next, not just the
// sets x reps template. Data is computed in computeSessionTargets; this only
// formats and lays out.
export default function NextSessionCard({ sessionLabel, dayLabel, rows, unit, onStart }: Props) {
    return (
        <div className="bg-pulse-surface rounded-2xl p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <SectionLabel>Next session</SectionLabel>
                <span className="font-pulse text-[0.8125rem] font-semibold text-pulse-accent">
                    {sessionLabel}
                    <span className="text-pulse-muted"> · {dayLabel}</span>
                </span>
            </div>
            <div>
                {rows.map((row) => (
                    <div
                        key={row.routineExerciseId}
                        className="flex items-baseline justify-between gap-4 border-b border-pulse-border py-2.5 last:border-b-0">
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-pulse text-[0.9375rem] font-medium tracking-[-0.01em] text-pulse-text">
                                {row.name}
                            </div>
                            <div className="font-pulse-body text-[0.6875rem] tracking-[0.04em] text-pulse-muted mt-0.5">
                                {row.sets} × {row.prescription}
                            </div>
                        </div>
                        <span className="shrink-0 font-pulse text-[0.875rem] font-semibold tabular-nums text-pulse-dim">
                            {targetLabel(row, unit)}
                        </span>
                    </div>
                ))}
            </div>
            <button type="button" onClick={onStart} className={`${BTN_PRIMARY} mt-4 w-full`}>
                Start session →
            </button>
        </div>
    );
}
