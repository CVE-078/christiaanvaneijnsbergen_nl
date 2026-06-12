'use client';
import ModalSheet from './ModalSheet';
import { computeE1RMHistory, computeBestSets, toDisplay } from '@/lib/pulse/utils';
import { exerciseSetsByWeek } from '@/lib/pulse/workouts';
import E1RMChart from '@/components/pulse/E1RMChart';
import type { Logs, Unit } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    routineExerciseId: string;
    name: string;
    logs: Logs;
    unit: Unit;
    onClose: () => void;
    /** When set, a back chevron returns to the list this was opened from. */
    onBack?: () => void;
}

export default function ExerciseDetailModal({
    open,
    routineExerciseId,
    name,
    logs,
    unit,
    onClose,
    onBack,
}: Props) {
    if (!open) return null;

    const history = computeE1RMHistory(logs, routineExerciseId);
    const best = computeBestSets(logs)[routineExerciseId] ?? null;
    const weeklyHistory = exerciseSetsByWeek(logs, routineExerciseId);
    const totalSets = weeklyHistory.reduce((n, w) => n + w.sets.length, 0);

    const prLine = best
        ? `PR ${toDisplay(best.e1rm, unit).toFixed(0)} ${unit} e1RM · best set ${toDisplay(best.kg, unit)} ${unit} × ${best.reps}`
        : null;

    return (
        <ModalSheet open={open} onClose={onClose} onBack={onBack} title={name} subtitle={prLine ?? undefined}>
            {/* e1RM chart */}
            <div className="px-6 pb-3">
                <E1RMChart history={history} unit={unit} />
            </div>

            {/* Per-week history */}
            <div className="flex-1 overflow-y-auto px-6 pb-1">
                {weeklyHistory.length === 0 ? (
                    <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No sets logged yet.</p>
                ) : (
                    <>
                        <div className="mb-3 flex items-baseline justify-between pt-1">
                            <span className="font-pulse text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-pulse-muted">
                                History
                            </span>
                            <span className="font-pulse text-[0.6875rem] text-pulse-muted">
                                {totalSets} {totalSets === 1 ? 'set' : 'sets'}
                            </span>
                        </div>
                        {weeklyHistory.map(({ week, sets }) => (
                            <div key={week} className="mb-4">
                                <div className="font-pulse text-[0.75rem] font-medium text-pulse-dim mb-[6px]">
                                    Week {week}
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    {sets.map((set, idx) => (
                                        <div key={idx} className="flex items-center gap-3 pl-1">
                                            <span className="font-pulse text-[0.72rem] text-pulse-muted w-12 shrink-0">
                                                Set {idx + 1}
                                            </span>
                                            <span className="font-pulse text-[0.87rem] text-pulse-text flex-1">
                                                {toDisplay(set.kg, unit)} {unit} &times; {set.reps}
                                            </span>
                                            <span className="font-pulse text-[0.75rem] text-pulse-muted shrink-0">
                                                {set.rir} RIR
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </ModalSheet>
    );
}
