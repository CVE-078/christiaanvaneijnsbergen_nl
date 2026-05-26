import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import RestTimer from './RestTimer';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
    timerTrigger: number;
}

export default function ExerciseDetailPane({
    exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete, timerTrigger,
}: Props) {
    const maxSets = parseMaxSets(exercise.sets);
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="py-5 px-6 pb-[0.875rem] border-b border-pulse-border shrink-0">
                <div className="text-white font-semibold text-[1.0625rem] mb-1 truncate">{exercise.name}</div>
                <div className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim uppercase">
                    {exercise.sets} sets · {exercise.reps} reps
                </div>
            </div>

            {/* Scrollable set list */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
                <p className="font-pulse text-[0.6875rem] text-pulse-dim pt-3 pb-1.5 leading-[1.6]">
                    {exercise.load} · {exercise.note}
                </p>
                {Array.from({ length: maxSets }, (_, i) => {
                    const key = logKey(week, type, exIdx, i);
                    const entry = logs[key];
                    const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                    const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                    return (
                        <SetLogger
                            key={`${week}-${i}`}
                            setIdx={i}
                            week={week}
                            type={type}
                            entry={entry}
                            previousEntry={prevEntry?.saved ? prevEntry : undefined}
                            isPR={isPR}
                            unit={unit}
                            onSave={(e) => onSave(key, e)}
                            onDelete={() => onDelete(key)}
                        />
                    );
                })}
            </div>

            {/* Rest timer pinned at bottom */}
            <div className="border-t border-pulse-border py-3 px-6 shrink-0">
                <RestTimer trigger={timerTrigger} />
            </div>
        </div>
    );
}
