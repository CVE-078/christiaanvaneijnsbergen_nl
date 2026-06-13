'use client';
import { useState } from 'react';
import { buildBlockArc } from '@/lib/pulse/utils';
import { PHASE_DESCRIPTIONS } from '@/lib/pulse/explainCopy';
import type { Phase } from '@/lib/pulse/types';
import Why from './Why';

// Ascending phase tint, keyed by phase subtitle: a faint per-phase fill that
// intensifies toward the peak (mirroring the descending RIR), so the four phases
// read at a glance while staying calm. The selected/current week shows full
// phase colour. Phase colours are the fixed semantic hexes from data.ts, never
// the themeable accent.
const PHASE_TINT: Record<string, number> = {
    Accumulation: 18,
    Intensification: 28,
    Overreach: 40,
    'Peak & Deload': 52,
    Deload: 30,
};

interface Props {
    // Program block length (8/10/12/16); the block repeats.
    weeks: number;
    // The live in-block week (1..weeks); the default selection and the
    // authoritative position. Tapping a bar only previews another week, it never
    // changes the program position (completion-paced, system truth).
    currentWeek: number;
}

// The Plan training-block arc (variation A): one bar per week of the repeating
// block, height = planned volume, faint ascending phase tint, the live/selected
// week in full colour, the deload week marked. Tapping a week is read-only
// inspection: it updates the caption + phase description below, nothing else.
export default function BlockArc({ weeks, currentWeek }: Props) {
    const arc = buildBlockArc(weeks);
    const maxVol = Math.max(...arc.map((w) => w.volume), 1);
    const [selected, setSelected] = useState(currentWeek);
    const sel = arc.find((w) => w.week === selected) ?? arc[0];

    // Distinct phases in block order, for the legend (8-week has 3, 10-week's
    // last phase is "Deload", etc.).
    const legend = arc.reduce<Phase[]>((acc, w) => {
        if (!acc.some((p) => p.subtitle === w.phase.subtitle)) acc.push(w.phase);
        return acc;
    }, []);

    const barBg = (phase: Phase, isSel: boolean) =>
        isSel
            ? phase.color
            : `color-mix(in srgb, ${phase.color} ${PHASE_TINT[phase.subtitle] ?? 30}%, var(--color-pulse-surface-2))`;

    return (
        <div className="rounded-2xl bg-pulse-surface p-4">
            <div className="mb-3 flex items-baseline justify-between">
                <span className="font-pulse text-sm font-semibold text-pulse-text">{weeks}-week cycle</span>
                <span className="font-pulse text-[0.72rem] text-pulse-muted">repeats · deloads at the end</span>
            </div>

            {/* volume bars */}
            <div className="flex h-[74px] items-end gap-[3px]">
                {arc.map((w) => {
                    const isSel = w.week === selected;
                    return (
                        <button
                            key={w.week}
                            type="button"
                            onClick={() => setSelected(w.week)}
                            aria-pressed={isSel}
                            aria-label={`Week ${w.week}, ${w.phase.subtitle}, ${w.volume} sets, RIR ${w.rir}`}
                            className="relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end border-none bg-transparent p-0">
                            {w.isDeload && (
                                <span
                                    className="absolute -top-3 text-[0.62rem]"
                                    style={{ color: 'var(--color-pulse-error)' }}
                                    aria-hidden>
                                    ↓
                                </span>
                            )}
                            <span
                                className="w-full rounded-t-[3px] transition-colors duration-150"
                                style={{ height: `${(w.volume / maxVol) * 100}%`, background: barBg(w.phase, isSel) }}
                            />
                        </button>
                    );
                })}
            </div>

            {/* week numbers */}
            <div className="mt-1.5 flex gap-[3px]">
                {arc.map((w) => (
                    <span
                        key={w.week}
                        className={`flex-1 text-center font-pulse text-[0.56rem] ${w.week === selected ? 'font-bold text-pulse-text' : 'text-pulse-muted'}`}>
                        {w.week}
                    </span>
                ))}
            </div>

            {/* selected-week caption (tap readout) */}
            <div className="mt-3 flex flex-wrap items-center gap-[7px] font-pulse text-[0.78rem] text-pulse-dim">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sel.phase.color }} aria-hidden />
                <span>
                    <b className="font-semibold text-pulse-text">Week {sel.week}</b> · {sel.phase.subtitle}
                </span>
                <span className="text-pulse-border">|</span>
                <span>
                    <b className="font-semibold text-pulse-text">{sel.volume} sets</b>
                </span>
                <span className="text-pulse-border">|</span>
                <span>
                    <Why concept="rir" variant="glossary">
                        RIR
                    </Why>{' '}
                    <b className="font-semibold text-pulse-text">{sel.rir}</b>
                </span>
                {sel.isDeload && (
                    <>
                        <span className="text-pulse-border">|</span>
                        <Why concept="deload_week" variant="glossary">
                            deload
                        </Why>
                    </>
                )}
            </div>

            {/* phase description (plain language, updates per phase) */}
            {PHASE_DESCRIPTIONS[sel.phase.subtitle] && (
                <p className="mt-2 font-pulse text-[0.78rem] leading-[1.5] text-pulse-muted">
                    {PHASE_DESCRIPTIONS[sel.phase.subtitle]}
                </p>
            )}

            {/* phase legend (a quiet colour key at the bottom of the block) */}
            <div className="mt-3 flex flex-wrap gap-3">
                {legend.map((p) => (
                    <span
                        key={p.subtitle}
                        className="flex items-center gap-[5px] font-pulse text-[0.62rem] text-pulse-muted">
                        <i
                            className="inline-block h-[9px] w-[9px] shrink-0 rounded-[2px]"
                            style={{ background: `color-mix(in srgb, ${p.color} 60%, var(--color-pulse-surface-2))` }}
                            aria-hidden
                        />
                        {p.subtitle}
                    </span>
                ))}
            </div>
        </div>
    );
}
