import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RpeScale from '../RpeScale';

describe('RpeScale', () => {
    it('renders 1-10 and shows the prompt when nothing is picked', () => {
        render(<RpeScale value={null} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Rate effort 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Rate effort 10' })).toBeInTheDocument();
        expect(screen.getByText(/tap to rate/i)).toBeInTheDocument();
    });
    it('calls onChange with the tapped value', async () => {
        const onChange = vi.fn();
        render(<RpeScale value={null} onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: 'Rate effort 7' }));
        expect(onChange).toHaveBeenCalledWith(7);
    });
    it('shows the read line and marks the selected value when set', () => {
        render(<RpeScale value={7} onChange={() => {}} />);
        expect(screen.getByRole('button', { name: 'Rate effort 7' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(/RPE 7/)).toBeInTheDocument();
    });
});
