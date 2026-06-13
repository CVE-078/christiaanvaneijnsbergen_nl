'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import MetricLineChart from './MetricLineChart';
import MetricHistoryModal from './MetricHistoryModal';
import { INPUT } from './ui';

export default function BodyWeightCard() {
    const { profile, bodyweightLogs, logBodyWeight, deleteBodyWeight } = usePulse();
    const { unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);
    const [bwDate, setBwDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [showAllModal, setShowAllModal] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    // Round the delta to a tenth: a raw float subtraction (e.g. 80.2 - 79.6)
    // otherwise surfaces noise like 0.6000000000000085 in the trend chip.
    const bwTrend =
        bodyweightLogs.length >= 2
            ? Math.round((bodyweightLogs[0].weight_kg - bodyweightLogs[1].weight_kg) * 10) / 10
            : null;

    const fmtDate = (iso: string) => formatLogDate(iso, today);

    function handleLogBodyweight() {
        const val = parseFloat(bwInput);
        if (isNaN(val) || val <= 0) {
            setBwError('Enter a valid weight');
            return;
        }
        const kgVal = toKg(val, unit);
        if (kgVal < MIN_KG || kgVal > MAX_KG) {
            setBwError(`Must be between ${toDisplay(MIN_KG, unit)} and ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        setBwError(null);
        startTransition(async () => {
            try {
                // The hook updates the SWR cache for any date (the server returns the
                // upserted row, which it inserts directly), so backdated logs show live.
                await logBodyWeight(kgVal, bwDate === today ? undefined : bwDate);
                setBwInput('');
            } catch {
                setBwError('Failed to save. Try again.');
            }
        });
    }

    function handleDeleteBodyweight(id: string) {
        startTransition(async () => {
            await deleteBodyWeight(id);
        });
    }

    // bodyweightLogs is newest-first; reverse to chronological order for the chart
    const chartPoints = [...bodyweightLogs]
        .reverse()
        .map((e) => ({ date: e.logged_at, value: toDisplay(e.weight_kg, unit) }));

    // Modal entries: oldest-first for month grouping (MetricHistoryModal handles sorting)
    const modalEntries = bodyweightLogs.map((e) => ({ date: e.logged_at, value: e.weight_kg }));

    // Inline list: show at most 3 latest entries
    const inlineEntries = bodyweightLogs.slice(0, 3);

    return (
        <div>
            {/* Header: title only, fixed height to align with MeasurementsCard header */}
            <div className="flex items-center h-[1.875rem] mb-1">
                <SectionLabel>Body Weight</SectionLabel>
            </div>
            {/* row2: fixed-height metadata slot matching MeasurementsCard's pill row */}
            <div className="h-[2.125rem] flex items-center gap-1.5 mb-3">
                {bwTrend != null && (
                    <span
                        className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded-full px-[10px] py-1 ${
                            bwTrend < 0 ? 'text-pulse-success bg-pulse-success/10' : 'text-pulse-dim bg-pulse-surface-2'
                        }`}>
                        {bwTrend < 0 ? '↓' : '↑'} {toDisplay(Math.abs(bwTrend), unit)} {unit}
                    </span>
                )}
            </div>
            <div className="flex gap-2 items-start mb-[0.875rem]">
                <div className="flex-1">
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            type="date"
                            value={bwDate}
                            max={today}
                            onChange={(e) => setBwDate(e.target.value)}
                            className={INPUT}
                        />
                        <input
                            type="number"
                            aria-label={`Body weight in ${unit}`}
                            placeholder={unit}
                            value={bwInput}
                            min={toDisplay(MIN_KG, unit)}
                            max={toDisplay(MAX_KG, unit)}
                            step={0.1}
                            onChange={(e) => {
                                setBwInput(e.target.value);
                                setBwError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLogBodyweight();
                            }}
                            className={`w-[5.5rem] py-2 px-3 bg-pulse-bg rounded-lg text-pulse-text font-pulse text-sm outline-none border focus:border-pulse-accent ${bwError ? 'border-pulse-error' : 'border-pulse-border'}`}
                        />
                    </div>
                    {bwError && <div className="font-pulse text-[0.75rem] text-pulse-error mt-1">{bwError}</div>}
                </div>
                <button
                    onClick={handleLogBodyweight}
                    disabled={isPending}
                    aria-label="Log"
                    /* opacity/cursor are runtime booleans, must stay inline */
                    style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                    className="inline-flex items-center gap-1 font-pulse text-[0.75rem] font-semibold tracking-[0.06em] uppercase py-2 px-4 bg-pulse-accent border-none rounded-lg text-pulse-bg shrink-0">
                    <span className="text-base leading-none">+</span> Log
                </button>
            </div>

            {bodyweightLogs.length >= 2 && (
                <div className="bg-pulse-surface rounded-xl overflow-hidden mb-3">
                    <MetricLineChart points={chartPoints} unitLabel={unit} />
                </div>
            )}

            {bodyweightLogs.length > 0 ? (
                <div>
                    {inlineEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center gap-3 py-[0.5rem] border-b border-pulse-border last:border-b-0">
                            <span className="font-pulse-body text-[0.8125rem] text-pulse-dim flex-1">
                                {fmtDate(entry.logged_at)}
                            </span>
                            <span className="font-pulse text-[0.9375rem] text-pulse-text font-medium">
                                {toDisplay(entry.weight_kg, unit)} {unit}
                            </span>
                            <button
                                onClick={() => handleDeleteBodyweight(entry.id)}
                                disabled={isPending}
                                aria-label={`Delete entry for ${entry.logged_at}`}
                                className="font-pulse text-[0.75rem] text-pulse-dim bg-transparent border-none cursor-pointer p-0 shrink-0">
                                ✕
                            </button>
                        </div>
                    ))}
                    {bodyweightLogs.length > 3 && (
                        <button
                            type="button"
                            onClick={() => setShowAllModal(true)}
                            className="mt-2 w-full flex items-center justify-center gap-[7px] rounded-xl bg-pulse-surface-2 px-4 py-[11px] font-pulse text-[0.8rem] font-medium text-pulse-accent border-none cursor-pointer">
                            Show all {bodyweightLogs.length} entries
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
                <div className="font-pulse text-[0.75rem] text-pulse-muted tracking-[0.04em]">No entries yet.</div>
            )}

            <MetricHistoryModal
                open={showAllModal}
                onClose={() => setShowAllModal(false)}
                title="Body weight"
                unit={unit}
                entries={modalEntries}
                format={(v) => `${toDisplay(v, unit)} ${unit}`}
            />
        </div>
    );
}
