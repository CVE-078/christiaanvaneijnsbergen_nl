import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    logBodyMeasurement: vi.fn().mockResolvedValue(undefined),
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
    it('renders the measurements heading and all four field labels', () => {
        render(<MeasurementsCard />);
        expect(screen.getByText('Measurements')).toBeInTheDocument();
        expect(screen.getByText(/waist/i)).toBeInTheDocument();
        expect(screen.getByText(/hips/i)).toBeInTheDocument();
        expect(screen.getByText(/chest/i)).toBeInTheDocument();
        expect(screen.getByText(/arms/i)).toBeInTheDocument();
    });

    it('renders the latest measurement readout and converts it when unit is in', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            profile: { length_unit: 'in' as const },
            bodyMeasurements: [
                {
                    id: 'm1',
                    measured_at: '2026-06-01',
                    waist_cm: 81,
                    hips_cm: 99,
                    chest_cm: 106,
                    arms_cm: 39,
                },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        // 81 cm -> 31.9 in
        expect(screen.getByText(/31\.9 in/)).toBeInTheDocument();
        // 99 cm -> 39 in (39.0 rounds to 39)
        expect(screen.getByText(/^39 in$/)).toBeInTheDocument();
    });

    it('renders measurement readout in cm with em-dash for missing values', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyMeasurements: [
                {
                    id: 'm1',
                    measured_at: '2026-06-01',
                    waist_cm: 81,
                    hips_cm: null,
                    chest_cm: null,
                    arms_cm: null,
                },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<MeasurementsCard />);
        expect(screen.getByText(/81 cm/)).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBe(3);
    });

    it('calls updateLengthUnit when the "in" unit toggle is clicked', async () => {
        render(<MeasurementsCard />);
        await userEvent.click(screen.getByRole('button', { name: /^in$/i }));
        expect(mockUpdateLengthUnit).toHaveBeenCalledWith('in');
    });

    it('shows the log form when the "+ Log" button is clicked', async () => {
        render(<MeasurementsCard />);
        await userEvent.click(screen.getByRole('button', { name: /\+ log/i }));
        expect(screen.getByRole('spinbutton', { name: /waist in cm/i })).toBeInTheDocument();
    });
});
