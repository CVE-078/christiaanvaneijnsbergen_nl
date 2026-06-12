'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import SectionLabel from './SectionLabel';
import MetricLineChart from './MetricLineChart';
import { INPUT } from './ui';
import { logBodyWeight as logBodyWeightAction } from '@/app/pulse/actions';

export default function BodyWeightCard() {
    const { profile, bodyweightLogs, logBodyWeight, deleteBodyWeight } = usePulse();
    const { unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);
    const [bwDate, setBwDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    const today = new Date().toISOString().split('T')[0];

    // Round the delta to a tenth: a raw float subtraction (e.g. 80.2 - 79.6)
    // otherwise surfaces noise like 0.6000000000000085 in the trend chip.
    const bwTrend =
        bodyweightLogs.length >= 2
            ? Math.round((bodyweightLogs[0].weight_kg - bodyweightLogs[1].weight_kg) * 10) / 10
            : null;

    function fmtDate(iso: string) {
        if (iso === today) return 'Today';
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

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
                // Use direct action so we can pass the selected date
                if (bwDate === today) {
                    await logBodyWeight(kgVal);
                } else {
                    await logBodyWeightAction(kgVal, bwDate);
                }
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

    return (
        <div>
            <div className="flex justify-between items-center mb-3 gap-2">
                <SectionLabel>Body Weight</SectionLabel>
                {bwTrend != null && (
                    <span
                        className={`font-pulse text-[0.6875rem] font-medium tabular-nums rounded px-2 py-0.5 bg-pulse-surface-2 ${
                            bwTrend < 0 ? 'text-pulse-success' : 'text-pulse-dim'
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
                    /* opacity/cursor are runtime booleans, must stay inline */
                    style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
                    className="font-pulse text-[0.75rem] tracking-[0.06em] uppercase py-2 px-4 bg-pulse-surface-2 border-none rounded-lg text-pulse-dim shrink-0">
                    Log
                </button>
            </div>

            {bodyweightLogs.length >= 2 && (
                <div className="bg-pulse-surface rounded-xl pt-[0.625rem] px-2 pb-2 mb-3">
                    <MetricLineChart points={chartPoints} unitLabel={unit} />
                </div>
            )}

            {bodyweightLogs.length > 0 ? (
                <div>
                    {bodyweightLogs.map((entry) => (
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
                </div>
            ) : (
                <div className="font-pulse text-[0.75rem] text-pulse-muted tracking-[0.04em]">No entries yet.</div>
            )}
        </div>
    );
}
