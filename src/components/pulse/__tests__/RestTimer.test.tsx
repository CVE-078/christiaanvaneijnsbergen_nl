import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../RestTimer';

beforeEach(() => {
    localStorage.clear();
});

describe('RestTimer', () => {
    it('does not start a countdown on mount when trigger is already > 0 (no phantom timer)', () => {
        // Mounting with a non-zero trigger (e.g. the rail timer remounting after a
        // finished session) must not start a countdown; only a trigger change does.
        render(<RestTimer trigger={5} duration={120} />);
        expect(screen.queryByText('2:00')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
    });

    it('persists selected duration to localStorage when changed', async () => {
        const { rerender } = render(<RestTimer trigger={0} />);
        rerender(<RestTimer trigger={1} />); // a trigger change starts the countdown (mount alone does not)
        // The duration button label is "Rest duration: 90s. Click to change." matches /rest duration/i
        const durationBtn = screen.getByRole('button', { name: /rest duration/i });
        await userEvent.click(durationBtn); // cycles to next index
        const stored = Number(localStorage.getItem('pulse_timer_idx'));
        expect(stored).toBeGreaterThanOrEqual(0);
        expect(stored).toBeLessThan(4); // DURATIONS has 4 entries
    });

    it('reads persisted duration from localStorage on mount', () => {
        localStorage.setItem('pulse_timer_idx', '3'); // index 3 = 180s = "3:00"
        const { rerender } = render(<RestTimer trigger={0} />);
        rerender(<RestTimer trigger={1} />);
        expect(screen.getByText('3:00')).toBeInTheDocument();
    });

    it('starts at the provided duration when duration prop is given', () => {
        const { rerender } = render(<RestTimer trigger={0} duration={120} />);
        rerender(<RestTimer trigger={1} duration={120} />);
        expect(screen.getByText('2:00')).toBeInTheDocument();
    });

    it('calls onComplete once when the countdown reaches 0', () => {
        vi.useFakeTimers();
        const onComplete = vi.fn();
        const { rerender } = render(<RestTimer trigger={0} duration={2} onComplete={onComplete} />);
        rerender(<RestTimer trigger={1} duration={2} onComplete={onComplete} />);
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

    it('recomputes remaining from the wall clock after the tab was suspended (phone lock)', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-06T00:00:00Z'));
        const { rerender } = render(<RestTimer trigger={0} duration={120} />);
        rerender(<RestTimer trigger={1} duration={120} />);
        expect(screen.getByText('2:00')).toBeInTheDocument();
        // Phone locks for 90s: the wall clock advances but background timers don't fire.
        act(() => {
            vi.setSystemTime(new Date('2026-06-06T00:01:30Z'));
            window.dispatchEvent(new Event('focus'));
        });
        // A naive per-second decrement would still read ~2:00; a wall-clock timer jumps to 0:30.
        expect(screen.getByText('0:30')).toBeInTheDocument();
        vi.useRealTimers();
    });
});
