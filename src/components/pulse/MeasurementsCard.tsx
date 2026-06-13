'use client';
import { useState, useTransition } from 'react';
import { toLengthDisplay, toCm } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import { metricSeries, type MeasurementMetric } from '@/lib/pulse/bodyMetrics';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import MetricLineChart from './MetricLineChart';
import MetricHistoryModal from './MetricHistoryModal';
import ModalSheet from './ModalSheet';
import { INPUT } from './ui';
import type { LengthUnit } from '@/lib/pulse/types';

const METRIC_PILLS: { metric: MeasurementMetric; label: string }[] = [
    { metric: 'waist_cm', label: 'Waist' },
    { metric: 'hips_cm', label: 'Hips' },
    { metric: 'chest_cm', label: 'Chest' },
    { metric: 'arms_cm', label: 'Arms' },
];

const EMPTY_INPUTS: Record<MeasurementMetric, string> = { waist_cm: '', hips_cm: '', chest_cm: '', arms_cm: '' };

export default function MeasurementsCard() {
    const { profile, bodyMeasurements, logBodyMeasurement, deleteBodyMeasurement, updateLengthUnit } = usePulse();
    const { length_unit: lengthUnit } = profile;

    const today = new Date().toISOString().split('T')[0];

    const [isPending, startTransition] = useTransition();
    const [showAllModal, setShowAllModal] = useState(false);
    const [showLogModal, setShowLogModal] = useState(false);
    // All four metrics entered together in the log sheet; each maps to one row per
    // date (the action COALESCE-merges, so a blank field keeps that metric's value).
    const [inputs, setInputs] = useState<Record<MeasurementMetric, string>>(EMPTY_INPUTS);
    const [measureError, setMeasureError] = useState<string | null>(null);
    const [measureDate, setMeasureDate] = useState<string>(today);
    const [selectedMetric, setSelectedMetric] = useState<MeasurementMetric>('waist_cm');

    // Per-metric series (oldest-first, non-null values only) drives the chart/history.
    const series = metricSeries(bodyMeasurements, selectedMetric);
    const displaySeries = series.map((p) => ({ date: p.date, value: toLengthDisplay(p.value, lengthUnit) }));
    // Selected-metric change vs the previous entry, mirroring BodyWeightCard's trend
    // chip (down reads positive/green, like losing waist; rounded to a tenth).
    const metricTrend =
        displaySeries.length >= 2
            ? Math.round(
                  (displaySeries[displaySeries.length - 1].value - displaySeries[displaySeries.length - 2].value) * 10,
              ) / 10
            : null;
    const latestThree = displaySeries.slice(-3).reverse();
    const modalEntries = series.map((p) => ({ date: p.date, value: p.value }));
    const selectedLabel = METRIC_PILLS.find((p) => p.metric === selectedMetric)?.label ?? 'Measurements';

    // One row per date, so a date maps to a single row id (used for delete).
    const idForDate = (date: string): string | undefined => bodyMeasurements.find((m) => m.measured_at === date)?.id;

    function fmtValue(v: number): string {
        return `${Math.round(v * 10) / 10} ${lengthUnit}`;
    }

    function handleLengthUnitChange(newUnit: LengthUnit) {
        if (newUnit === lengthUnit) return;
        void updateLengthUnit(newUnit);
    }

    // Log every filled metric for the chosen date in one row, then close the sheet.
    function handleLog() {
        const data: {
            measured_at: string;
            waist_cm?: number;
            hips_cm?: number;
            chest_cm?: number;
            arms_cm?: number;
        } = { measured_at: measureDate };
        let any = false;
        for (const { metric } of METRIC_PILLS) {
            const raw = inputs[metric].trim();
            if (raw === '') continue;
            const val = parseFloat(raw);
            if (isNaN(val) || val <= 0) {
                setMeasureError('Enter valid measurements');
                return;
            }
            data[metric] = toCm(val, lengthUnit);
            any = true;
        }
        if (!any) {
            setMeasureError('Enter at least one measurement');
            return;
        }
        startTransition(async () => {
            try {
                await logBodyMeasurement(data);
                setInputs(EMPTY_INPUTS);
                setMeasureDate(today);
                setMeasureError(null);
                setShowLogModal(false);
            } catch {
                setMeasureError('Failed to save. Try again.');
            }
        });
    }

    function handleDelete(date: string) {
        const id = idForDate(date);
        if (!id) return;
        startTransition(async () => {
            try {
                await deleteBodyMeasurement(id);
            } catch {
                setMeasureError('Failed to delete. Try again.');
            }
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

            {/* row2: selected-metric trend chip, matching BodyWeightCard's trend slot */}
            <div className="h-[2.125rem] flex items-center gap-1.5 mb-3">
                {metricTrend != null && (
                    <span
                        className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded-full px-[10px] py-1 ${
                            metricTrend < 0
                                ? 'text-pulse-success bg-pulse-success/10'
                                : 'text-pulse-dim bg-pulse-surface-2'
                        }`}>
                        {metricTrend < 0 ? '↓' : '↑'} {Math.abs(metricTrend)} {lengthUnit}
                    </span>
                )}
            </div>

            {/* Entry row: metric selector (chart/history view) on the left + the log trigger
                on the right. Same row count + height as BodyWeightCard so the cards align. */}
            <div className="flex items-center justify-between gap-2 mb-[0.875rem]">
                <div
                    className="flex items-center gap-1.5 flex-wrap"
                    role="group"
                    aria-label="Select measurement metric to view">
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
                <button
                    type="button"
                    aria-label="Log measurements"
                    onClick={() => {
                        setMeasureError(null);
                        setShowLogModal(true);
                    }}
                    className="shrink-0 flex items-center gap-1 py-2 px-3.5 rounded-lg border-none bg-pulse-accent font-pulse text-[0.75rem] font-semibold tracking-[0.06em] uppercase text-pulse-bg cursor-pointer">
                    <span className="text-base leading-none">+</span> Log
                </button>
            </div>

            {/* Per-metric chart, wrapped in a surface block to match BodyWeightCard */}
            {displaySeries.length >= 2 && (
                <div className="bg-pulse-surface rounded-xl overflow-hidden mb-3">
                    <MetricLineChart points={displaySeries} unitLabel={lengthUnit} />
                </div>
            )}

            {/* Latest 3 entries for the selected metric. Deleting removes the whole date. */}
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
                            <button
                                onClick={() => handleDelete(p.date)}
                                disabled={isPending}
                                aria-label={`Delete measurements for ${p.date}`}
                                className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0 shrink-0">
                                ✕
                            </button>
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

            {/* All-four entry sheet (keeps the card compact + equal-height to BodyWeightCard) */}
            <ModalSheet open={showLogModal} onClose={() => setShowLogModal(false)} title="Log measurements">
                <div className="flex flex-col gap-3 px-6 pb-2">
                    <input
                        type="date"
                        max={today}
                        value={measureDate}
                        onChange={(e) => {
                            setMeasureDate(e.target.value);
                            setMeasureError(null);
                        }}
                        className={INPUT}
                    />
                    {METRIC_PILLS.map(({ metric, label }) => (
                        <label key={metric} className="flex items-center justify-between gap-3">
                            <span className="font-pulse text-[0.85rem] text-pulse-dim">{label}</span>
                            <input
                                type="number"
                                step="0.1"
                                placeholder={lengthUnit}
                                aria-label={`${label} in ${lengthUnit}`}
                                value={inputs[metric]}
                                onChange={(e) => {
                                    setInputs((prev) => ({ ...prev, [metric]: e.target.value }));
                                    setMeasureError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleLog();
                                }}
                                className="w-32 py-2 px-3 bg-pulse-bg rounded-lg text-pulse-text font-pulse text-sm outline-none border border-pulse-border focus:border-pulse-accent"
                            />
                        </label>
                    ))}
                    {measureError && <div className="font-pulse text-[0.75rem] text-pulse-error">{measureError}</div>}
                    <button
                        onClick={handleLog}
                        disabled={isPending}
                        style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                        className="mt-1 w-full font-pulse text-[0.8125rem] font-semibold tracking-[0.04em] uppercase py-2.5 px-4 bg-pulse-accent border-none rounded-lg text-pulse-bg">
                        Save
                    </button>
                </div>
            </ModalSheet>

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
