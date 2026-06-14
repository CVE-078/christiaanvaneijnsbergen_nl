'use client';
import ModalSheet from './ModalSheet';
import Why from './Why';
import type { StrengthScore } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    strength: StrengthScore;
    series?: Array<{ week: number; score: number }>;
    onClose: () => void;
}

export default function StrengthBreakdownModal({ open, strength, series, onClose }: Props) {
    return (
        <ModalSheet
            open={open}
            onClose={onClose}
            title="Strength Score"
            ariaLabel="Strength breakdown"
            subtitle={strength.level ?? undefined}>
            {/* Score line */}
            {strength.score !== null && (
                <div className="flex items-baseline gap-3 px-6 pb-3">
                    <span className="font-pulse-display font-bold text-[3rem] leading-none text-pulse-accent">
                        <Why concept="strength_score" variant="why">
                            {strength.score}
                        </Why>
                    </span>
                    <span className="font-pulse text-[0.8rem] text-pulse-muted">/ 100</span>
                </div>
            )}

            {series &&
                series.length >= 2 &&
                (() => {
                    const scores = series.map((p) => p.score);
                    const min = Math.min(...scores);
                    const max = Math.max(...scores);
                    const span = max - min || 1;
                    const pts = series
                        .map((p, i) => {
                            const x = (i / (series.length - 1)) * 100;
                            const y = 28 - ((p.score - min) / span) * 24 - 2;
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ');
                    return (
                        <div className="px-6 pb-3">
                            <div className="mb-1.5 font-pulse text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                                Score trend
                            </div>
                            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-10 w-full">
                                <polyline
                                    points={pts}
                                    fill="none"
                                    stroke="var(--color-pulse-accent)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                    );
                })()}

            {/* Per-lift sub-score rows, mirroring StrengthScoreCard markup */}
            <div className="px-6">
                {strength.lifts.length === 0 && strength.reason && (
                    <p className="py-4 font-pulse text-[0.875rem] text-pulse-dim leading-[1.5]">{strength.reason}</p>
                )}
                <div className="flex flex-col gap-3">
                    {strength.lifts.map((l) => (
                        <div key={l.lift} className="flex items-center gap-3">
                            <span className="font-pulse text-[0.82rem] text-pulse-dim w-24 shrink-0 flex-none">
                                {l.label}
                            </span>
                            <div className="flex-1 h-[6px] rounded-full bg-pulse-bg overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-pulse-accent"
                                    style={{ width: `${Math.min(100, Math.max(0, l.subScore))}%` }}
                                />
                            </div>
                            <span className="font-pulse text-[0.82rem] font-semibold text-pulse-text w-7 text-right shrink-0 flex-none">
                                {l.subScore}
                            </span>
                        </div>
                    ))}
                </div>
                {strength.approximate && (
                    <p className="mt-4 font-pulse text-[0.75rem] text-pulse-muted leading-[1.5]">
                        Approximate; set your gender in Profile to refine it to gender-specific standards.
                    </p>
                )}
            </div>
        </ModalSheet>
    );
}
