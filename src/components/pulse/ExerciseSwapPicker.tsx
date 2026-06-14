'use client';
import { useState } from 'react';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { rankSubstitutes, exerciseReason } from '@/lib/pulse/utils';
import { floatFavorites } from '@/lib/pulse/library';
import { SWAP_REASONS, type DbExercise, type SwapReason } from '@/lib/pulse/types';

const EMPTY_SET = new Set<string>();

interface Props {
    original: DbExercise;
    week: number;
    candidates: DbExercise[];
    isSwapped: boolean;
    onSelect: (exerciseId: string, reason: SwapReason | null) => void;
    onRevert: () => void;
    onClose: () => void;
    // Smart substitution v2 (#8): show the reason chips and capture the chosen
    // reason. Off for permanent (ProgramView) swaps, which do not persist a reason.
    captureReason?: boolean;
    favoriteIds?: Set<string>;
}

const REASON_LABELS: Record<SwapReason, string> = {
    pain: 'Pain',
    no_equipment: 'No equipment',
    crowded: 'Crowded',
};

// `hasJointSignal` gates the pain claim: only promise "gentler on the joints"
// when the candidate pool actually carries contraindication flags to rank on
// (the catalog's flag coverage is uneven per pattern). Otherwise stay neutral, no
// overclaim.
function reasonContext(reason: SwapReason | null, hasJointSignal: boolean): string {
    if (reason === 'pain') return hasJointSignal ? 'Same movement, gentler on the joints' : 'Same movement';
    if (reason === 'no_equipment' || reason === 'crowded') return 'Same movement, different gear';
    return 'Closest match';
}

export default function ExerciseSwapPicker({
    original,
    week,
    candidates,
    isSwapped,
    onSelect,
    onRevert,
    onClose,
    captureReason = false,
    favoriteIds,
}: Props) {
    const [query, setQuery] = useState('');
    const [reason, setReason] = useState<SwapReason | null>(null);
    const originalName = original.name;

    const ranked = floatFavorites(rankSubstitutes(original, candidates, reason ?? undefined), favoriteIds ?? EMPTY_SET);
    const hasJointSignal = candidates.some((e) => (e.contraindications?.length ?? 0) > 0);
    const q = query.trim().toLowerCase();
    const filtered = q ? ranked.filter((e) => e.name.toLowerCase().includes(q)) : ranked;
    const searching = q.length > 0;
    const suggested = searching ? [] : filtered.slice(0, 3);
    const rest = searching ? filtered : filtered.slice(3);

    const candidateButton = (e: DbExercise, showWhy: boolean) => {
        const why = showWhy ? exerciseReason(e) : null;
        return (
            <button
                key={e.id}
                onClick={() => onSelect(e.id, reason)}
                className="text-left bg-pulse-bg rounded-lg px-3.5 py-3 border-none cursor-pointer hover:bg-pulse-surface-2">
                <div className="font-pulse text-[0.9375rem] font-medium text-pulse-text">{e.name}</div>
                <div className="font-pulse text-[0.6875rem] tracking-[0.04em] uppercase text-pulse-muted mt-0.5">
                    {why ?? WORKOUT_TYPE_LABELS[e.category as keyof typeof WORKOUT_TYPE_LABELS] ?? e.category}
                </div>
            </button>
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label={`Swap ${originalName}`}
            onClick={onClose}>
            <div
                className="w-full sm:max-w-[440px] max-h-[80vh] flex flex-col bg-pulse-surface rounded-t-2xl sm:rounded-2xl p-5"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                    <h2 className="font-pulse text-base font-semibold text-pulse-text">Swap {originalName}</h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="font-pulse text-pulse-muted bg-transparent border-none cursor-pointer text-lg leading-none">
                        ✕
                    </button>
                </div>
                <p className="font-pulse text-[0.75rem] text-pulse-dim mb-3">
                    Your week-{week} weight carries over as a starting point.
                </p>

                {captureReason && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {SWAP_REASONS.map((r) => {
                            const active = reason === r;
                            return (
                                <button
                                    key={r}
                                    onClick={() => setReason(active ? null : r)}
                                    className={`font-pulse text-[0.75rem] rounded-full px-3 py-1 border-none cursor-pointer ${
                                        active
                                            ? 'bg-pulse-accent/15 text-pulse-accent'
                                            : 'bg-pulse-bg text-pulse-dim ring-1 ring-pulse-border'
                                    }`}>
                                    {REASON_LABELS[r]}
                                </button>
                            );
                        })}
                    </div>
                )}

                {isSwapped && (
                    <button
                        onClick={onRevert}
                        className="font-pulse text-sm font-semibold text-pulse-accent bg-pulse-accent/10 rounded-lg px-3 py-2.5 mb-3 border-none cursor-pointer text-left">
                        Revert to {originalName}
                    </button>
                )}

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search alternatives…"
                    className="w-full bg-pulse-bg border border-pulse-border rounded-lg text-pulse-text font-pulse text-sm px-3 py-2 mb-3 outline-none focus:border-pulse-accent/50"
                />

                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
                    {filtered.length === 0 ? (
                        <p className="font-pulse text-sm text-pulse-muted py-6 text-center">
                            No alternatives available.
                        </p>
                    ) : (
                        <>
                            {suggested.length > 0 && (
                                <>
                                    <div className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim">
                                        Suggested · {reasonContext(reason, hasJointSignal)}
                                    </div>
                                    {suggested.map((e) => candidateButton(e, true))}
                                </>
                            )}
                            {rest.length > 0 && (
                                <>
                                    {!searching && (
                                        <div className="font-pulse text-[0.6875rem] tracking-[0.06em] uppercase text-pulse-dim mt-1.5">
                                            All alternatives
                                        </div>
                                    )}
                                    {rest.map((e) => candidateButton(e, false))}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
