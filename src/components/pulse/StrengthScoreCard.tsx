'use client';
import type { StrengthScore } from '@/lib/pulse/types';

export default function StrengthScoreCard({ strength }: { strength: StrengthScore }) {
    if (strength.score === null) {
        return (
            <div className="rounded-2xl bg-pulse-surface p-5">
                <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-muted mb-2">
                    Strength Score
                </div>
                <p className="font-pulse text-[0.875rem] text-pulse-dim leading-[1.5]">{strength.reason}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl bg-pulse-surface p-5">
            <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-muted mb-2">
                Strength Score
            </div>
            <div className="flex items-baseline gap-3 mb-4">
                <span className="font-pulse text-[3.25rem] leading-none font-medium tracking-[-0.02em] text-pulse-accent">
                    {strength.score}
                </span>
                <span className="font-pulse text-[1.0625rem] font-medium text-pulse-text">{strength.level}</span>
                <span className="font-pulse text-[0.8125rem] text-pulse-muted ml-auto">/ 100</span>
            </div>
            <div className="flex flex-col gap-2.5">
                {strength.lifts.map((l) => (
                    <div key={l.lift} className="flex items-center gap-3">
                        <span className="font-pulse text-[0.8125rem] text-pulse-dim w-28 shrink-0">{l.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-pulse-bg overflow-hidden">
                            <div
                                className="h-full rounded-full bg-pulse-accent"
                                style={{ width: `${Math.min(100, Math.max(0, l.subScore))}%` }}
                            />
                        </div>
                        <span className="font-pulse text-[0.8125rem] font-medium text-pulse-text w-7 text-right shrink-0">
                            {l.subScore}
                        </span>
                    </div>
                ))}
            </div>
            {strength.approximate && (
                <p className="mt-3 font-pulse text-[0.75rem] text-pulse-muted leading-[1.5]">
                    Approximate, set your gender in Profile to refine it to sex-specific standards.
                </p>
            )}
        </div>
    );
}
