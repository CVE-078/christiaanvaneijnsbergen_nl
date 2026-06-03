'use client';
import { WORKOUT_TYPE_ORDER, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import { toDisplay } from '@/lib/pulse/utils';
import type { RoutineExercise, BestSet, Unit } from '@/lib/pulse/types';

interface BestLiftsProps {
    allRoutineExercises: RoutineExercise[];
    bestSets: Record<string, BestSet>;
    unit: Unit;
}

export default function BestLifts({ allRoutineExercises, bestSets, unit }: BestLiftsProps) {
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

    return (
        <div className="flex flex-col gap-5">
            {grouped.map(({ type, items }) => (
                <div key={type}>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.16em] uppercase text-pulse-muted mb-2">
                        {WORKOUT_TYPE_LABELS[type]}
                    </div>
                    <div className="flex flex-col">
                        {items.map(({ re, best }, idx) => (
                            <div
                                key={re.id}
                                className="flex items-baseline justify-between gap-3 py-[13px] border-b border-pulse-border last:border-0">
                                <span className="text-pulse-text text-[0.9rem] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {re.exercise.name}
                                </span>
                                <span
                                    className={`font-pulse text-base font-medium shrink-0 ${
                                        idx === 0 ? 'text-pulse-accent' : 'text-pulse-text'
                                    }`}>
                                    {toDisplay(best.kg, unit)}
                                    <span className="font-pulse-body text-[0.75rem] text-pulse-muted ml-[3px]">
                                        {unit} × {best.reps}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
