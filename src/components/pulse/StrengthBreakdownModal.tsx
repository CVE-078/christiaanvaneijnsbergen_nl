'use client';
import { useEffect } from 'react';
import type { StrengthScore } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    strength: StrengthScore;
    onClose: () => void;
}

// Bottom-sheet on mobile, centered dialog on desktop. Mirrors the shell used
// by SessionDetailModal and MetricHistoryModal.
export default function StrengthBreakdownModal({ open, strength, onClose }: Props) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Strength breakdown"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-6 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
                    <div>
                        <span className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight block">
                            Strength Score
                        </span>
                        {strength.level && (
                            <span className="font-pulse text-[0.8rem] text-pulse-muted">{strength.level}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>

                {/* Score line */}
                {strength.score !== null && (
                    <div className="flex items-baseline gap-3 px-[18px] pb-3">
                        <span className="font-pulse-display font-bold text-[3rem] leading-none text-pulse-accent">
                            {strength.score}
                        </span>
                        <span className="font-pulse text-[0.8rem] text-pulse-muted">/ 100</span>
                    </div>
                )}

                {/* Per-lift sub-score rows, mirroring StrengthScoreCard markup */}
                <div className="overflow-y-auto px-[18px] pb-2 flex-1">
                    {strength.lifts.length === 0 && strength.reason && (
                        <p className="py-4 font-pulse text-[0.875rem] text-pulse-dim leading-[1.5]">
                            {strength.reason}
                        </p>
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
            </div>
        </div>
    );
}
