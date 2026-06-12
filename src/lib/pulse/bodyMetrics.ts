import type { BodyMeasurement } from './types';

export type MeasurementMetric = 'waist_cm' | 'hips_cm' | 'chest_cm' | 'arms_cm';

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
