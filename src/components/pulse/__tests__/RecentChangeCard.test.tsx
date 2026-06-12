import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecentChangeCard from '../RecentChangeCard';
import type { RecompReadout } from '@/lib/pulse/types';

const BASE_READOUT: RecompReadout = {
    weight: 'down',
    strength: 'up',
    waist: 'down',
    isRecomping: true,
    verdict: 'On track',
    weightDeltaKg: -2.4,
    strengthDeltaPct: 8,
    waistDeltaCm: -1.2,
};

describe('RecentChangeCard', () => {
    it('renders weight delta in kg', () => {
        render(<RecentChangeCard readout={BASE_READOUT} unit="kg" lengthUnit="cm" weeks={6} />);
        expect(screen.getByText(/2\.4 kg/)).toBeInTheDocument();
    });

    it('renders waist delta in cm', () => {
        render(<RecentChangeCard readout={BASE_READOUT} unit="kg" lengthUnit="cm" weeks={6} />);
        expect(screen.getByText(/1\.2 cm/)).toBeInTheDocument();
    });

    it('renders strength delta as percentage', () => {
        render(<RecentChangeCard readout={BASE_READOUT} unit="kg" lengthUnit="cm" weeks={6} />);
        expect(screen.getByText(/8%/)).toBeInTheDocument();
    });

    it('shows em-dash placeholder when weightDeltaKg is null', () => {
        const readout = { ...BASE_READOUT, weightDeltaKg: null };
        render(<RecentChangeCard readout={readout} unit="kg" lengthUnit="cm" weeks={6} />);
        // Should have at least one em-dash placeholder
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows em-dash placeholder when waistDeltaCm is null', () => {
        const readout = { ...BASE_READOUT, waistDeltaCm: null };
        render(<RecentChangeCard readout={readout} unit="kg" lengthUnit="cm" weeks={6} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows em-dash placeholder when strengthDeltaPct is null', () => {
        const readout = { ...BASE_READOUT, strengthDeltaPct: null };
        render(<RecentChangeCard readout={readout} unit="kg" lengthUnit="cm" weeks={6} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('shows the section title with the week count', () => {
        render(<RecentChangeCard readout={BASE_READOUT} unit="kg" lengthUnit="cm" weeks={6} />);
        expect(screen.getByText(/6 weeks/i)).toBeInTheDocument();
    });

    it('renders field labels Weight, Waist, Lifts', () => {
        render(<RecentChangeCard readout={BASE_READOUT} unit="kg" lengthUnit="cm" weeks={6} />);
        expect(screen.getByText('Weight')).toBeInTheDocument();
        expect(screen.getByText('Waist')).toBeInTheDocument();
        expect(screen.getByText('Lifts')).toBeInTheDocument();
    });
});
