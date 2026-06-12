import { describe, it, expect } from 'vitest';
import { metricSeries } from '@/lib/pulse/bodyMetrics';
import type { BodyMeasurement } from '@/lib/pulse/types';

function row(
    id: string,
    measured_at: string,
    waist_cm: number | null,
    hips_cm: number | null,
    chest_cm: number | null,
    arms_cm: number | null,
): BodyMeasurement {
    return { id, measured_at, waist_cm, hips_cm, chest_cm, arms_cm };
}

describe('metricSeries', () => {
    it('returns [] for empty rows', () => {
        expect(metricSeries([], 'waist_cm')).toEqual([]);
    });

    it('filters out rows where the metric is null', () => {
        const rows = [
            row('1', '2026-06-01', null, 99, null, null),
            row('2', '2026-06-08', 81, 100, null, null),
        ];
        // waist_cm: only row 2 has a value
        expect(metricSeries(rows, 'waist_cm')).toEqual([{ date: '2026-06-08', value: 81 }]);
        // hips_cm: both rows have a value
        expect(metricSeries(rows, 'hips_cm')).toEqual([
            { date: '2026-06-01', value: 99 },
            { date: '2026-06-08', value: 100 },
        ]);
    });

    it('maps {date, value} correctly from the row', () => {
        const rows = [row('1', '2026-06-05', 80, null, null, null)];
        expect(metricSeries(rows, 'waist_cm')).toEqual([{ date: '2026-06-05', value: 80 }]);
    });

    it('sorts oldest-first', () => {
        const rows = [
            row('3', '2026-06-10', 83, null, null, null),
            row('1', '2026-06-01', 81, null, null, null),
            row('2', '2026-06-05', 82, null, null, null),
        ];
        const result = metricSeries(rows, 'waist_cm');
        expect(result.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-05', '2026-06-10']);
    });

    it('keeps two rows with the same measured_at as two separate points', () => {
        const rows = [
            row('1', '2026-06-01', 81, null, null, null),
            row('2', '2026-06-01', 82, null, null, null),
        ];
        const result = metricSeries(rows, 'waist_cm');
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ date: '2026-06-01', value: 81 });
        expect(result[1]).toEqual({ date: '2026-06-01', value: 82 });
    });
});
