'use client';
import { weekHasData } from '@/lib/pulse/utils';
import type { Logs } from '@/lib/pulse/types';

interface StreakCalendarProps {
    logs: Logs;
}

export default function StreakCalendar({ logs }: StreakCalendarProps) {
    return (
        <svg viewBox="0 0 300 28" className="w-full h-7" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const filled = weekHasData(week, logs);
                const cx = 16 + i * 22;
                return (
                    <g key={week}>
                        <circle
                            cx={cx}
                            cy={14}
                            r={9}
                            fill={filled ? 'var(--color-pulse-accent)' : 'var(--color-pulse-surface)'}
                            stroke={filled ? 'var(--color-pulse-accent)' : 'var(--color-pulse-border)'}
                            strokeWidth={1}
                        />
                        <text
                            x={cx}
                            y={18}
                            textAnchor="middle"
                            fontSize="7"
                            fontFamily="var(--font-pulse)"
                            fill={filled ? 'var(--color-pulse-bg)' : 'var(--color-pulse-dim)'}
                        >
                            {week}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}
