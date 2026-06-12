import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    logBodyMeasurement: vi.fn().mockResolvedValue(undefined),
}));

// MetricLineChart requires >=2 points to render; silence SVG rendering in jsdom.
vi.mock('../MetricLineChart', () => ({
    default: ({ points, unitLabel }: { points: { date: string; value: number }[]; unitLabel: string }) => (
        <div data-testid="metric-line-chart" data-points={points.length} data-unit={unitLabel} />
    ),
}));

import { usePulse } from '@/context/PulseContext';
import MeasurementsCard from '../MeasurementsCard';

const mockRefreshMeasurements = vi.fn();
const mockUpdateLengthUnit = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    profile: { length_unit: 'cm' as const },
    bodyMeasurements: [],
    refreshMeasurements: mockRefreshMeasurements,
    updateLengthUnit: mockUpdateLengthUnit,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    mockRefreshMeasurements.mockClear();
    mockUpdateLengthUnit.mockClear();
});

describe('MeasurementsCard', () => {
    it('renders the measurements heading and all four metric pills', () => {
        render(<MeasurementsCard />);
        expect(screen.getByText('Measurements')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^waist$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^hips$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^chest$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^arms$/i })).toBeInTheDocument();
    });

    it('shows "No entries yet" for the default metric when there are no measurements', () => {
        render(<MeasurementsCard />);
        expect(screen.getByText('No entries yet')).toBeInTheDocument();
    });

    it('shows the selected metric series in the chart and latest entries', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                { id: 'm1', measured_at: '2026-06-01', waist_cm: 80, hips_cm: 99, chest_cm: null, arms_cm: null },
                { id: 'm2', measured_at: '2026-06-08', waist_cm: 79, hips_cm: 100, chest_cm: null, arms_cm: null },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        // Default is Waist; chart should get 2 points
        const chart = screen.getByTestId('metric-line-chart');
        expect(chart).toHaveAttribute('data-points', '2');
        // Latest waist entry: 79 cm (most recent)
        expect(screen.getByText('79 cm')).toBeInTheDocument();
    });

    it('switching the metric picker changes the displayed series', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                { id: 'm1', measured_at: '2026-06-01', waist_cm: 80, hips_cm: 99, chest_cm: null, arms_cm: null },
                { id: 'm2', measured_at: '2026-06-08', waist_cm: 79, hips_cm: 100, chest_cm: null, arms_cm: null },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);

        // Switch to Hips
        await userEvent.click(screen.getByRole('button', { name: /^hips$/i }));

        const chart = screen.getByTestId('metric-line-chart');
        expect(chart).toHaveAttribute('data-points', '2');
        // Latest hips entry: 100 cm
        expect(screen.getByText('100 cm')).toBeInTheDocument();
        // Waist values should NOT be visible in the latest entries list
        expect(screen.queryByText('79 cm')).not.toBeInTheDocument();
    });

    it('converts values to inches when length_unit is in', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { length_unit: 'in' as const },
            bodyMeasurements: [
                { id: 'm1', measured_at: '2026-06-01', waist_cm: 81, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm2', measured_at: '2026-06-08', waist_cm: 82, hips_cm: null, chest_cm: null, arms_cm: null },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        // 82 cm -> 32.3 in
        expect(screen.getByText('32.3 in')).toBeInTheDocument();
    });

    it('tolerates two rows with the same measured_at for a metric (both appear, no crash)', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                { id: 'm1', measured_at: '2026-06-01', waist_cm: 80, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm2', measured_at: '2026-06-01', waist_cm: 81, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm3', measured_at: '2026-06-08', waist_cm: 79, hips_cm: null, chest_cm: null, arms_cm: null },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        // 3 points total (two for 2026-06-01, one for 2026-06-08)
        const chart = screen.getByTestId('metric-line-chart');
        expect(chart).toHaveAttribute('data-points', '3');
        // Latest 3 entries in the list (most recent first): 79, 81, 80
        expect(screen.getByText('79 cm')).toBeInTheDocument();
        expect(screen.getByText('81 cm')).toBeInTheDocument();
        expect(screen.getByText('80 cm')).toBeInTheDocument();
    });

    it('calls updateLengthUnit when the "in" unit toggle is clicked', async () => {
        render(<MeasurementsCard />);
        await userEvent.click(screen.getByRole('button', { name: /^in$/i }));
        expect(mockUpdateLengthUnit).toHaveBeenCalledWith('in');
    });

    it('shows an always-visible inline log bar for the selected metric', () => {
        render(<MeasurementsCard />);
        expect(screen.getByRole('spinbutton', { name: /waist in cm/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();
    });

    it('logs only the selected metric for the chosen date', async () => {
        const { logBodyMeasurement } = await import('@/app/pulse/actions');
        render(<MeasurementsCard />);
        await userEvent.type(screen.getByRole('spinbutton', { name: /waist in cm/i }), '85');
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(logBodyMeasurement).toHaveBeenCalledWith(
            expect.objectContaining({ waist_cm: 85, hips_cm: undefined, chest_cm: undefined, arms_cm: undefined }),
        );
    });

    it('opens the history modal when "Show all" is clicked and shows month headers', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                { id: 'm1', measured_at: '2026-06-01', waist_cm: 80, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm2', measured_at: '2026-06-08', waist_cm: 79, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm3', measured_at: '2026-06-10', waist_cm: 78, hips_cm: null, chest_cm: null, arms_cm: null },
                { id: 'm4', measured_at: '2026-05-20', waist_cm: 82, hips_cm: null, chest_cm: null, arms_cm: null },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        await userEvent.click(screen.getByRole('button', { name: /show all/i }));
        expect(screen.getByText(/June 2026/)).toBeInTheDocument();
        expect(screen.getByText(/May 2026/)).toBeInTheDocument();
    });
});
