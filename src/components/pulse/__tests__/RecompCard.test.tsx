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
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);

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
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);

        expect(screen.getByText('Keep logging to see your recomp trend.')).toBeInTheDocument();
        expect(screen.getAllByText('—')).toHaveLength(3);
    });

    it('renders the evidence line with signed weight and waist deltas', () => {
        const readout: RecompReadout = {
            weight: 'down',
            strength: 'up',
            waist: 'down',
            isRecomping: true,
            verdict: "You're recomping.",
            weightDeltaKg: -0.6,
            strengthDeltaPct: 5,
            waistDeltaCm: -2.1,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);
        expect(screen.getByText(/weight -0\.6 kg/)).toBeInTheDocument();
        expect(screen.getByText(/waist -2\.1 cm/)).toBeInTheDocument();
    });

    it('renders no evidence line when both weight and waist deltas are null', () => {
        const readout: RecompReadout = {
            weight: 'none',
            strength: 'none',
            waist: 'none',
            isRecomping: false,
            verdict: 'Keep logging.',
            weightDeltaKg: null,
            strengthDeltaPct: null,
            waistDeltaCm: null,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);
        // Evidence line should not appear
        expect(screen.queryByText(/weight/)).not.toBeInTheDocument();
        expect(screen.queryByText(/waist -/)).not.toBeInTheDocument();
    });

    it('renders evidence line with only weight when waist delta is null', () => {
        const readout: RecompReadout = {
            weight: 'down',
            strength: 'none',
            waist: 'none',
            isRecomping: false,
            verdict: 'Weight is trending down.',
            weightDeltaKg: -1.2,
            strengthDeltaPct: null,
            waistDeltaCm: null,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);
        expect(screen.getByText(/weight -1\.2 kg/)).toBeInTheDocument();
        expect(screen.queryByText(/waist/)).not.toBeInTheDocument();
    });

    it('prefixes positive weight delta with a plus sign', () => {
        const readout: RecompReadout = {
            weight: 'up',
            strength: 'none',
            waist: 'none',
            isRecomping: false,
            verdict: 'Weight is up.',
            weightDeltaKg: 0.5,
            strengthDeltaPct: null,
            waistDeltaCm: null,
        };
        render(<RecompCard readout={readout} unit="kg" lengthUnit="cm" />);
        expect(screen.getByText(/weight \+0\.5 kg/)).toBeInTheDocument();
    });
});
