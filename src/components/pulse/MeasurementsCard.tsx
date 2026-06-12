'use client';
import { useState, useTransition } from 'react';
import { toLengthDisplay, toCm } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import { metricSeries, type MeasurementMetric } from '@/lib/pulse/bodyMetrics';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import MetricLineChart from './MetricLineChart';
import MetricHistoryModal from './MetricHistoryModal';
import { INPUT } from './ui';
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

    const [isPending, startTransition] = useTransition();
    const [showAllModal, setShowAllModal] = useState(false);
    const [valueInput, setValueInput] = useState('');
    const [measureDate, setMeasureDate] = useState<string>(today);
    const [selectedMetric, setSelectedMetric] = useState<MeasurementMetric>('waist_cm');

    // Per-metric series (oldest-first, non-null values only).
    const series = metricSeries(bodyMeasurements, selectedMetric);

    // Display-unit conversion for chart and list.
    const displaySeries = series.map((p) => ({ date: p.date, value: toLengthDisplay(p.value, lengthUnit) }));

    // Latest 3 entries for the selected metric (most-recent first).
    const latestThree = displaySeries.slice(-3).reverse();

    // Modal entries in raw cm (oldest-first; format prop converts to display unit).
    const modalEntries = series.map((p) => ({ date: p.date, value: p.value }));

    // Label for the currently selected metric (used as modal title + input label).
    const selectedLabel = METRIC_PILLS.find((p) => p.metric === selectedMetric)?.label ?? 'Measurements';

    function fmtValue(v: number): string {
        return `${Math.round(v * 10) / 10} ${lengthUnit}`;
    }

    function handleLengthUnitChange(newUnit: LengthUnit) {
        if (newUnit === lengthUnit) return;
        void updateLengthUnit(newUnit);
    }

    // Log only the selected metric for the chosen date (single-metric inline logging).
    function handleLog() {
        const val = parseFloat(valueInput);
        if (isNaN(val) || val <= 0) return;
        const cm = toCm(val, lengthUnit);
        startTransition(async () => {
            await logBodyMeasurement({
                measured_at: measureDate,
                waist_cm: selectedMetric === 'waist_cm' ? cm : undefined,
                hips_cm: selectedMetric === 'hips_cm' ? cm : undefined,
                chest_cm: selectedMetric === 'chest_cm' ? cm : undefined,
                arms_cm: selectedMetric === 'arms_cm' ? cm : undefined,
            });
            refreshMeasurements();
            setValueInput('');
            setMeasureDate(today);
        });
    }

    return (
        <section>
            {/* Header: title + unit toggle, fixed height to align with BodyWeightCard header */}
            <div className="flex justify-between items-center h-[1.875rem] mb-1 gap-2">
                <SectionLabel>Measurements</SectionLabel>
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
            </div>

            {/* row2: fixed-height metric picker pills, matching BodyWeightCard's trend-chip row */}
            <div
                className="h-[2.125rem] flex items-center gap-1.5 mb-3"
                role="group"
                aria-label="Select measurement metric">
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

            {/* Inline log bar for the selected metric, matching BodyWeightCard's layout */}
            <div className="flex gap-2 items-start mb-[0.875rem]">
                <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            type="date"
                            max={today}
                            value={measureDate}
                            onChange={(e) => setMeasureDate(e.target.value)}
                            className={INPUT}
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder={lengthUnit}
                            aria-label={`${selectedLabel} in ${lengthUnit}`}
                            value={valueInput}
                            onChange={(e) => setValueInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLog();
                            }}
                            className="w-[5.5rem] py-2 px-3 bg-pulse-bg rounded-lg text-pulse-text font-pulse text-sm outline-none border border-pulse-border focus:border-pulse-accent"
                        />
                    </div>
                </div>
                <button
                    onClick={handleLog}
                    disabled={isPending}
                    /* opacity/cursor are runtime booleans, must stay inline */
                    style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                    className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase py-2 px-4 bg-pulse-surface-2 border-none rounded-lg text-pulse-dim shrink-0">
                    Log
                </button>
            </div>

            {/* Per-metric chart, wrapped in a surface block to match BodyWeightCard */}
            {displaySeries.length >= 2 && (
                <div className="bg-pulse-surface rounded-xl overflow-hidden mb-3">
                    <MetricLineChart points={displaySeries} unitLabel={lengthUnit} />
                </div>
            )}

            {/* Latest 3 entries for the selected metric */}
            {latestThree.length > 0 ? (
                <div>
                    {latestThree.map((p, i) => (
                        <div
                            key={`${p.date}-${i}`}
                            className="flex items-center gap-3 py-[0.5rem] border-b border-pulse-border last:border-b-0">
                            <span className="font-pulse-body text-[0.8125rem] text-pulse-dim flex-1">
                                {formatLogDate(p.date, today)}
                            </span>
                            <span className="font-pulse text-[0.9375rem] text-pulse-text font-medium tabular-nums">
                                {fmtValue(p.value)}
                            </span>
                        </div>
                    ))}
                    {series.length > 3 && (
                        <button
                            type="button"
                            onClick={() => setShowAllModal(true)}
                            className="mt-2 w-full flex items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                            Show all {series.length} entries
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden>
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                    )}
                </div>
            ) : (
                <div className="font-pulse text-xs text-pulse-muted mt-2">No entries yet</div>
            )}

            <MetricHistoryModal
                open={showAllModal}
                onClose={() => setShowAllModal(false)}
                title={selectedLabel}
                unit={lengthUnit}
                entries={modalEntries}
                format={(v) => `${Math.round(toLengthDisplay(v, lengthUnit) * 10) / 10} ${lengthUnit}`}
            />
        </section>
    );
}
