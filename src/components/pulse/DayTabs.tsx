'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import type { WorkoutType } from '@/lib/pulse/types';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

// Progress ring for a training day: outline when nothing is logged, a filled arc
// while in progress, a solid check when the whole day is done. Colours flip on the
// selected (accent) tile so the ring keeps contrast on either background. The hole
// and arc keep the accent as a CSS var so a custom accent theme still applies.
function DayRing({ active, done, total }: { active: boolean; done: number; total: number }) {
    if (total > 0 && done >= total) {
        return (
            <span
                className={`grid h-[22px] w-[22px] place-items-center rounded-full ${active ? 'bg-pulse-bg' : 'bg-pulse-accent'}`}>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-3 w-3 ${active ? 'text-pulse-accent' : 'text-pulse-bg'}`}
                    aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                </svg>
            </span>
        );
    }
    if (done > 0) {
        const pct = Math.round((done / total) * 100);
        const arc = active ? 'var(--color-pulse-bg)' : 'var(--color-pulse-accent)';
        const track = active ? 'rgba(14,17,19,0.3)' : 'var(--color-pulse-surface)';
        const hole = active ? 'var(--color-pulse-accent)' : 'var(--color-pulse-surface-2)';
        return (
            <span
                className="grid h-[22px] w-[22px] place-items-center rounded-full"
                style={{ background: `conic-gradient(${arc} ${pct}%, ${track} 0)` }}>
                <span className="h-[13px] w-[13px] rounded-full" style={{ background: hole }} />
            </span>
        );
    }
    return (
        <span
            className={`h-[22px] w-[22px] rounded-full border-2 ${active ? 'border-pulse-bg/40' : 'border-pulse-border'}`}
        />
    );
}

export default function DayTabs() {
    const {
        activeDay,
        setActiveDay,
        activeSchedule,
        activeWeek,
        currentWeek,
        logs,
        routineExercisesByTabKey,
        resolveTabForEntry,
    } = usePulse();
    const today = new Date().getDay();
    const scheduleByDay = Object.fromEntries(activeSchedule.map((e) => [e.day_of_week, e]));

    // One pass over the week so both the summary line and the strip read the same
    // per-day completion. Count against the variant-aware session the panel shows
    // for the day (an A/B split counts each day's 6, not the merged 12).
    const days = WEEK_ORDER.map((dow) => {
        const entry = scheduleByDay[dow];
        const isTraining = entry !== undefined;
        const exercises = isTraining ? (routineExercisesByTabKey[resolveTabForEntry(entry)] ?? []) : [];
        const done = exercises.filter((re) => {
            const maxSets = parseMaxSets(re.sets);
            return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every((k) => logs[k]?.saved);
        }).length;
        return {
            dow,
            isTraining,
            workoutType: entry?.workout_type as WorkoutType | undefined,
            done,
            total: exercises.length,
        };
    });

    // The summary line describes the selected day, so the verbose focus + count
    // lives in one place instead of being crammed into every tile.
    const selected = days.find((d) => d.dow === activeDay && d.isTraining);

    return (
        <div>
            {selected && (
                <div className="mb-2.5 flex items-center gap-2 font-pulse-body text-[0.75rem]">
                    <span className="font-pulse font-bold uppercase tracking-[0.04em] text-pulse-accent">
                        {DAY_NAMES[selected.dow]}
                    </span>
                    <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-pulse-muted" />
                    <span className="font-semibold text-pulse-text">{WORKOUT_TYPE_LABELS[selected.workoutType!]}</span>
                    {selected.total > 0 && (
                        <span className="ml-auto tabular-nums text-pulse-dim">
                            <span className={selected.done >= selected.total ? 'font-semibold text-pulse-success' : ''}>
                                {selected.done}
                            </span>{' '}
                            / {selected.total} done
                        </span>
                    )}
                </div>
            )}
            <div role="tablist" className="grid grid-cols-7 gap-1.5">
                {days.map(({ dow, isTraining, workoutType, done, total }) => {
                    const active = activeDay === dow && isTraining;
                    // Only mark "today" on the day that is actually today in the week the
                    // program is currently on, not on every matching weekday of every week.
                    const isToday = activeWeek === currentWeek && dow === today;

                    if (!isTraining) {
                        return (
                            <button
                                key={dow}
                                role="tab"
                                id={`tab-day-${dow}`}
                                aria-selected={false}
                                aria-label={`${DAY_NAMES[dow]}, rest day`}
                                disabled
                                className="flex cursor-default flex-col items-center gap-[7px] rounded-[13px] bg-transparent px-1 py-2.5 opacity-55">
                                <span className="font-pulse text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-pulse-muted">
                                    {DAY_NAMES[dow]}
                                </span>
                                <span className="grid h-[22px] w-[22px] place-items-center">
                                    <span className="h-[2px] w-3 rounded-full bg-pulse-border" />
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
                            aria-label={`${DAY_NAMES[dow]}, ${WORKOUT_TYPE_LABELS[workoutType!]}${
                                total > 0 ? `, ${done} of ${total} done` : ''
                            }`}
                            onClick={() => setActiveDay(dow)}
                            className={`relative flex cursor-pointer flex-col items-center gap-[7px] rounded-[13px] border border-transparent px-1 py-2.5 transition-colors duration-200 ${
                                active ? 'bg-pulse-accent' : 'bg-pulse-surface-2 hover:border-pulse-border'
                            }`}>
                            {isToday && !active && (
                                <span
                                    aria-label="today"
                                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-pulse-accent"
                                />
                            )}
                            <span
                                className={`font-pulse text-[0.6875rem] font-bold uppercase tracking-[0.06em] ${
                                    active ? 'text-pulse-bg' : 'text-pulse-dim'
                                }`}>
                                {DAY_NAMES[dow]}
                            </span>
                            <DayRing active={active} done={done} total={total} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
