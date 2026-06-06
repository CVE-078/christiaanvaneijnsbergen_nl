'use client';
import { useMemo } from 'react';
import { computePlates, toDisplay } from '@/lib/pulse/utils';
import { BARBELL_KG } from '@/lib/pulse/constants';
import type { Unit } from '@/lib/pulse/types';

interface Props {
    targetKg: number;
    unit: Unit;
    onClose?: () => void;
}

// Disc height range (px) for the loaded-bar visual; each plate scales between
// these by its weight relative to the heaviest plate on the bar.
const DISC_MIN = 26;
const DISC_MAX = 70;

// A loaded-bar readout: the per-side plates drawn on a barbell, heaviest at the
// collar. Plate calc is gated to barbell / plate-loaded lifts upstream, so the
// base is always the barbell.
export default function PlateCalculator({ targetKg, unit, onClose }: Props) {
    const result = useMemo(() => computePlates(targetKg, 'barbell'), [targetKg]);
    const perSideTotal = result.perSide.reduce((sum, p) => sum + p, 0);
    const loaded = BARBELL_KG + perSideTotal * 2;
    const heaviest = result.perSide.length > 0 ? Math.max(...result.perSide) : 1;

    return (
        <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-pulse-border bg-pulse-surface px-3.5 py-3">
            <div className="flex items-center gap-2">
                <span className="font-pulse-body text-[0.625rem] uppercase tracking-[0.14em] text-pulse-dim">
                    Loaded bar
                </span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto cursor-pointer rounded-lg border border-pulse-border bg-transparent px-2.5 py-0.5 font-pulse text-[0.6875rem] font-medium text-pulse-dim transition-colors hover:border-pulse-muted hover:text-pulse-text">
                        Close
                    </button>
                )}
            </div>

            {result.perSide.length > 0 ? (
                <>
                    <span className="font-pulse-body text-[0.5625rem] uppercase tracking-[0.1em] text-pulse-muted">
                        Per side
                    </span>
                    {/* Visual: a knurled shaft + collar, then plates heaviest-first. Each
                        column ends with a label so every bar shares a baseline. */}
                    <div className="flex items-end gap-[4px]" aria-hidden>
                        <div className="flex flex-col items-center gap-1">
                            <span className="h-[7px] w-[30px] rounded-l-[4px] bg-gradient-to-b from-[#4a525a] to-[#2c3238]" />
                            <span className="font-pulse-display text-[0.5625rem] leading-none invisible">0</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="h-[15px] w-[7px] rounded-[2px] bg-[#3a4148]" />
                            <span className="font-pulse-display text-[0.5625rem] leading-none invisible">0</span>
                        </div>
                        {result.perSide.map((plate, i) => (
                            <div key={`${plate}-${i}`} className="flex flex-col items-center gap-1">
                                <span
                                    style={{ height: `${DISC_MIN + (plate / heaviest) * (DISC_MAX - DISC_MIN)}px` }}
                                    className="w-[18px] rounded-[4px] bg-pulse-accent shadow-[inset_0_-3px_5px_rgba(0,0,0,0.18)]"
                                />
                                <span className="font-pulse-display text-[0.5625rem] font-bold leading-none text-pulse-dim">
                                    {toDisplay(plate, unit)}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Readable breakdown for screen readers (the viz is aria-hidden). */}
                    <span className="sr-only">
                        Per side: {result.perSide.map((p) => `${toDisplay(p, unit)} ${unit}`).join(', ')}
                    </span>
                    <p className="font-pulse-body text-[0.6875rem] text-pulse-muted">
                        {toDisplay(BARBELL_KG, unit)} {unit} bar +{' '}
                        <span className="font-medium text-pulse-text">
                            {toDisplay(perSideTotal, unit)} {unit} per side
                        </span>{' '}
                        = {toDisplay(loaded, unit)} {unit}
                    </p>
                    {!result.achievable && (
                        <span className="font-pulse-body text-[0.625rem] text-pulse-muted">
                            + {toDisplay(result.remainderKg, unit)} {unit} per side not loadable
                        </span>
                    )}
                </>
            ) : (
                <span className="font-pulse-body text-[0.75rem] text-pulse-dim">
                    Below the empty bar ({toDisplay(BARBELL_KG, unit)} {unit}).
                </span>
            )}
        </div>
    );
}
