'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import TabButton from './TabButton';
import type { WorkoutType } from '@/lib/pulse/types';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByType } = usePulse();
    const today = new Date().getDay();
    const scheduleMap = Object.fromEntries(
        activeSchedule.map((e) => [e.day_of_week, e.workout_type])
    ) as Partial<Record<number, WorkoutType>>;

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3 overflow-x-auto [scrollbar-width:none]">
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
                            className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl border shrink-0 border-pulse-border bg-transparent text-pulse-muted opacity-40 cursor-default">
                            <span className="font-pulse text-sm font-semibold">{DAY_NAMES[dow]}</span>
                            <span className="font-pulse text-[0.625rem] tracking-[0.04em] text-pulse-muted">Rest</span>
                        </button>
                    );
                }

                return (
                    <TabButton
                        key={dow}
                        id={`tab-day-${dow}`}
                        active={active}
                        controls={`panel-${workoutType}`}
                        onClick={() => setActiveDay(dow)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl shrink-0">
                        <span className="font-pulse text-sm font-semibold">{DAY_NAMES[dow]}</span>
                        <span className={`font-pulse text-[0.625rem] tracking-[0.04em] ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                            {WORKOUT_TYPE_LABELS[workoutType!]}
                        </span>
                        {isToday && (
                            <span aria-label="today" className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulse-accent" />
                        )}
                    </TabButton>
                );
            })}
        </div>
    );
}
