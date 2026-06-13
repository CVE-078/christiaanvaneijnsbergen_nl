import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlockArc from '../BlockArc';

describe('BlockArc', () => {
    it('defaults the caption to the live week, its phase and volume', () => {
        render(<BlockArc weeks={12} currentWeek={6} />);
        expect(screen.getByText(/Week 6/)).toBeInTheDocument();
        // week 6 of the 12-week block: 18 sets, Intensification
        expect(screen.getByText('18 sets')).toBeInTheDocument();
        expect(screen.getByText('RIR')).toBeInTheDocument(); // RIR glossary term in the caption
    });

    it('renders one tappable bar per block week (12)', () => {
        render(<BlockArc weeks={12} currentWeek={6} />);
        expect(screen.getByLabelText(/Week 1,/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Week 12,/)).toBeInTheDocument();
    });

    it('previews another week on tap without claiming to move position', () => {
        render(<BlockArc weeks={12} currentWeek={6} />);
        fireEvent.click(screen.getByLabelText(/Week 9,/));
        expect(screen.getByText(/Week 9/)).toBeInTheDocument();
        expect(screen.getByText('20 sets')).toBeInTheDocument(); // week 9 volume
    });

    it('surfaces the deload glossary term when the deload week is selected', () => {
        render(<BlockArc weeks={12} currentWeek={6} />);
        expect(screen.queryByText('deload')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText(/Week 12,/));
        expect(screen.getByText('deload')).toBeInTheDocument();
        expect(screen.getByText('10 sets')).toBeInTheDocument(); // deload volume
    });

    it('renders the phase legend for the block', () => {
        render(<BlockArc weeks={12} currentWeek={6} />);
        expect(screen.getByText('Accumulation')).toBeInTheDocument();
        expect(screen.getByText('Peak & Deload')).toBeInTheDocument();
    });
});
