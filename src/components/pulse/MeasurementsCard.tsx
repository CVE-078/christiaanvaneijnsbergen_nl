'use client';
import { useState } from 'react';
import { toLengthDisplay, toCm } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import { metricSeries, type MeasurementMetric } from '@/lib/pulse/bodyMetrics';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import MetricLineChart from './MetricLineChart';
import { INPUT, BTN_PRIMARY } from './ui';
import { logBodyMeasurement } from '@/app/pulse/actions';
import type { LengthUnit } from '@/lib/pulse/types';

const METRIC_PILLS: { metric: MeasurementMetric; label: string }[] = [
    { metric: 'waist_cm', label: 'Waist' },
    { metric: 'hips_cm', label: 'Hips' },
    { metric: 'chest_cm', label: 'Chest' },
    { metric: 'arms_cm', label: 'Arms' },
];

export default function MeasurementsCard() {
    const { profile, bodyMeasurements, refreshMeasurements, updateLengthUnit } = usePulse();
    const { length_unit: lengthUnit } = profile;

    const today = new Date().toISOString().split('T')[0];

    const [showMeasurements, setShowMeasurements] = useState(false);
    const [measurements, setMeasurements] = useState({ waist: '', hips: '', chest: '', arms: '' });
    const [measureDate, setMeasureDate] = useState<string>(today);
    const [selectedMetric, setSelectedMetric] = useState<MeasurementMetric>('waist_cm');

    // Per-metric series (oldest-first, non-null values only).
    const series = metricSeries(bodyMeasurements, selectedMetric);

    // Display-unit conversion for chart and list.
    const displaySeries = series.map((p) => ({ date: p.date, value: toLengthDisplay(p.value, lengthUnit) }));

    // Trend: delta of the two most-recent values. Subtract in canonical cm first,
    // then convert + round once (matches BodyWeightCard, avoids double-rounding).
    const trendDelta =
        series.length >= 2
            ? Math.round(toLengthDisplay(series[series.length - 1].value - series[series.length - 2].value, lengthUnit) * 10) / 10
            : null;

    // Latest 3 entries for the selected metric (most-recent first).
    const latestThree = displaySeries.slice(-3).reverse();

    function fmtValue(v: number): string {
        return `${Math.round(v * 10) / 10} ${lengthUnit}`;
    }

    function handleLengthUnitChange(newUnit: LengthUnit) {
        if (newUnit === lengthUnit) return;
        void updateLengthUnit(newUnit);
    }

    return (
        <section className="border-t border-pulse-border pt-4">
            <div className="flex justify-between items-center mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <SectionLabel>Measurements</SectionLabel>
                    {trendDelta != null && (
                        <span
                            className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded px-2 py-0.5 bg-pulse-surface-2 shrink-0 ${
                                trendDelta < 0 ? 'text-pulse-success' : 'text-pulse-dim'
                            }`}>
                            {trendDelta < 0 ? '↓' : '↑'} {Math.abs(trendDelta)} {lengthUnit}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div
                        className="inline-flex bg-pulse-surface-2 rounded-lg p-0.5 gap-0.5"
                        role="group"
                        aria-label="Measurement unit">
                        {(['cm', 'in'] as const).map((u) => (
                            <button
                                key={u}
                                onClick={() => handleLengthUnitChange(u)}
                                aria-pressed={lengthUnit === u}
                                className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.04em] uppercase py-1 px-2.5 rounded-md cursor-pointer border-none ${lengthUnit === u ? 'bg-pulse-accent text-pulse-bg' : 'bg-transparent text-pulse-dim'}`}>
                                {u}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowMeasurements(!showMeasurements)}
                        className="font-pulse text-xs text-pulse-accent cursor-pointer bg-transparent border-none">
                        {showMeasurements ? 'Cancel' : '+ Log'}
                    </button>
                </div>
            </div>

            {/* Metric picker pills */}
            <div className="flex gap-1.5 mb-3" role="group" aria-label="Select measurement metric">
                {METRIC_PILLS.map(({ metric, label }) => (
                    <button
                        key={metric}
                        onClick={() => setSelectedMetric(metric)}
                        aria-pressed={selectedMetric === metric}
                        className={`font-pulse text-[0.6875rem] font-semibold tracking-[0.04em] py-1 px-3 rounded-full cursor-pointer border-none ${selectedMetric === metric ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* Per-metric chart */}
            {displaySeries.length >= 2 && (
                <MetricLineChart points={displaySeries} unitLabel={lengthUnit} />
            )}

            {/* Latest 3 entries for the selected metric */}
            {latestThree.length > 0 ? (
                <div className="flex flex-col gap-1 mt-2">
                    {latestThree.map((p, i) => (
                        <div key={`${p.date}-${i}`} className="flex justify-between items-center">
                            <span className="font-pulse text-xs text-pulse-dim">{formatLogDate(p.date, today)}</span>
                            <span className="font-pulse text-sm font-medium text-pulse-text tabular-nums">
                                {fmtValue(p.value)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="font-pulse text-xs text-pulse-muted mt-2">No entries yet</div>
            )}

            {showMeasurements && (
                <div className="flex flex-col gap-2 mt-2">
                    <input
                        type="date"
                        max={today}
                        value={measureDate}
                        onChange={(e) => setMeasureDate(e.target.value)}
                        className={INPUT}
                    />
                    {(['waist', 'hips', 'chest', 'arms'] as const).map((field) => (
                        <div key={field} className="flex items-center gap-2">
                            <label className="font-pulse text-xs text-pulse-dim w-12 capitalize">{field}</label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder={lengthUnit}
                                aria-label={`${field} in ${lengthUnit}`}
                                value={measurements[field]}
                                onChange={(e) => setMeasurements((prev) => ({ ...prev, [field]: e.target.value }))}
                                className={INPUT + ' flex-1'}
                            />
                        </div>
                    ))}
                    <button
                        onClick={async () => {
                            await logBodyMeasurement({
                                measured_at: measureDate,
                                waist_cm: measurements.waist
                                    ? toCm(Number(measurements.waist), lengthUnit)
                                    : undefined,
                                hips_cm: measurements.hips ? toCm(Number(measurements.hips), lengthUnit) : undefined,
                                chest_cm: measurements.chest
                                    ? toCm(Number(measurements.chest), lengthUnit)
                                    : undefined,
                                arms_cm: measurements.arms ? toCm(Number(measurements.arms), lengthUnit) : undefined,
                            });
                            refreshMeasurements();
                            setShowMeasurements(false);
                            setMeasurements({ waist: '', hips: '', chest: '', arms: '' });
                            setMeasureDate(today);
                        }}
                        className={BTN_PRIMARY}>
                        Save
                    </button>
                </div>
            )}
        </section>
    );
}
