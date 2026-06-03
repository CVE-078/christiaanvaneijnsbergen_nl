'use client';
import { toDisplay } from '@/lib/pulse/utils';
import type { Unit } from '@/lib/pulse/types';

interface E1RMChartProps {
    history: Array<{ week: number; e1rm: number }>;
    unit: Unit;
}

export default function E1RMChart({ history, unit }: E1RMChartProps) {
    if (history.length < 2) {
        return (
            <div className="h-20 flex items-center justify-center">
                <span className="font-pulse text-[0.75rem] text-pulse-dim">
                    Log at least two sessions to see progression.
                </span>
            </div>
        );
    }

    const PL = 34,
        PR = 8,
        PT = 10,
        PB = 16;
    const VW = 300,
        VH = 80;
    const W = VW - PL - PR; // 258
    const H = VH - PT - PB; // 54

    const e1rms = history.map((p) => p.e1rm);
    const minE = Math.min(...e1rms);
    const maxE = Math.max(...e1rms);
    const eRange = maxE - minE || 1;

    const minWeek = history[0].week;
    const maxWeek = history[history.length - 1].week;
    const weekRange = maxWeek - minWeek || 1;

    const px = (week: number) => PL + ((week - minWeek) / weekRange) * W;
    const py = (e1rm: number) => PT + H - ((e1rm - minE) / eRange) * H;

    const pathD = history
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.week).toFixed(1)} ${py(p.e1rm).toFixed(1)}`)
        .join(' ');

    const prPoint = history.reduce((a, b) => (a.e1rm >= b.e1rm ? a : b));
    const yTicks = [minE, (minE + maxE) / 2, maxE];

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-20" aria-hidden="true">
            <defs>
                <linearGradient id="e1rm-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pulse-accent)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="var(--color-pulse-accent)" stopOpacity={0} />
                </linearGradient>
            </defs>

            {/* Y-axis ticks */}
            {yTicks.map((v, i) => (
                <text
                    key={i}
                    x={PL - 3}
                    y={py(v) + 3}
                    textAnchor="end"
                    fontSize="8"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-dim)">
                    {Math.round(toDisplay(v, unit))}
                </text>
            ))}

            {/* Area fill */}
            <path
                d={`${pathD} L ${px(maxWeek).toFixed(1)} ${(PT + H).toFixed(1)} L ${px(minWeek).toFixed(1)} ${(PT + H).toFixed(1)} Z`}
                fill="url(#e1rm-grad)"
            />

            {/* Line */}
            <path
                d={pathD}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Data dots */}
            {history.map((p) => (
                <circle key={p.week} cx={px(p.week)} cy={py(p.e1rm)} r={2.5} fill="var(--color-pulse-accent)" />
            ))}

            {/* PR ring */}
            <circle
                cx={px(prPoint.week)}
                cy={py(prPoint.e1rm)}
                r={5}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
            />
        </svg>
    );
}
