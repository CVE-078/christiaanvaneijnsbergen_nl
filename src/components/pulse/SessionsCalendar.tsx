'use client';
import { useMemo } from 'react';
import { sessionsByDay, buildMonthCells } from '@/lib/pulse/sessions';
import { localDateKey } from '@/lib/pulse/dates';
import type { WorkoutSession } from '@/lib/pulse/types';

// Monday-start day-of-week header labels.
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

interface Props {
    year: number;
    /** 0-based month index (0 = January, 5 = June). */
    month: number;
    sessions: WorkoutSession[];
    tz: string;
    /**
     * Called when the user clicks a day cell that has at least one session.
     * Receives the first session recorded on that day (by completed_at order).
     */
    onSelectDay: (session: WorkoutSession) => void;
}

export default function SessionsCalendar({ year, month, sessions, tz, onSelectDay }: Props) {
    const dayMap = useMemo(() => sessionsByDay(sessions, tz), [sessions, tz]);
    const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
    // Today as YYYY-MM-DD in the user's timezone (matches the session day keys),
    // so the "today" ring lands on the correct cell for non-UTC users.
    const today = localDateKey(new Date().toISOString(), tz);

    return (
        // 7-col grid: DOW headers + day cells.
        <div className="grid grid-cols-7 gap-[5px]">
            {/* Day-of-week headers */}
            {DOW_LABELS.map((d) => (
                <div
                    key={d}
                    className="text-center font-pulse text-[0.58rem] uppercase tracking-[0.05em] text-pulse-muted pb-[2px]">
                    {d}
                </div>
            ))}

            {/* Day cells */}
            {cells.map((cell, i) => {
                if (cell.day === 0) {
                    // Leading blank
                    return <div key={`blank-${i}`} />;
                }

                const sessionsOnDay = dayMap.get(cell.dateKey);
                const isDone = !!sessionsOnDay && sessionsOnDay.length > 0;
                const isToday = cell.dateKey === today;

                if (!isDone) {
                    return (
                        <div
                            key={cell.dateKey}
                            className={`aspect-square rounded-lg flex items-center justify-center font-pulse text-[0.72rem] text-pulse-dim bg-pulse-surface-2${isToday ? ' outline outline-[1.5px] outline-pulse-accent' : ''}`}>
                            {cell.day}
                        </div>
                    );
                }

                return (
                    <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => onSelectDay(sessionsOnDay[0])}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center font-pulse text-[0.72rem] font-semibold text-pulse-text cursor-pointer border-none relative bg-[color-mix(in_srgb,var(--color-pulse-accent)_20%,var(--color-pulse-surface))]${isToday ? ' outline outline-[1.5px] outline-pulse-accent' : ''}`}>
                        {cell.day}
                        {/* Accent dot */}
                        <span className="absolute bottom-[4px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-pulse-accent" />
                    </button>
                );
            })}
        </div>
    );
}
