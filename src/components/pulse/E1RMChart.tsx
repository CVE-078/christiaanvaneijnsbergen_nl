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
            <div className="h-[150px] flex items-center justify-center">
                <span className="font-pulse text-[0.75rem] text-pulse-dim">
                    Log at least two sessions to see progression.
                </span>
            </div>
        );
    }

    const PL = 34,
        PR = 14,
        PT = 22,
        PB = 24;
    const VW = 420,
        VH = 150;
    const W = VW - PL - PR; // 372
    const H = VH - PT - PB; // 104

    const e1rms = history.map((p) => p.e1rm);
    const minE = Math.min(...e1rms);
    const maxE = Math.max(...e1rms);
    const eRange = maxE - minE || 1;

    const minWeek = history[0].week;
    const maxWeek = history[history.length - 1].week;
    const weekRange = maxWeek - minWeek || 1;

    const px = (week: number) => PL + ((week - minWeek) / weekRange) * W;
    const py = (e1rm: number) => PT + H - ((e1rm - minE) / eRange) * H;

    const points = history.map((p) => `${px(p.week).toFixed(1)},${py(p.e1rm).toFixed(1)}`).join(' ');

    // The most recent session is the "now" point, drawn solid with its value.
    const lastPoint = history[history.length - 1];
    const yTicks = [minE, (minE + maxE) / 2, maxE];

    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {/* Baseline grid */}
            <line x1={PL} y1={PT + H} x2={PL + W} y2={PT + H} stroke="var(--color-pulse-surface-2)" strokeWidth={1} />

            {/* Y-axis ticks */}
            {yTicks.map((v, i) => (
                <text
                    key={i}
                    x={PL - 6}
                    y={py(v) + 3}
                    textAnchor="end"
                    fontSize="10"
                    letterSpacing="0.04em"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-muted)">
                    {Math.round(toDisplay(v, unit))}
                </text>
            ))}

            {/* Line */}
            <polyline
                points={points}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Hollow data points for every session except the latest */}
            {history.slice(0, -1).map((p) => (
                <circle
                    key={p.week}
                    cx={px(p.week)}
                    cy={py(p.e1rm)}
                    r={3}
                    fill="var(--color-pulse-bg)"
                    stroke="var(--color-pulse-accent)"
                    strokeWidth={2}
                />
            ))}

            {/* Current (latest) point - solid accent */}
            <circle cx={px(lastPoint.week)} cy={py(lastPoint.e1rm)} r={4.5} fill="var(--color-pulse-accent)" />
            <text
                x={px(lastPoint.week)}
                y={py(lastPoint.e1rm) - 11}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-pulse)"
                fill="var(--color-pulse-accent)">
                {Math.round(toDisplay(lastPoint.e1rm, unit))} {unit}
            </text>

            {/* X-axis labels */}
            {history.map((p, i) => (
                <text
                    key={p.week}
                    x={px(p.week)}
                    y={VH - 6}
                    textAnchor="middle"
                    fontSize="10"
                    letterSpacing="0.04em"
                    fontFamily="var(--font-pulse)"
                    fill="var(--color-pulse-muted)">
                    {i === history.length - 1 ? 'Now' : `W${p.week}`}
                </text>
            ))}

            {/* Enlarged transparent hit areas so each point is easy to hover; the
                native tooltip surfaces the week and e1RM. */}
            {history.map((p, i) => (
                <circle key={`hit-${p.week}`} cx={px(p.week)} cy={py(p.e1rm)} r={11} fill="transparent" style={{ cursor: 'pointer' }}>
                    <title>{`${i === history.length - 1 ? 'Now' : `Week ${p.week}`}: ${Math.round(toDisplay(p.e1rm, unit))} ${unit} e1RM`}</title>
                </circle>
            ))}
        </svg>
    );
}
