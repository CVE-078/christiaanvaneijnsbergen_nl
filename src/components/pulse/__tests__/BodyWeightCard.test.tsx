import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    logBodyWeight: vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 }),
}));

import { usePulse } from '@/context/PulseContext';
import BodyWeightCard from '../BodyWeightCard';

const mockLogBodyWeight = vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-05-25', weight_kg: 80 });
const mockDeleteBodyWeight = vi.fn().mockResolvedValue(undefined);

const defaultContext = {
    profile: { unit: 'kg' as const },
    bodyweightLogs: [],
    logBodyWeight: mockLogBodyWeight,
    deleteBodyWeight: mockDeleteBodyWeight,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    mockLogBodyWeight.mockClear();
    mockDeleteBodyWeight.mockClear();
});

describe('BodyWeightCard', () => {
    it('renders the body weight input and log button', () => {
        render(<BodyWeightCard />);
        expect(screen.getByRole('button', { name: /^log$/i })).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /body weight in kg/i })).toBeInTheDocument();
    });

    it('renders a date picker with today as the default', () => {
        render(<BodyWeightCard />);
        const today = new Date().toISOString().split('T')[0];
        const datePicker = screen.getAllByDisplayValue(today);
        expect(datePicker.length).toBeGreaterThan(0);
    });

    it('shows body weight entries in user unit', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }],
        } as unknown as ReturnType<typeof usePulse>);
        render(<BodyWeightCard />);
        expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
    });

    it('shows a downward bodyweight trend chip when the two latest entries decrease', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [
                { id: 'b2', logged_at: '2026-05-15', weight_kg: 79 },
                { id: 'b1', logged_at: '2026-05-01', weight_kg: 81 },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<BodyWeightCard />);
        const chip = screen.getByText(/↓\s*2\s*kg/);
        expect(chip).toBeInTheDocument();
        expect(chip.className).toContain('text-pulse-success');
    });

    it('rounds the bodyweight trend so a float subtraction shows no decimal noise', () => {
        // 80.2 - 79.6 is 0.6000000000000085 in IEEE-754; the chip must read "0.6 kg".
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            bodyweightLogs: [
                { id: 'b2', logged_at: '2026-06-12', weight_kg: 79.6 },
                { id: 'b1', logged_at: '2026-06-11', weight_kg: 80.2 },
            ],
        } as unknown as ReturnType<typeof usePulse>);
        render(<BodyWeightCard />);
        expect(screen.getByText(/↓\s*0\.6\s*kg/)).toBeInTheDocument();
        expect(screen.queryByText(/0\.60000/)).not.toBeInTheDocument();
    });

    it('shows an error when a non-numeric weight is submitted', async () => {
        render(<BodyWeightCard />);
        await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
        expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
    });

    it('shows "No entries yet" when bodyweightLogs is empty', () => {
        render(<BodyWeightCard />);
        expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });
});
