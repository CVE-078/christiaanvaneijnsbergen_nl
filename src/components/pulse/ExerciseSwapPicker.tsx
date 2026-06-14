'use client';
import { useState } from 'react';
import ModalSheet from '@/components/pulse/ModalSheet';
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
                className="cursor-pointer rounded-lg border-none bg-pulse-bg px-3.5 py-3 text-left hover:bg-pulse-surface-2">
                <div className="font-pulse text-[0.9375rem] font-medium text-pulse-text">{e.name}</div>
                <div className="mt-0.5 font-pulse text-[0.6875rem] uppercase tracking-[0.04em] text-pulse-muted">
                    {why ?? WORKOUT_TYPE_LABELS[e.category as keyof typeof WORKOUT_TYPE_LABELS] ?? e.category}
                </div>
            </button>
        );
    };

    return (
        <ModalSheet
            open
            onClose={onClose}
            title={`Swap ${originalName}`}
            subtitle={`Your week-${week} weight carries over as a starting point.`}>
            <div className="flex flex-col gap-3 px-6">
                {captureReason && (
                    <div className="flex flex-wrap gap-1.5">
                        {SWAP_REASONS.map((r) => {
                            const active = reason === r;
                            return (
                                <button
                                    key={r}
                                    onClick={() => setReason(active ? null : r)}
                                    className={`cursor-pointer rounded-full border-none px-3 py-1 font-pulse text-[0.75rem] ${
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
                        className="cursor-pointer rounded-lg border-none bg-pulse-accent/10 px-3 py-2.5 text-left font-pulse text-sm font-semibold text-pulse-accent">
                        Revert to {originalName}
                    </button>
                )}

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search alternatives…"
                    className="w-full rounded-lg border border-pulse-border bg-pulse-bg px-3 py-2 font-pulse text-sm text-pulse-text outline-none focus:border-pulse-accent/50"
                />

                <div className="flex flex-col gap-1.5">
                    {filtered.length === 0 ? (
                        <p className="py-6 text-center font-pulse text-sm text-pulse-muted">
                            No alternatives available.
                        </p>
                    ) : (
                        <>
                            {suggested.length > 0 && (
                                <>
                                    <div className="font-pulse text-[0.6875rem] uppercase tracking-[0.06em] text-pulse-dim">
                                        Suggested · {reasonContext(reason, hasJointSignal)}
                                    </div>
                                    {suggested.map((e) => candidateButton(e, true))}
                                </>
                            )}
                            {rest.length > 0 && (
                                <>
                                    {!searching && (
                                        <div className="mt-1.5 font-pulse text-[0.6875rem] uppercase tracking-[0.06em] text-pulse-dim">
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
        </ModalSheet>
    );
}
