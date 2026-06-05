'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByTabKey, resolveTabForEntry } =
        usePulse();
    const today = new Date().getDay();
    const scheduleByDay = Object.fromEntries(activeSchedule.map((e) => [e.day_of_week, e]));

    return (
        <div role="tablist" className="grid grid-cols-7 gap-1.5">
            {WEEK_ORDER.map((dow) => {
                const entry = scheduleByDay[dow];
                const isTraining = entry !== undefined;
                const workoutType = entry?.workout_type;
                const active = activeDay === dow && isTraining;
                const isToday = dow === today;

                // Count against the variant-aware session the panel actually shows
                // for this day, so an A/B split counts each day's session (e.g. 6)
                // rather than the merged workout-type total (e.g. 12).
                const exercises = isTraining ? (routineExercisesByTabKey[resolveTabForEntry(entry)] ?? []) : [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                if (!isTraining) {
                    return (
                        <button
                            key={dow}
                            role="tab"
                            id={`tab-day-${dow}`}
                            aria-selected={false}
                            disabled
                            className="flex cursor-default flex-col items-center gap-1.5 rounded-2xl border border-dashed border-pulse-border bg-transparent px-1 py-3 text-pulse-muted opacity-55">
                            <span className="font-pulse-display text-[0.9375rem] font-bold uppercase tracking-[0.06em]">
                                {DAY_NAMES[dow]}
                            </span>
                            <span className="font-pulse-body text-[0.6875rem] tracking-[0.04em] text-pulse-muted">
                                Rest
                            </span>
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
                        className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition-colors duration-200 ${
                            active
                                ? 'border-transparent bg-pulse-accent text-pulse-bg'
                                : 'border-transparent bg-pulse-surface-2 text-pulse-dim hover:border-pulse-border'
                        }`}>
                        <span
                            className={`font-pulse-display text-[0.9375rem] font-bold uppercase tracking-[0.06em] ${
                                active ? 'text-pulse-bg' : 'text-pulse-dim'
                            }`}>
                            {DAY_NAMES[dow]}
                        </span>
                        <span
                            className={`font-pulse-body text-[0.6875rem] tracking-[0.04em] ${
                                active ? 'text-pulse-bg/70' : 'text-pulse-muted'
                            }`}>
                            {WORKOUT_TYPE_LABELS[workoutType!]}
                        </span>
                        {total > 0 && (
                            <>
                                <span
                                    className={`mt-0.5 h-[3px] w-6 overflow-hidden rounded-full ${
                                        active ? 'bg-pulse-bg/25' : 'bg-pulse-surface'
                                    }`}>
                                    <span
                                        className={`block h-full rounded-full ${active ? 'bg-pulse-bg' : 'bg-pulse-accent'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </span>
                                <span
                                    className={`font-pulse-body text-[0.75rem] font-semibold tabular-nums ${
                                        active ? 'text-pulse-bg/80' : 'text-pulse-dim'
                                    }`}>
                                    {done}/{total}
                                </span>
                            </>
                        )}
                        {isToday && !active && (
                            <span
                                aria-label="today"
                                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pulse-accent"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
