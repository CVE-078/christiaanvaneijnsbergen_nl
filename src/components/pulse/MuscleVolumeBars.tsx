'use client';
import type { ExerciseCategory, RecoveryStatus } from '@/lib/pulse/types';
import { computeVolumeProgress } from '@/lib/pulse/utils';

interface MuscleVolumeBarsProps {
    volume: Partial<Record<ExerciseCategory, number>>;
    targets?: Partial<Record<ExerciseCategory, [number, number]>>;
    recovery?: Partial<Record<ExerciseCategory, RecoveryStatus>>;
}

// Maps a recovery status to its chip label and pulse-token text color.
// high_fatigue is the only one worth the accent; the rest stay dim or muted.
const RECOVERY_CHIP: Record<RecoveryStatus, { label: string; className: string }> = {
    under: { label: 'add volume', className: 'text-pulse-dim' },
    high_fatigue: { label: 'high fatigue', className: 'text-pulse-accent' },
    overreaching: { label: 'over target', className: 'text-pulse-muted' },
    optimal: { label: 'on track', className: 'text-pulse-muted' },
};

// Presentational per-muscle weekly volume. Coral horizontal bars sized
// proportional to the busiest category, sorted by set count descending.
// Surfaces are separated by tone and whitespace, not borders.
//
// With `targets`, switches to target mode: every targeted muscle gets a row
// (even at 0 sets), bars fill toward the target ceiling, and a summary line
// calls out the muscles still short of their floor.
export default function MuscleVolumeBars({ volume, targets, recovery }: MuscleVolumeBarsProps) {
    if (targets) {
        return <TargetMode volume={volume} targets={targets} recovery={recovery} />;
    }

    const rows = (Object.entries(volume) as Array<[ExerciseCategory, number]>)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);

    if (rows.length === 0) {
        return <p className="font-pulse text-[0.75rem] text-pulse-dim py-2">No sets logged this week.</p>;
    }

    const max = rows[0][1];

    return (
        <ul className="flex flex-col gap-3">
            {rows.map(([category, count]) => (
                <li key={category} className="flex items-center gap-3">
                    <span
                        data-testid="muscle-label"
                        className="font-pulse text-[0.8125rem] text-pulse-dim capitalize w-20 shrink-0">
                        {category}
                    </span>
                    <span className="flex-1 h-2 rounded-full bg-pulse-surface-2 overflow-hidden">
                        <span
                            data-testid="muscle-bar"
                            className="block h-full rounded-full bg-pulse-accent"
                            style={{ width: `${(count / max) * 100}%` }}
                        />
                    </span>
                    <span className="font-pulse text-[0.8125rem] font-medium text-pulse-text w-5 text-right shrink-0">
                        {count}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function TargetMode({
    volume,
    targets,
    recovery,
}: {
    volume: Partial<Record<ExerciseCategory, number>>;
    targets: Partial<Record<ExerciseCategory, [number, number]>>;
    recovery?: Partial<Record<ExerciseCategory, RecoveryStatus>>;
}) {
    const rows = computeVolumeProgress(volume, targets);
    const lagging = rows.filter((row) => row.toGo > 0).slice(0, 3);
    const summary =
        lagging.length === 0
            ? 'On target across the board.'
            : lagging
                  .map((row, i) =>
                      i === 0 ? `${row.toGo} to go on ${row.category}` : `${row.toGo} on ${row.category}`,
                  )
                  .join(' · ');

    return (
        <div>
            <p className="font-pulse text-[0.8125rem] text-pulse-dim mb-3">{summary}</p>
            <ul className="flex flex-col gap-3">
                {rows.map((row) => {
                    const chip = recovery?.[row.category] ? RECOVERY_CHIP[recovery[row.category]!] : null;
                    return (
                        <li key={row.category} className="flex items-center gap-3">
                            <span
                                data-testid="muscle-label"
                                className="font-pulse text-[0.8125rem] text-pulse-dim capitalize w-20 shrink-0">
                                {row.category}
                            </span>
                            <span className="flex-1 h-2 rounded-full bg-pulse-surface-2 overflow-hidden">
                                <span
                                    data-testid="muscle-bar"
                                    className="block h-full rounded-full bg-pulse-accent"
                                    style={{ width: `${(Math.min(row.actual, row.max) / row.max) * 100}%` }}
                                />
                            </span>
                            {chip && (
                                <span
                                    data-testid="recovery-chip"
                                    className={`font-pulse text-[0.6875rem] tracking-[0.04em] shrink-0 ${chip.className}`}>
                                    {chip.label}
                                </span>
                            )}
                            <span className="flex flex-col items-end shrink-0">
                                <span className="font-pulse text-[0.8125rem] leading-tight">
                                    <span className="font-medium text-pulse-text">{row.actual}</span>
                                    <span className="text-pulse-muted">
                                        {' '}
                                        / {row.min}-{row.max}
                                    </span>
                                </span>
                                {row.toGo > 0 && (
                                    <span className="font-pulse text-[0.6875rem] text-pulse-dim">{row.toGo} to go</span>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
