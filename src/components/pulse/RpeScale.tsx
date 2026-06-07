'use client';

const ANCHORS: Record<number, string> = {
    1: 'very easy',
    2: 'easy',
    3: 'easy',
    4: 'moderate',
    5: 'moderate',
    6: 'getting hard',
    7: 'hard but a couple reps left in the tank',
    8: 'hard, close to the limit',
    9: 'almost maxed out',
    10: 'all-out, nothing left',
};

export default function RpeScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
    return (
        <div className="rounded-2xl border border-pulse-border bg-pulse-surface px-4 pb-3.5 pt-4">
            <div className="font-pulse text-[0.9375rem] font-bold text-pulse-text">How hard was that?</div>
            <div className="mt-3 grid grid-cols-10 gap-[5px]">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const selected = value === n;
                    const filled = value !== null && n < value;
                    return (
                        <button
                            key={n}
                            type="button"
                            aria-label={`Rate effort ${n}`}
                            aria-pressed={selected}
                            onClick={() => onChange(n)}
                            className={`grid aspect-square cursor-pointer place-items-center rounded-[9px] border font-pulse-display text-[0.9375rem] font-bold transition-colors ${
                                selected
                                    ? 'border-pulse-accent bg-pulse-accent text-pulse-bg'
                                    : filled
                                      ? 'border-transparent bg-pulse-accent/15 text-pulse-dim'
                                      : 'border-transparent bg-pulse-surface-2 text-pulse-muted hover:text-pulse-dim'
                            }`}>
                            {n}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2.5 flex justify-between font-pulse-body text-[0.5625rem] uppercase tracking-[0.1em] text-pulse-muted">
                <span>Easy</span>
                <span>Hard</span>
                <span>Max</span>
            </div>
            {value === null ? (
                <p className="mt-2.5 font-pulse-body text-[0.6875rem] text-pulse-muted">
                    Tap to rate overall effort (optional)
                </p>
            ) : (
                <p className="mt-2.5 font-pulse-body text-[0.6875rem] text-pulse-accent">
                    RPE {value} · {ANCHORS[value]}.
                </p>
            )}
        </div>
    );
}
