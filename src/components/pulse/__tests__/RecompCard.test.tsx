import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RecompCard from '@/components/pulse/RecompCard';
import type { RecompReadout } from '@/lib/pulse/types';

describe('RecompCard', () => {
    it('renders the recomping verdict, labels and deltas', () => {
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
        render(<RecompCard readout={readout} unit="kg" />);

        expect(screen.getByText(readout.verdict)).toBeInTheDocument();
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
        render(<RecompCard readout={readout} unit="kg" />);

        expect(screen.getByText('Keep logging to see your recomp trend.')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(3);
    });
});
