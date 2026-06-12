'use client';
import { useId } from 'react';

export interface MetricLineChartProps {
    // `date` drives the x-axis tick labels; `value` drives the line. Callers pass
    // display-unit values (already converted to kg/lbs or cm/in).
    points: { date: string; value: number }[];
    unitLabel: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-06-11" -> "11 Jun" for compact x-axis ticks.
function shortDate(iso: string): string {
    const parts = iso.split('-');
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!m || !d) return iso;
    return `${d} ${MONTHS[m - 1]}`;
}

export default function MetricLineChart({ points, unitLabel }: MetricLineChartProps) {
    // Unique per instance: the body tab renders several charts (weight + each
    // measurement metric), and a shared gradient id would collide in the DOM.
    const fillId = useId();
    const capped = points.slice(-30);
    if (capped.length < 2) return null;

    // viewBox geometry. width:100% + height:auto scales this to the container,
    // so the chart fills the full width and its height follows (no letterboxing).
    // PB leaves room for the x-axis date labels; PL for the y-axis value labels.
    const W = 300,
        H = 96,
        PL = 32,
        PR = 10,
        PT = 10,
        PB = 22;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const values = capped.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    function px(i: number) {
        return PL + (i / (capped.length - 1)) * cw;
    }
    function py(v: number) {
        if (range === 0) return PT + ch / 2;
        return PT + ch - ((v - minVal) / range) * ch;
    }

    const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const lastX = px(capped.length - 1);
    const areaPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${lastX.toFixed(1)},${(PT + ch).toFixed(1)} L ${PL},${(PT + ch).toFixed(1)} Z`;
    const fmt = (v: number) => (unitLabel === 'lbs' ? v.toFixed(1) : String(v));

    // Up to 4 evenly spaced x-axis ticks, always including the first and last.
    const tickCount = Math.min(4, capped.length);
    const tickIdx = Array.from(
        new Set(Array.from({ length: tickCount }, (_, k) => Math.round((k * (capped.length - 1)) / (tickCount - 1)))),
    );

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden>
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pulse-accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-pulse-accent)" stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${fillId})`} />
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {capped.map((p, i) => {
                const isLast = i === capped.length - 1;
                return (
                    <g key={i}>
                        <circle cx={px(i)} cy={py(p.value)} r={isLast ? 3 : 2} fill="var(--color-pulse-accent)" />
                        {/* Enlarged transparent hit area so the small dot is easy to hover; the
                            native tooltip surfaces the date and value. */}
                        <circle cx={px(i)} cy={py(p.value)} r={8} fill="transparent" style={{ cursor: 'pointer' }}>
                            <title>{`${shortDate(p.date)}: ${fmt(p.value)} ${unitLabel}`}</title>
                        </circle>
                    </g>
                );
            })}
            {range > 0 && (
                <>
                    <text
                        x={PL - 4}
                        y={PT + ch}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Sora, sans-serif"
                        fill="var(--color-pulse-dim)">
                        {fmt(minVal)}
                    </text>
                    <text
                        x={PL - 4}
                        y={PT}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Sora, sans-serif"
                        fill="var(--color-pulse-dim)"
                        dy="8">
                        {fmt(maxVal)}
                    </text>
                </>
            )}
            {/* x-axis date labels */}
            {tickIdx.map((i) => (
                <text
                    key={`tick-${i}`}
                    x={px(i)}
                    y={H - 6}
                    textAnchor={i === 0 ? 'start' : i === capped.length - 1 ? 'end' : 'middle'}
                    fontSize={8}
                    fontFamily="Sora, sans-serif"
                    fill="var(--color-pulse-muted)">
                    {shortDate(capped[i].date)}
                </text>
            ))}
        </svg>
    );
}
