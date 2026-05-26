import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeekSelector from '../WeekSelector';

describe('WeekSelector', () => {
    it('renders 12 week buttons', () => {
        render(<WeekSelector activeWeek={1} onSelect={vi.fn()} logs={{}} />);
        for (let w = 1; w <= 12; w++) {
            expect(screen.getByRole('button', { name: String(w) })).toBeInTheDocument();
        }
    });

    it('calls onSelect with the clicked week number', async () => {
        const onSelect = vi.fn();
        render(<WeekSelector activeWeek={1} onSelect={onSelect} logs={{}} />);
        await userEvent.click(screen.getByRole('button', { name: '5' }));
        expect(onSelect).toHaveBeenCalledWith(5);
    });

    it('applies a distinct class to the active week button', () => {
        render(<WeekSelector activeWeek={3} onSelect={vi.fn()} logs={{}} />);
        const activeBtn = screen.getByRole('button', { name: '3' }) as HTMLElement;
        const inactiveBtn = screen.getByRole('button', { name: '1' }) as HTMLElement;
        expect(activeBtn.className).not.toBe(inactiveBtn.className);
    });
});
