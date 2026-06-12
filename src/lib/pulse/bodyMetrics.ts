import type { BodyMeasurement } from './types';

export type MeasurementMetric = 'waist_cm' | 'hips_cm' | 'chest_cm' | 'arms_cm';

export interface MetricEntry {
    date: string;
    value: number;
}

export interface MonthGroup {
    key: string;
    label: string;
    entries: MetricEntry[];
}

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

// Groups a flat list of {date, value} entries by calendar month. Returns newest
// month first; within each group, entries are newest first.
export function groupEntriesByMonth(entries: MetricEntry[]): MonthGroup[] {
    const byKey = new Map<string, MetricEntry[]>();
    for (const e of entries) {
        const key = e.date.slice(0, 7); // YYYY-MM
        (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(e);
    }
    return [...byKey.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([key, es]) => {
            const [y, m] = key.split('-');
            return {
                key,
                label: `${MONTHS[Number(m) - 1]} ${y}`,
                entries: [...es].sort((a, b) => (a.date < b.date ? 1 : -1)),
            };
        });
}

export interface MetricPoint {
    date: string; // measured_at (YYYY-MM-DD)
    value: number;
}

// Read-side per-metric series from the wide body_measurements rows. Keeps only
// rows where the chosen column is non-null, maps to {date, value}, sorted
// oldest-first for charting. Tolerates multiple rows per date (each kept as its
// own point); de-duping is a deferred write-side concern. Pure.
export function metricSeries(rows: BodyMeasurement[], metric: MeasurementMetric): MetricPoint[] {
    return rows
        .filter((r) => r[metric] != null)
        .map((r) => ({ date: r.measured_at, value: r[metric] as number }))
        .sort((a, b) => a.date.localeCompare(b.date));
}
