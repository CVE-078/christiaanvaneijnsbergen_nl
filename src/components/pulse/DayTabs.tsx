'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByType } = usePulse();
    const today = new Date().getDay();

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3 overflow-x-auto [scrollbar-width:none]">
            {activeSchedule.map((entry) => {
                const active = activeDay === entry.day_of_week;
                const isToday = entry.day_of_week === today;
                const exercises = routineExercisesByType[entry.workout_type] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;

                return (
                    <button
                        key={entry.day_of_week}
                        role="tab"
                        id={`tab-day-${entry.day_of_week}`}
                        aria-selected={active}
                        aria-controls={`panel-${entry.workout_type}`}
                        onClick={() => setActiveDay(entry.day_of_week)}
                        className={`relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl border cursor-pointer transition-all duration-150 shrink-0 ${
                            active
                                ? 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent'
                                : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text'
                        }`}>
                        <span className="font-pulse text-sm font-semibold">{DAY_NAMES[entry.day_of_week]}</span>
                        <span className={`font-pulse text-[0.625rem] tracking-[0.04em] ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                            {WORKOUT_TYPE_LABELS[entry.workout_type]}
                        </span>
                        {total > 0 && (
                            <span className={`font-pulse text-[0.625rem] rounded-full px-1.5 py-0.5 ${
                                active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                            }`}>
                                {done}/{total}
                            </span>
                        )}
                        {isToday && (
                            <span aria-label="today" className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulse-accent" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
