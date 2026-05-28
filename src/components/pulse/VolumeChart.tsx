'use client';
import { WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
import type { WorkoutType } from '@/lib/pulse/types';

const TYPE_COLOR: Partial<Record<WorkoutType, string>> = {
    push: '#3ecf8e', chest: '#3ecf8e', shoulders: '#3ecf8e', arms: '#3ecf8e',
    pull: '#38bdf8', back: '#38bdf8',
    legs: '#a78bfa', lower: '#a78bfa',
    upper: '#fb923c', full_body: '#fb923c',
};
const DEFAULT_COLOR = '#5e6a80';

interface VolumeChartProps {
    volByWeek: Record<number, Partial<Record<WorkoutType, number>>>;
}

export default function VolumeChart({ volByWeek }: VolumeChartProps) {
    const PL = 28, PR = 6, PT = 8, PB = 20;
    const VW = 300, VH = 68;
    const W = VW - PL - PR;   // 266
    const H = VH - PT - PB;   // 40
    const slotW = W / 12;
    const barW = 14;

    const weekTotals = Array.from({ length: 12 }, (_, i) =>
        Object.values(volByWeek[i + 1] ?? {}).reduce((a, b) => a + b, 0),
    );
    const maxSets = Math.max(1, ...weekTotals);

    function getSegments(weekData: Partial<Record<WorkoutType, number>>) {
        let bottom = PT + H;
        const segs: { type: WorkoutType; color: string; y: number; h: number }[] = [];
        for (const type of WORKOUT_TYPE_ORDER) {
            const count = weekData[type] ?? 0;
            if (count === 0) continue;
            const h = (count / maxSets) * H;
            bottom -= h;
            segs.push({ type, color: TYPE_COLOR[type] ?? DEFAULT_COLOR, y: bottom, h });
        }
        return segs;
    }

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" aria-hidden="true">
            {/* Baseline */}
            <line
                x1={PL} y1={PT + H}
                x2={PL + W} y2={PT + H}
                stroke="var(--color-pulse-border)"
                strokeWidth={1}
            />

            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const barX = PL + i * slotW + (slotW - barW) / 2;
                const segs = getSegments(volByWeek[week] ?? {});
                return (
                    <g key={week}>
                        {segs.map((s) => (
                            <rect
                                key={s.type}
                                x={barX}
                                y={s.y}
                                width={barW}
                                height={s.h}
                                fill={s.color}
                                rx={1}
                                opacity={0.85}
                            />
                        ))}
                    </g>
                );
            })}

            {/* X-axis labels — every 2 weeks */}
            {[1, 3, 5, 7, 9, 11].map((w) => (
                <text
                    key={w}
                    x={PL + (w - 1) * slotW + slotW / 2}
                    y={VH - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-dim)"
                >
                    {w}
                </text>
            ))}
        </svg>
    );
}
