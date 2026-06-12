'use client';
import { useEffect } from 'react';
import MetricLineChart from './MetricLineChart';
import { groupEntriesByMonth, type MetricEntry } from '@/lib/pulse/bodyMetrics';
import { toDisplay } from '@/lib/pulse/utils';
import { formatLogDate } from '@/lib/pulse/dates';
import type { Unit } from '@/lib/pulse/types';

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Unit label shown in the chart axis and, when `format` is omitted, appended to each entry value. */
    unit: Unit | string;
    entries: MetricEntry[];
    /**
     * Optional formatter for individual entry values. When provided, the modal
     * calls `format(value)` and renders the result directly (no unit suffix
     * appended). Use this when the caller needs a unit other than `Unit`
     * ('kg' | 'lbs'), e.g. for length measurements in cm/in.
     * When omitted, the modal falls back to `toDisplay(value, unit as Unit) unit`.
     */
    format?: (value: number) => string;
}

// Bottom-sheet on mobile, centered dialog on desktop. Renders the full series
// chart above a month-grouped entry list (newest month first, entries newest
// first). Returns null when closed so it does not mount the chart or list.
export default function MetricHistoryModal({ open, onClose, title, unit, entries, format }: Props) {
    // Dismiss on Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const today = new Date().toISOString().split('T')[0];
    // Chart shows points oldest-first (MetricLineChart expectation).
    const chartPoints = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const groups = groupEntriesByMonth(entries);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 lg:items-center"
            onClick={onClose}>
            <div
                className="flex w-full max-w-[560px] max-h-[86vh] flex-col rounded-t-[20px] bg-pulse-surface pb-5 lg:max-h-[78vh] lg:rounded-[18px] lg:mx-6"
                onClick={(e) => e.stopPropagation()}>
                {/* Grip handle, visible on mobile only */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-pulse-border lg:hidden" aria-hidden />

                {/* Header */}
                <div className="flex items-center justify-between px-[18px] pt-3 pb-3">
                    <span className="font-pulse-display font-bold text-[1.3rem] text-pulse-text leading-tight">
                        {title}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="cursor-pointer border-none bg-transparent font-pulse text-[1.05rem] leading-none text-pulse-muted hover:text-pulse-text">
                        ✕
                    </button>
                </div>

                {/* Chart, full width with auto height */}
                {chartPoints.length >= 2 && (
                    <div className="px-2 pb-2">
                        <MetricLineChart points={chartPoints} unitLabel={unit} />
                    </div>
                )}

                {/* Month-grouped entry list */}
                <div className="overflow-y-auto px-[18px] pb-1 flex-1">
                    {groups.map((group) => (
                        <div key={group.key}>
                            <div className="sticky top-0 z-10 bg-pulse-surface pt-3 pb-2 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-pulse-muted">
                                {group.label}
                            </div>
                            {group.entries.map((entry, i) => (
                                <div
                                    key={`${entry.date}-${i}`}
                                    className="flex items-center justify-between border-b border-pulse-border py-[10px] last:border-b-0">
                                    <span className="font-pulse text-[0.82rem] text-pulse-dim">
                                        {formatLogDate(entry.date, today)}
                                    </span>
                                    <span className="font-pulse text-[0.9rem] font-medium text-pulse-text">
                                        {format
                                            ? format(entry.value)
                                            : `${toDisplay(entry.value, unit as Unit)} ${unit}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                    {entries.length === 0 && (
                        <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No entries yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
