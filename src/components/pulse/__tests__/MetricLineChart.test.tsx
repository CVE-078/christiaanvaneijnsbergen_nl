import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricLineChart from '../MetricLineChart';

const twoPoints = [
    { date: '2026-06-01', value: 80 },
    { date: '2026-06-08', value: 79 },
];

describe('MetricLineChart', () => {
    it('renders an SVG with a polyline for 2 or more points', () => {
        const { container } = render(<MetricLineChart points={twoPoints} unitLabel="kg" />);
        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelector('polyline')).not.toBeNull();
    });

    it('returns null for fewer than 2 points (empty array)', () => {
        const { container } = render(<MetricLineChart points={[]} unitLabel="kg" />);
        expect(container.firstChild).toBeNull();
    });

    it('returns null for exactly 1 point', () => {
        const { container } = render(<MetricLineChart points={[{ date: '2026-06-01', value: 80 }]} unitLabel="kg" />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the last-point circle', () => {
        const { container } = render(<MetricLineChart points={twoPoints} unitLabel="kg" />);
        expect(container.querySelector('circle')).not.toBeNull();
    });

    it('caps at 30 points and still renders', () => {
        const points = Array.from({ length: 40 }, (_, i) => ({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            value: 80 - i * 0.1,
        }));
        const { container } = render(<MetricLineChart points={points} unitLabel="kg" />);
        expect(container.querySelector('svg')).not.toBeNull();
    });
});
