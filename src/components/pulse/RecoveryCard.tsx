'use client';
import type { ExerciseCategory, RecoveryDetail, RecoveryStatus } from '@/lib/pulse/types';

// Chip text + tint per status, token-only (coral tint for fatigue, green for on
// track, neutral for the rest). The detail string is built per row from the
// numbers computeRecoveryFlags now carries (avg RIR, sets, sets-to-go).
const CHIP: Record<RecoveryStatus, { className: string }> = {
    under: { className: 'text-pulse-dim bg-pulse-surface-2' },
    high_fatigue: { className: 'text-pulse-accent bg-pulse-accent/10' },
    overreaching: { className: 'text-pulse-muted bg-pulse-surface-2' },
    optimal: { className: 'text-pulse-success bg-pulse-success/10' },
};

function chipLabel(d: RecoveryDetail): string {
    switch (d.status) {
        case 'high_fatigue':
            return d.avgRir !== null ? `high fatigue · RIR ${d.avgRir.toFixed(1)}` : 'high fatigue';
        case 'under':
            return `add volume · ${d.toGo} to go`;
        case 'overreaching':
            return `over target · ${d.sets} sets`;
        case 'optimal':
            return 'on track';
    }
}

// Muscles that need attention, surfaced first and in priority order.
const ATTENTION_ORDER: RecoveryStatus[] = ['high_fatigue', 'under', 'overreaching'];

export default function RecoveryCard({
    recovery,
}: {
    recovery: Partial<Record<ExerciseCategory, RecoveryDetail>>;
}) {
    const entries = Object.entries(recovery) as Array<[ExerciseCategory, RecoveryDetail]>;

    // Attention rows first (high_fatigue → under → overreaching), then on-track,
    // so the card always reads as a triage list.
    const attention = entries
        .filter(([, d]) => d.status !== 'optimal')
        .sort(([, a], [, b]) => ATTENTION_ORDER.indexOf(a.status) - ATTENTION_ORDER.indexOf(b.status));
    const onTrack = entries.filter(([, d]) => d.status === 'optimal');
    const rows = [...attention, ...onTrack];

    const attentionCount = attention.length;
    const summary =
        attentionCount === 0
            ? 'On track across the board.'
            : `${attentionCount} muscle${attentionCount === 1 ? '' : 's'} need attention this week.`;

    return (
        <div className="rounded-2xl bg-pulse-surface p-5">
            <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-muted mb-3">Recovery</div>
            {rows.length > 0 && (
                <ul className="flex flex-col gap-2.5">
                    {rows.map(([category, detail]) => (
                        <li
                            key={category}
                            className="flex items-center justify-between gap-3 rounded-xl bg-pulse-bg px-3 py-2.5">
                            <span className="font-pulse text-[0.8125rem] text-pulse-dim capitalize">{category}</span>
                            <span
                                data-testid="recovery-chip"
                                className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.02em] shrink-0 rounded-full px-2.5 py-1 ${CHIP[detail.status].className}`}>
                                {chipLabel(detail)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className={`font-pulse text-[0.6875rem] text-pulse-muted ${rows.length > 0 ? 'mt-3' : ''}`}>{summary}</p>
        </div>
    );
}
