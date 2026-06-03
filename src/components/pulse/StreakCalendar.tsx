'use client';
import { useMemo } from 'react';
import { computeWeeksWithData } from '@/lib/pulse/utils';
import type { Logs } from '@/lib/pulse/types';

interface StreakCalendarProps {
    logs: Logs;
    // The week currently being trained, highlighted with an accent ring.
    currentWeek?: number;
}

export default function StreakCalendar({ logs, currentWeek }: StreakCalendarProps) {
    const weeksWithData = useMemo(() => computeWeeksWithData(logs), [logs]);
    return (
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const filled = weeksWithData.has(week);
                const isNow = week === currentWeek;
                let cellClass: string;
                if (isNow) {
                    cellClass = 'bg-pulse-surface ring-2 ring-pulse-accent ring-offset-2 ring-offset-pulse-bg';
                } else if (filled) {
                    cellClass = 'bg-pulse-accent';
                } else {
                    cellClass = 'bg-pulse-surface-2';
                }
                return (
                    <div key={week} className="flex flex-col items-center gap-[7px]">
                        <span className={`block w-[22px] h-[22px] rounded-[7px] ${cellClass}`} />
                        <span className="font-pulse text-[0.625rem] tracking-[0.04em] text-pulse-muted">{week}</span>
                    </div>
                );
            })}
        </div>
    );
}
