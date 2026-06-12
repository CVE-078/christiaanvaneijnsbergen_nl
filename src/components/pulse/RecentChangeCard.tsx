'use client';
import { toDisplay, toLengthDisplay } from '@/lib/pulse/utils';
import type { RecompReadout } from '@/lib/pulse/types';
import type { Unit, LengthUnit } from '@/lib/pulse/types';

interface Props {
    readout: RecompReadout;
    unit: Unit;
    lengthUnit: LengthUnit;
    weeks: number;
}

// Formats a delta with a leading sign and the given suffix.
// Returns the em-dash placeholder when the value is null.
function fmtDelta(value: number | null, suffix: string): string {
    if (value === null) return '—';
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${Math.abs(value)} ${suffix}`;
}

// Presentational card showing the 3 recomp deltas (weight / waist / lifts)
// derived from RecompReadout. Receives the readout as a prop; no context calls.
export default function RecentChangeCard({ readout, unit, lengthUnit, weeks }: Props) {
    const weightAbs =
        readout.weightDeltaKg !== null
            ? Math.round(Math.abs(toDisplay(readout.weightDeltaKg, unit)) * 10) / 10
            : null;
    const weightSign =
        readout.weightDeltaKg !== null ? (readout.weightDeltaKg > 0 ? '+' : readout.weightDeltaKg < 0 ? '-' : '') : '';
    const weightStr = weightAbs !== null ? `${weightSign}${weightAbs} ${unit}` : '—';

    const waistAbs =
        readout.waistDeltaCm !== null
            ? Math.round(Math.abs(toLengthDisplay(readout.waistDeltaCm, lengthUnit)) * 10) / 10
            : null;
    const waistSign =
        readout.waistDeltaCm !== null ? (readout.waistDeltaCm > 0 ? '+' : readout.waistDeltaCm < 0 ? '-' : '') : '';
    const waistStr = waistAbs !== null ? `${waistSign}${waistAbs} ${lengthUnit}` : '—';

    const liftStr =
        readout.strengthDeltaPct !== null
            ? `${readout.strengthDeltaPct > 0 ? '+' : readout.strengthDeltaPct < 0 ? '-' : ''}${Math.round(Math.abs(readout.strengthDeltaPct))}%`
            : '—';

    return (
        <div className="flex flex-col h-full">
            <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                Recent change, {weeks} weeks
            </div>
            <div className="rounded-2xl bg-pulse-surface p-5 flex-1 flex items-center justify-center">
                <div className="flex gap-5">
                    <div>
                        <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">
                            Weight
                        </div>
                        <div
                            className={`font-pulse-display font-semibold text-[1.15rem] mt-[3px] ${readout.weightDeltaKg !== null && readout.weightDeltaKg < 0 ? 'text-pulse-success' : 'text-pulse-text'}`}>
                            {weightStr}
                        </div>
                    </div>
                    <div>
                        <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">
                            Waist
                        </div>
                        <div
                            className={`font-pulse-display font-semibold text-[1.15rem] mt-[3px] ${readout.waistDeltaCm !== null && readout.waistDeltaCm < 0 ? 'text-pulse-success' : 'text-pulse-text'}`}>
                            {waistStr}
                        </div>
                    </div>
                    <div>
                        <div className="font-pulse text-[0.6rem] tracking-[0.08em] uppercase text-pulse-muted">
                            Lifts
                        </div>
                        <div
                            className={`font-pulse-display font-semibold text-[1.15rem] mt-[3px] ${readout.strengthDeltaPct !== null && readout.strengthDeltaPct > 0 ? 'text-pulse-success' : 'text-pulse-text'}`}>
                            {liftStr}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
