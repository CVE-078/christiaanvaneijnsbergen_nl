'use client';
import { useState } from 'react';
import { WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { DbExercise } from '@/lib/pulse/types';

interface Props {
    originalName: string;
    week: number;
    candidates: DbExercise[];
    isSwapped: boolean;
    onSelect: (exerciseId: string) => void;
    onRevert: () => void;
    onClose: () => void;
}

export default function ExerciseSwapPicker({
    originalName,
    week,
    candidates,
    isSwapped,
    onSelect,
    onRevert,
    onClose,
}: Props) {
    const [query, setQuery] = useState('');
    const filtered = query.trim()
        ? candidates.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
        : candidates;

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
                        filtered.map((e) => (
                            <button
                                key={e.id}
                                onClick={() => onSelect(e.id)}
                                className="text-left bg-pulse-bg rounded-lg px-3.5 py-3 border-none cursor-pointer hover:bg-pulse-surface-2">
                                <div className="font-pulse text-[0.9375rem] font-medium text-pulse-text">{e.name}</div>
                                <div className="font-pulse text-[0.6875rem] tracking-[0.04em] uppercase text-pulse-muted mt-0.5">
                                    {WORKOUT_TYPE_LABELS[e.category as keyof typeof WORKOUT_TYPE_LABELS] ?? e.category}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
