'use client';
import type { ExerciseCategory, RecoveryStatus } from '@/lib/pulse/types';

// Chip semantics lifted from MuscleVolumeBars so the promoted Recovery card
// reads identically to the inline chips it replaces.
const RECOVERY_CHIP: Record<RecoveryStatus, { label: string; className: string }> = {
    under: { label: 'add volume', className: 'text-pulse-dim' },
    high_fatigue: { label: 'high fatigue', className: 'text-pulse-accent' },
    overreaching: { label: 'over target', className: 'text-pulse-muted' },
    optimal: { label: 'on track', className: 'text-pulse-success' },
};

// Muscles that need attention, surfaced first and in priority order.
const ATTENTION_ORDER: RecoveryStatus[] = ['high_fatigue', 'under', 'overreaching'];

export default function RecoveryCard({
    recovery,
}: {
    recovery: Partial<Record<ExerciseCategory, RecoveryStatus>>;
}) {
    const entries = Object.entries(recovery) as Array<[ExerciseCategory, RecoveryStatus]>;

    // Attention rows first, ordered high_fatigue → under → overreaching, then
    // the rest (optimal) so the card always reads as a triage list.
    const attention = entries
        .filter(([, status]) => status !== 'optimal')
        .sort(([, a], [, b]) => ATTENTION_ORDER.indexOf(a) - ATTENTION_ORDER.indexOf(b));
    const onTrack = entries.filter(([, status]) => status === 'optimal');
    const rows = [...attention, ...onTrack];

    const attentionCount = attention.length;
    const summary =
        attentionCount === 0
            ? 'On track across the board.'
            : `${attentionCount} muscle${attentionCount === 1 ? '' : 's'} need attention this week.`;

    return (
        <div className="rounded-2xl bg-pulse-surface p-5">
            <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-muted mb-3">
                Recovery
            </div>
            {rows.length > 0 && (
                <ul className="flex flex-col gap-2.5">
                    {rows.map(([category, status]) => {
                        const chip = RECOVERY_CHIP[status];
                        return (
                            <li
                                key={category}
                                className="flex items-center justify-between gap-3 rounded-xl bg-pulse-bg px-3 py-2.5">
                                <span className="font-pulse text-[0.8125rem] text-pulse-dim capitalize">
                                    {category}
                                </span>
                                <span
                                    data-testid="recovery-chip"
                                    className={`font-pulse text-[0.6875rem] tracking-[0.04em] shrink-0 ${chip.className}`}>
                                    {chip.label}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <p className={`font-pulse text-[0.6875rem] text-pulse-muted ${rows.length > 0 ? 'mt-3' : ''}`}>
                {summary}
            </p>
        </div>
    );
}
