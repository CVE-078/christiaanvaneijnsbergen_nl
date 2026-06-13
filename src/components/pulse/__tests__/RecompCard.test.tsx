import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RecompCard from '@/components/pulse/RecompCard';
import type { RecompReadout } from '@/lib/pulse/types';

describe('RecompCard', () => {
    it('renders the status pill, the trimmed verdict detail, labels and deltas', () => {
        const readout: RecompReadout = {
            weight: 'flat',
            strength: 'up',
            waist: 'down',
            isRecomping: true,
            verdict: "You're recomping: strength up, waist down at a steady weight.",
            weightDeltaKg: 0.2,
            strengthDeltaPct: 8,
            waistDeltaCm: -1.5,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);

        // The pill carries the status word; the verdict drops its redundant lead.
        expect(screen.getByText('Recomping')).toBeInTheDocument();
        expect(screen.getByText('Strength up, waist down at a steady weight.')).toBeInTheDocument();
        expect(screen.getByText('Strength')).toBeInTheDocument();
        expect(screen.getByText('Weight')).toBeInTheDocument();
        expect(screen.getByText('Waist')).toBeInTheDocument();
    });

    it('renders the keep-logging verdict and em-dash details when nothing trends', () => {
        const readout: RecompReadout = {
            weight: 'none',
            strength: 'none',
            waist: 'none',
            isRecomping: false,
            verdict: 'Keep logging to see your recomp trend.',
            weightDeltaKg: null,
            strengthDeltaPct: null,
            waistDeltaCm: null,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);

        expect(screen.getByText('Keep logging to see your recomp trend.')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(3);
    });

    it('shows the three evidence tiles instead of a duplicate signed-delta line', () => {
        const readout: RecompReadout = {
            weight: 'down',
            strength: 'up',
            waist: 'down',
            isRecomping: true,
            verdict: "You're recomping, gaining strength while losing fat.",
            weightDeltaKg: -0.6,
            strengthDeltaPct: 5,
            waistDeltaCm: -2.1,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);
        // The tiles carry the deltas; there is no separate "weight -0.6 kg · waist" line.
        expect(screen.getByText('Weight')).toBeInTheDocument();
        expect(screen.getByText('Waist')).toBeInTheDocument();
        expect(screen.queryByText(/weight -0\.6 kg/)).not.toBeInTheDocument();
    });
});
