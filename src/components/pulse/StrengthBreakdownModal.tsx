'use client';
import ModalSheet from './ModalSheet';
import type { StrengthScore } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    strength: StrengthScore;
    onClose: () => void;
}

export default function StrengthBreakdownModal({ open, strength, onClose }: Props) {
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
                        {strength.score}
                    </span>
                    <span className="font-pulse text-[0.8rem] text-pulse-muted">/ 100</span>
                </div>
            )}

            {/* Per-lift sub-score rows, mirroring StrengthScoreCard markup */}
            <div className="flex-1 overflow-y-auto px-6 pb-2">
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
