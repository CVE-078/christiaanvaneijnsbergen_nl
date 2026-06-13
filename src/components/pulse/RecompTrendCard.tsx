'use client';
import { useId } from 'react';
import { toDisplay } from '@/lib/pulse/utils';
import type { RecompTrend, Unit } from '@/lib/pulse/types';

interface Props {
    trend: RecompTrend;
    // The recomp verdict sentence (from computeRecompSignal), shown below the charts.
    verdict: string;
    unit: Unit;
    // Omit the verdict line when a sibling verdict card already shows it (e.g. the
    // Overview pairing). Defaults to showing it for standalone use.
    showVerdict?: boolean;
    // Omit the in-card label when the caller renders an external one (so paired
    // cards with external labels align their card tops). Defaults to showing it.
    showLabel?: boolean;
    // Lets the caller stretch the card to a sibling's height in a paired grid.
    className?: string;
}

// A single area sparkline: shape over the window, no axis labels (the delta chip
// carries the magnitude). Evenly spaced points; values are relative, so no unit
// conversion is needed here. Renders nothing meaningful below 2 points; the card
// shows a "log more" hint in that case instead of calling this.
function Sparkline({ values, color }: { values: number[]; color: string }) {
    const fillId = useId();
    const W = 320,
        H = 48,
        PAD = 5;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const n = values.length;
    const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v: number) => PAD + (H - 2 * PAD) - ((v - min) / range) * (H - 2 * PAD);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const last = values[n - 1];
    return (
        // Absolutely positioned so the SVG's intrinsic (viewBox) height never forces
        // the card taller than the verdict; it fills the relative flex wrapper instead.
        <svg
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 block h-full w-full"
            preserveAspectRatio="none"
            aria-hidden="true">
            <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={`M0,${H} L${pts.join(' L')} L${W},${H} Z`} fill={`url(#${fillId})`} />
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(n - 1)} cy={y(last)} r={3} fill={color} />
        </svg>
    );
}

// One metric row: label + delta chip + sparkline (or a "log more" hint when there
// is too little data to draw a line).
function MetricRow({
    label,
    color,
    values,
    deltaText,
    favorable,
}: {
    label: string;
    color: string;
    values: number[];
    deltaText: string | null;
    favorable: boolean;
}) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-baseline justify-between">
                <span className="font-pulse text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                    {label}
                </span>
                {deltaText && (
                    <span
                        className={`rounded-md px-1.5 py-0.5 font-pulse text-[0.7rem] font-medium ${
                            favorable ? 'bg-pulse-success/12 text-pulse-success' : 'bg-pulse-surface-2 text-pulse-dim'
                        }`}>
                        {deltaText}
                    </span>
                )}
            </div>
            {values.length >= 2 ? (
                // Relative + min-h floor: the absolute SVG fills this box, and the box
                // flexes to fill the card height (matched to the verdict) without the
                // SVG imposing its own intrinsic height.
                <div className="relative min-h-[28px] flex-1">
                    <Sparkline values={values} color={color} />
                </div>
            ) : (
                <div className="flex flex-1 items-center font-pulse text-[0.75rem] text-pulse-muted">
                    Log more to see the trend.
                </div>
            )}
        </div>
    );
}

// Makes the recomp signal visible rather than asserted: bodyweight and strength
// score as two stacked sparklines on their own scales, plus the verdict. Data is
// shaped by computeRecompTrend; this only formats and lays out. Caller renders it
// only when at least one series has enough points to draw.
export default function RecompTrendCard({
    trend,
    verdict,
    unit,
    showVerdict = true,
    showLabel = true,
    className = '',
}: Props) {
    const { weight, strength, weightDeltaKg, strengthDelta } = trend;
    const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '');
    const weightDeltaText =
        weightDeltaKg === null ? null : `${sign(weightDeltaKg)}${toDisplay(Math.abs(weightDeltaKg), unit).toFixed(1)} ${unit}`;
    const strengthDeltaText =
        strengthDelta === null ? null : `${sign(strengthDelta)}${Math.abs(Math.round(strengthDelta))}`;
    return (
        <div className={`flex h-full flex-col rounded-2xl bg-pulse-surface p-5 ${className}`}>
            {showLabel && (
                <div className="mb-3 font-pulse text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                    Recomp trend
                </div>
            )}
            <div className="flex flex-1 flex-col gap-4">
                <MetricRow
                    label="Bodyweight"
                    color="var(--color-pulse-dim)"
                    values={weight}
                    deltaText={weightDeltaText}
                    favorable={weightDeltaKg !== null && weightDeltaKg < 0}
                />
                <MetricRow
                    label="Strength score"
                    color="var(--color-pulse-accent)"
                    values={strength}
                    deltaText={strengthDeltaText}
                    favorable={strengthDelta !== null && strengthDelta > 0}
                />
            </div>
            {showVerdict && (
                <p className="mt-4 border-t border-pulse-border pt-3 font-pulse-body text-[0.78rem] leading-relaxed text-pulse-dim">
                    {verdict}
                </p>
            )}
        </div>
    );
}
