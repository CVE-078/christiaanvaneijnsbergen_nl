import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../RestTimer';

beforeEach(() => {
    localStorage.clear();
});

describe('RestTimer', () => {
    it('persists selected duration to localStorage when changed', async () => {
        render(<RestTimer trigger={1} />);
        // The duration button label is "Rest duration: 90s. Click to change." â€” matches /rest duration/i
        const durationBtn = screen.getByRole('button', { name: /rest duration/i });
        await userEvent.click(durationBtn); // cycles to next index
        const stored = Number(localStorage.getItem('pulse_timer_idx'));
        expect(stored).toBeGreaterThanOrEqual(0);
        expect(stored).toBeLessThan(4); // DURATIONS has 4 entries
    });

    it('reads persisted duration from localStorage on mount', () => {
        localStorage.setItem('pulse_timer_idx', '3'); // index 3 = 180s = "3:00"
        render(<RestTimer trigger={1} />);
        expect(screen.getByText('3:00')).toBeInTheDocument();
    });

    it('starts at the provided duration when duration prop is given', () => {
        render(<RestTimer trigger={1} duration={120} />);
        expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('calls onComplete once when the countdown reaches 0', () => {
        vi.useFakeTimers();
        const onComplete = vi.fn();
        render(<RestTimer trigger={1} duration={2} onComplete={onComplete} />);
        expect(onComplete).not.toHaveBeenCalled();
        // Advance one second at a time so React re-renders and the effect schedules
        // the next tick between each. 2s reaches 0 and fires the done branch.
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(onComplete).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
