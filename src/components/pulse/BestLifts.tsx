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
        <div className="flex flex-col gap-4">
            {grouped.map(({ type, items }) => (
                <div key={type}>
                    <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-dim mb-1">
                        {WORKOUT_TYPE_LABELS[type]}
                    </div>
                    <div className="flex flex-col">
                        {items.map(({ re, best }, idx) => (
                            <div
                                key={re.id}
                                className="flex items-center gap-3 py-[6px] border-b border-pulse-border last:border-0">
                                <span className="font-pulse text-[0.6875rem] text-pulse-dim w-4 shrink-0 text-right">
                                    {idx + 1}
                                </span>
                                <span className="text-pulse-text text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                    {re.exercise.name}
                                </span>
                                <span className="font-pulse text-white font-semibold text-sm shrink-0">
                                    {toDisplay(best.kg, unit)} {unit} × {best.reps}
                                </span>
                                <span className="font-pulse text-[0.6875rem] text-pulse-dim shrink-0">
                                    {Math.round(toDisplay(best.e1rm, unit))} e1RM
                                </span>
                                {idx === 0 && (
                                    <span className="font-pulse text-[0.625rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                        PR
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
