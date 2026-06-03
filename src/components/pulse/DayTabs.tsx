'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType } from '@/lib/pulse/types';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByType } = usePulse();
    const today = new Date().getDay();
    const scheduleMap = Object.fromEntries(activeSchedule.map((e) => [e.day_of_week, e.workout_type])) as Partial<
        Record<number, WorkoutType>
    >;

    return (
        <div role="tablist" className="flex items-stretch gap-1.5 p-4 pb-3 overflow-x-auto [scrollbar-width:none]">
            {WEEK_ORDER.map((dow) => {
                const workoutType = scheduleMap[dow];
                const isTraining = workoutType !== undefined;
                const active = activeDay === dow && isTraining;
                const isToday = dow === today;

                const exercises = isTraining ? (routineExercisesByType[workoutType!] ?? []) : [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;

                if (!isTraining) {
                    return (
                        <button
                            key={dow}
                            role="tab"
                            id={`tab-day-${dow}`}
                            aria-selected={false}
                            disabled
                            className="flex-1 min-w-[3rem] flex flex-col items-center gap-1 py-2.5 px-1 rounded-[11px] bg-transparent text-pulse-muted opacity-55 cursor-default">
                            <span className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase">
                                {DAY_NAMES[dow]}
                            </span>
                            <span className="font-pulse text-[0.625rem] tracking-[0.04em] text-pulse-muted">Rest</span>
                        </button>
                    );
                }

                return (
                    <button
                        key={dow}
                        role="tab"
                        id={`tab-day-${dow}`}
                        aria-selected={active}
                        aria-controls={`panel-${workoutType}`}
                        onClick={() => setActiveDay(dow)}
                        className={`relative flex-1 min-w-[3rem] flex flex-col items-center gap-1 py-2.5 px-1 rounded-[11px] cursor-pointer transition-colors duration-200 ${
                            active
                                ? 'bg-pulse-accent text-pulse-bg'
                                : 'bg-transparent text-pulse-dim hover:bg-pulse-surface'
                        }`}>
                        <span className="font-pulse text-[0.6875rem] tracking-[0.08em] uppercase">
                            {DAY_NAMES[dow]}
                        </span>
                        <span
                            className={`font-pulse text-[0.625rem] tracking-[0.04em] ${
                                active ? 'text-pulse-bg' : 'text-pulse-muted'
                            }`}>
                            {WORKOUT_TYPE_LABELS[workoutType!]}
                        </span>
                        {total > 0 && (
                            <span
                                className={`font-pulse text-[0.625rem] font-semibold ${
                                    active ? 'text-pulse-bg' : 'text-pulse-dim'
                                }`}>
                                {done}/{total}
                            </span>
                        )}
                        {isToday && !active && (
                            <span
                                aria-label="today"
                                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pulse-accent"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
