import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlateCalculator from '../PlateCalculator';

describe('PlateCalculator', () => {
    it('renders the per-side plate breakdown for the barbell', () => {
        // 100 kg barbell -> 40 per side -> [25, 15]
        render(<PlateCalculator targetKg={100} unit="kg" />);
        expect(screen.getByText(/25 kg/)).toBeInTheDocument();
        expect(screen.getByText(/15 kg/)).toBeInTheDocument();
        expect(screen.getByText(/40 kg per side/)).toBeInTheDocument();
    });

    it('shows a remainder note when the target is not loadable', () => {
        // 61 kg barbell -> 20.5 per side -> [20] with 0.5 remainder
        render(<PlateCalculator targetKg={61} unit="kg" />);
        expect(screen.getByText(/0\.5 kg per side not loadable/i)).toBeInTheDocument();
    });

    it('marks the target as below the empty bar', () => {
        render(<PlateCalculator targetKg={10} unit="kg" />);
        expect(screen.getByText(/below the empty bar/i)).toBeInTheDocument();
    });

    it('calls onClose from the Close button', async () => {
        const onClose = vi.fn();
        render(<PlateCalculator targetKg={100} unit="kg" onClose={onClose} />);
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
