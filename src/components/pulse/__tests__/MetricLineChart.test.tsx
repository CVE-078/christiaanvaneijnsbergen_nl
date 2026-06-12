import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricLineChart from '../MetricLineChart';

const twoPoints = [
    { date: '2026-06-01', value: 80 },
    { date: '2026-06-08', value: 79 },
];

const threePoints = [
    { date: '2026-06-01', value: 80 },
    { date: '2026-06-08', value: 79 },
    { date: '2026-06-15', value: 78 },
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

    it('renders one circle per data point', () => {
        const { container } = render(<MetricLineChart points={twoPoints} unitLabel="kg" />);
        const circles = container.querySelectorAll('circle[fill="var(--color-pulse-accent)"]');
        expect(circles).toHaveLength(twoPoints.length);
    });

    it('renders one circle per data point for three points', () => {
        const { container } = render(<MetricLineChart points={threePoints} unitLabel="kg" />);
        const circles = container.querySelectorAll('circle[fill="var(--color-pulse-accent)"]');
        expect(circles).toHaveLength(threePoints.length);
    });

    it('caps at 30 points and renders 30 circles', () => {
        const points = Array.from({ length: 40 }, (_, i) => ({
            date: `2026-01-${String(i + 1).padStart(2, '0')}`,
            value: 80 - i * 0.1,
        }));
        const { container } = render(<MetricLineChart points={points} unitLabel="kg" />);
        expect(container.querySelector('svg')).not.toBeNull();
        const circles = container.querySelectorAll('circle[fill="var(--color-pulse-accent)"]');
        // capped at 30
        expect(circles).toHaveLength(30);
    });

    it('the last circle has r=3 (emphasized), others have r=2', () => {
        const { container } = render(<MetricLineChart points={threePoints} unitLabel="kg" />);
        const circles = Array.from(container.querySelectorAll('circle[fill="var(--color-pulse-accent)"]'));
        expect(circles[circles.length - 1].getAttribute('r')).toBe('3');
        for (const c of circles.slice(0, -1)) {
            expect(c.getAttribute('r')).toBe('2');
        }
    });
});
