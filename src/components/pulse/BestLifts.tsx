'use client';
import { useEffect, useState } from 'react';
import { WORKOUT_TYPE_ORDER, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { toDisplay } from '@/lib/pulse/utils';
import type { RoutineExercise, BestSet, Unit } from '@/lib/pulse/types';

// Collapsed view shows the top lifts per group; the rest are behind a modal.
const PER_GROUP_CAP = 2;

interface BestLiftsProps {
    allRoutineExercises: RoutineExercise[];
    bestSets: Record<string, BestSet>;
    unit: Unit;
    onSelectExercise?: (routineExerciseId: string) => void;
}

// Inline lift row used in both the collapsed view and the "all lifts" modal.
// When onClick is provided, the row renders as a tappable button.
function LiftRow({
    name,
    best,
    unit,
    accent,
    onClick,
}: {
    name: string;
    best: BestSet;
    unit: Unit;
    accent: boolean;
    onClick?: () => void;
}) {
    const inner = (
        <>
            <div className="flex flex-col min-w-0">
                <span className="text-pulse-text text-[0.9rem] overflow-hidden text-ellipsis whitespace-nowrap">
                    {name}
                </span>
                <span className="font-pulse-body text-[0.75rem] text-pulse-muted mt-[1px]">
                    {toDisplay(best.kg, unit)} {unit} × {best.reps}
                </span>
            </div>
            <span className={`font-pulse text-base font-medium shrink-0 ${accent ? 'text-pulse-accent' : 'text-pulse-dim'}`}>
                {toDisplay(best.e1rm, unit).toFixed(0)}
                <span className="font-pulse-body text-[0.6875rem] ml-[3px] opacity-60">
                    {unit} e1RM
                </span>
            </span>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="flex items-center justify-between gap-3 py-[13px] border-b border-pulse-border last:border-0 w-full text-left bg-transparent border-x-0 border-t-0 cursor-pointer hover:opacity-80 transition-opacity">
                {inner}
            </button>
        );
    }

    return (
        <div className="flex items-center justify-between gap-3 py-[13px] border-b border-pulse-border last:border-0">
            {inner}
        </div>
    );
}

// "All best lifts" modal: bottom-sheet on mobile, centered on desktop.
function AllLiftsModal({
    open,
    onClose,
    grouped,
    unit,
    onSelectExercise,
}: {
    open: boolean;
    onClose: () => void;
    grouped: { type: string; items: { re: RoutineExercise; best: BestSet }[] }[];
    unit: Unit;
    onSelectExercise?: (routineExerciseId: string) => void;
}) {
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
            aria-label="All best lifts"
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-5 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, visible on mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-center justify-between px-[18px] pt-3 pb-3">
                    <span className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight">
                        Best Lifts
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        &#x2715;
                    </button>
                </div>

                {/* Grouped lift list */}
                <div className="overflow-y-auto px-[18px] pb-1 flex-1">
                    {grouped.map(({ type, items }) => (
                        <div key={type} className="mb-4">
                            <div className="sticky top-0 z-10 bg-pulse-surface pt-3 pb-2 font-pulse text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                                {WORKOUT_TYPE_LABELS[type as keyof typeof WORKOUT_TYPE_LABELS]}
                            </div>
                            <div className="flex flex-col">
                                {items.map(({ re, best }, idx) => (
                                    <LiftRow
                                        key={re.id}
                                        name={re.exercise.name}
                                        best={best}
                                        unit={unit}
                                        accent={idx === 0}
                                        onClick={
                                            onSelectExercise
                                                ? () => { onClose(); onSelectExercise(re.id); }
                                                : undefined
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function BestLifts({ allRoutineExercises, bestSets, unit, onSelectExercise }: BestLiftsProps) {
    const [modalOpen, setModalOpen] = useState(false);

    const entries = allRoutineExercises
        .filter((re) => bestSets[re.id])
        .map((re) => ({ re, best: bestSets[re.id] }))
        .sort((a, b) => b.best.e1rm - a.best.e1rm);

    if (entries.length === 0) {
        return <p className="font-pulse text-[0.75rem] text-pulse-dim py-2">No sets logged yet.</p>;
    }

    const grouped = WORKOUT_TYPE_ORDER.map((type) => ({
        type,
        items: entries.filter((e) => e.re.workout_type === type),
    })).filter((g) => g.items.length > 0);

    // Show the "Show all" button only when collapsing actually hides lifts.
    const collapsedCount = grouped.reduce((n, g) => n + Math.min(PER_GROUP_CAP, g.items.length), 0);
    const hasMore = entries.length > collapsedCount;

    return (
        <div className="flex flex-col gap-5">
            {grouped.map(({ type, items }) => {
                const visible = items.slice(0, PER_GROUP_CAP);
                return (
                    <div key={type}>
                        <div className="font-pulse text-[0.6875rem] tracking-[0.16em] uppercase text-pulse-muted mb-2">
                            {WORKOUT_TYPE_LABELS[type as keyof typeof WORKOUT_TYPE_LABELS]}
                        </div>
                        <div className="flex flex-col">
                            {visible.map(({ re, best }, idx) => (
                                <LiftRow
                                    key={re.id}
                                    name={re.exercise.name}
                                    best={best}
                                    unit={unit}
                                    accent={idx === 0}
                                    onClick={onSelectExercise ? () => onSelectExercise(re.id) : undefined}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {hasMore && (
                <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="w-full flex items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                    Show all {entries.length} lifts
                    <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden>
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}

            <AllLiftsModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                grouped={grouped}
                unit={unit}
                onSelectExercise={onSelectExercise}
            />
        </div>
    );
}
