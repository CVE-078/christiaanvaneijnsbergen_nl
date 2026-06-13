'use client';
import ModalSheet from './ModalSheet';
import { ModalGroupHeader } from './ui/ModalList';
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
     * When omitted, the modal falls back to `toDisplay(value, unit) unit`.
     */
    format?: (value: number) => string;
}

// Renders the full series chart above a month-grouped entry list (newest month
// first, entries newest first). The shared ModalSheet handles the shell.
export default function MetricHistoryModal({ open, onClose, title, unit, entries, format }: Props) {
    const today = new Date().toISOString().split('T')[0];
    // Chart shows points oldest-first (MetricLineChart expectation).
    const chartPoints = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const groups = groupEntriesByMonth(entries);
    const count = entries.length;

    return (
        <ModalSheet
            open={open}
            onClose={onClose}
            title={title}
            subtitle={count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : undefined}>
            {/* Chart, full width with auto height */}
            {chartPoints.length >= 2 && (
                <div className="px-6 pb-2">
                    <MetricLineChart points={chartPoints} unitLabel={unit} />
                </div>
            )}

            {/* Month-grouped entry list */}
            <div className="flex-1 overflow-y-auto px-6 pb-1">
                {groups.map((group) => (
                    <div key={group.key}>
                        <ModalGroupHeader
                            label={group.label}
                            count={`${group.entries.length} ${group.entries.length === 1 ? 'entry' : 'entries'}`}
                        />
                        {group.entries.map((entry, i) => (
                            <div
                                key={`${entry.date}-${i}`}
                                className="flex items-center justify-between border-b border-pulse-border py-3 last:border-b-0">
                                <span className="font-pulse text-[0.82rem] text-pulse-dim">
                                    {formatLogDate(entry.date, today)}
                                </span>
                                <span className="font-pulse text-[0.9rem] font-medium text-pulse-text">
                                    {format ? format(entry.value) : `${toDisplay(entry.value, unit as Unit)} ${unit}`}
                                </span>
                            </div>
                        ))}
                    </div>
                ))}
                {entries.length === 0 && (
                    <p className="py-6 text-center font-pulse text-sm text-pulse-muted">No entries yet.</p>
                )}
            </div>
        </ModalSheet>
    );
}
