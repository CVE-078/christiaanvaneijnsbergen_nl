'use client';
import type { WorkoutType } from '@/lib/pulse/types';

interface VolumeChartProps {
    volByWeek: Record<number, Partial<Record<WorkoutType, number>>>;
    // The week currently being trained, drawn in the accent colour.
    currentWeek?: number;
}

// Calm, single-bar-per-week volume chart. Bars carry total sets for the week.
// Only the current week (or, if none given, the peak week) is drawn in the
// accent colour; every other bar is a muted surface tone so the accent reads
// as the single point of emphasis.
export default function VolumeChart({ volByWeek, currentWeek }: VolumeChartProps) {
    const PL = 14,
        PT = 18,
        PB = 22;
    const VW = 420,
        VH = 150;
    const H = VH - PT - PB; // 110
    const slotW = 44;
    const barW = 22;

    const weekTotals = Array.from({ length: 12 }, (_, i) =>
        Object.values(volByWeek[i + 1] ?? {}).reduce((a, b) => a + b, 0),
    );
    const maxSets = Math.max(1, ...weekTotals);
    const peakWeek = weekTotals.indexOf(Math.max(...weekTotals)) + 1;
    const accentWeek = currentWeek ?? peakWeek;

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => {
                const week = i + 1;
                const total = weekTotals[i];
                if (total === 0) return null;
                const h = (total / maxSets) * H;
                const x = PL + i * slotW;
                const y = PT + H - h;
                const isAccent = week === accentWeek;
                const fill = isAccent ? 'var(--color-pulse-accent)' : 'var(--color-pulse-border)';
                return (
                    <g key={week}>
                        <rect x={x} y={y} width={barW} height={h} rx={4} fill={fill} />
                        <text
                            x={x + barW / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fontSize="11"
                            fontFamily="var(--font-pulse)"
                            fill={isAccent ? 'var(--color-pulse-accent)' : 'var(--color-pulse-dim)'}>
                            {total}
                        </text>
                    </g>
                );
            })}

            {/* X-axis labels - every 2 weeks */}
            {[1, 3, 5, 7, 9, 11].map((w) => (
                <text
                    key={w}
                    x={PL + (w - 1) * slotW + barW / 2}
                    y={VH - 4}
                    textAnchor="middle"
                    fontSize="10"
                    letterSpacing="0.04em"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-muted)">
                    W{w}
                </text>
            ))}
        </svg>
    );
}
