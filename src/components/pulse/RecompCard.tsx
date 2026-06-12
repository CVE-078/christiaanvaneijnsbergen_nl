'use client';
import type { RecompReadout, Unit, LengthUnit } from '@/lib/pulse/types';
import { toDisplay, toLengthDisplay } from '@/lib/pulse/utils';

const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→', none: '·' };

export default function RecompCard({
    readout,
    unit,
    lengthUnit,
}: {
    readout: RecompReadout;
    unit: Unit;
    lengthUnit: LengthUnit;
}) {
    const rows: Array<{ label: string; trend: string; detail: string }> = [
        {
            label: 'Strength',
            trend: readout.strength,
            detail:
                readout.strengthDeltaPct == null
                    ? '—'
                    : `${readout.strengthDeltaPct >= 0 ? '+' : ''}${readout.strengthDeltaPct.toFixed(0)}%`,
        },
        {
            label: 'Weight',
            trend: readout.weight,
            detail:
                readout.weightDeltaKg == null
                    ? '—'
                    : `${readout.weightDeltaKg >= 0 ? '+' : ''}${toDisplay(readout.weightDeltaKg, unit).toFixed(1)} ${unit}`,
        },
        {
            label: 'Waist',
            trend: readout.waist,
            detail:
                readout.waistDeltaCm == null
                    ? '—'
                    : `${readout.waistDeltaCm >= 0 ? '+' : ''}${toLengthDisplay(readout.waistDeltaCm, lengthUnit).toFixed(1)} ${lengthUnit}`,
        },
    ];
    // Compact evidence line: signed deltas for weight and waist, joined by " · ".
    // Only renders when at least one delta is present.
    const evidenceParts: string[] = [];
    if (readout.weightDeltaKg != null) {
        const sign = readout.weightDeltaKg >= 0 ? '+' : '';
        evidenceParts.push(`weight ${sign}${toDisplay(readout.weightDeltaKg, unit).toFixed(1)} ${unit}`);
    }
    if (readout.waistDeltaCm != null) {
        const sign = readout.waistDeltaCm >= 0 ? '+' : '';
        evidenceParts.push(`waist ${sign}${toLengthDisplay(readout.waistDeltaCm, lengthUnit).toFixed(1)} ${lengthUnit}`);
    }
    const evidenceLine = evidenceParts.length > 0 ? evidenceParts.join(' · ') : null;

    return (
        <div className="rounded-2xl bg-pulse-surface p-5">
            <p className="font-pulse text-[0.9375rem] text-pulse-text leading-[1.5] mb-1">{readout.verdict}</p>
            {evidenceLine && (
                <p className="font-pulse text-[0.75rem] text-pulse-muted mb-4">{evidenceLine}</p>
            )}
            {!evidenceLine && <div className="mb-4" />}
            <div className="flex gap-3">
                {rows.map((r) => (
                    <div key={r.label} className="flex-1 rounded-xl bg-pulse-bg px-3 py-2.5">
                        <div className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-muted">
                            {r.label}
                        </div>
                        <div className="font-pulse text-[1.0625rem] font-medium text-pulse-text mt-0.5">
                            <span className={r.trend === 'none' ? 'text-pulse-muted' : 'text-pulse-accent'}>
                                {ARROW[r.trend]}
                            </span>{' '}
                            <span className="text-[0.8125rem] text-pulse-dim">{r.detail}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
