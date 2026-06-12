'use client';
import { useId } from 'react';

export interface MetricLineChartProps {
    // `date` is the point's identity for future x-axis ticks / tooltips; only
    // `value` drives the current line. Callers pass display-unit values.
    points: { date: string; value: number }[];
    unitLabel: string;
}

export default function MetricLineChart({ points, unitLabel }: MetricLineChartProps) {
    // Unique per instance: the body tab renders several charts (weight + each
    // measurement metric), and a shared gradient id would collide in the DOM.
    const fillId = useId();
    const capped = points.slice(-30);
    if (capped.length < 2) return null;

    const W = 300,
        H = 80,
        PL = 34,
        PR = 8,
        PT = 10,
        PB = 4;
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
    const lastY = py(values[values.length - 1]);
    const areaPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${lastX.toFixed(1)},${(PT + ch).toFixed(1)} L ${PL},${(PT + ch).toFixed(1)} Z`;
    const fmt = (v: number) => (unitLabel === 'lbs' ? v.toFixed(1) : String(v));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }} aria-hidden>
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
            <circle cx={lastX} cy={lastY} r={3} fill="var(--color-pulse-accent)" />
            {range > 0 && (
                <>
                    <text
                        x={PL - 3}
                        y={PT + ch}
                        textAnchor="end"
                        fontSize={8}
                        fontFamily="Sora, sans-serif"
                        fill="var(--color-pulse-dim)"
                        dy="0">
                        {fmt(minVal)}
                    </text>
                    <text
                        x={PL - 3}
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
        </svg>
    );
}
