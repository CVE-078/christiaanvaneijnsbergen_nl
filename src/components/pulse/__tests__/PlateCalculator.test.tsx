import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlateCalculator from '../PlateCalculator';

describe('PlateCalculator', () => {
    it('renders per-side plate chips for the default barbell', () => {
        // 100 kg barbell -> 40 per side -> [25, 15]
        render(<PlateCalculator targetKg={100} unit="kg" />);
        expect(screen.getByText(/per side/i)).toBeInTheDocument();
        expect(screen.getByText(/25 kg/)).toBeInTheDocument();
        expect(screen.getByText(/15 kg/)).toBeInTheDocument();
    });

    it('switches to dumbbell with the toggle and recomputes', async () => {
        // 12.5 kg dumbbell on a 2.5 handle -> 5 per side -> [5]
        render(<PlateCalculator targetKg={12.5} unit="kg" />);
        // Below the 20 kg bar, so barbell shows the empty-bar note.
        expect(screen.getByText(/below the empty bar/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /dumbbell/i }));
        expect(screen.getByText(/per side/i)).toBeInTheDocument();
        expect(screen.getByText(/^5 kg$/)).toBeInTheDocument();
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
});
