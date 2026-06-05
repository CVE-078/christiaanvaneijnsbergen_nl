import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import RegenNudge from '../RegenNudge';
import { usePulse } from '@/context/PulseContext';
import type { RegenSuggestion } from '@/lib/pulse/types';

const accept = vi.fn().mockResolvedValue(undefined);
const dismiss = vi.fn().mockResolvedValue(undefined);
const setActiveWeek = vi.fn();
const setActiveDay = vi.fn();

function mockCtx(regenSuggestion: RegenSuggestion, activeRoutine: { id: string } | null = { id: 'r1' }) {
    vi.mocked(usePulse).mockReturnValue({
        regenSuggestion,
        activeRoutine,
        acceptReentryDeload: accept,
        dismissReentry: dismiss,
        setActiveWeek,
        setActiveDay,
    } as unknown as ReturnType<typeof usePulse>);
}

beforeEach(() => vi.clearAllMocks());

describe('RegenNudge', () => {
    it('renders nothing when there is no suggestion', () => {
        mockCtx(null);
        const { container } = render(<RegenNudge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing without an active routine', () => {
        mockCtx({ kind: 'reentry_deload', weekInteger: 3, daysAway: 12 }, null);
        const { container } = render(<RegenNudge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('offers a ramp-back and accepts it', async () => {
        mockCtx({ kind: 'reentry_deload', weekInteger: 3, daysAway: 12 });
        render(<RegenNudge />);
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
        expect(screen.getByText(/12 days/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /add ramp-back week/i }));
        expect(accept).toHaveBeenCalledWith('r1', 3, 12);
        expect(setActiveWeek).toHaveBeenCalledWith(3);
    });

    it('dismisses the ramp-back with resume normally', async () => {
        mockCtx({ kind: 'reentry_deload', weekInteger: 3, daysAway: 12 });
        render(<RegenNudge />);
        await userEvent.click(screen.getByRole('button', { name: /resume normally/i }));
        expect(dismiss).toHaveBeenCalledWith('r1', 3);
    });

    it('shows a catch-up prompt and jumps to the missed session', async () => {
        mockCtx({ kind: 'catch_up', missed: [{ day_of_week: 4, workout_type: 'upper', variant: 'B' }] });
        render(<RegenNudge />);
        expect(screen.getByText(/You missed Upper B this week/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /train upper b/i }));
        expect(setActiveDay).toHaveBeenCalledWith(4);
    });

    it('shows a plural heading and a "first" hint for multiple missed sessions', async () => {
        mockCtx({
            kind: 'catch_up',
            missed: [
                { day_of_week: 4, workout_type: 'upper', variant: 'B' },
                { day_of_week: 5, workout_type: 'lower', variant: 'B' },
            ],
        });
        render(<RegenNudge />);
        expect(screen.getByText(/2 sessions still open this week/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /train upper b first/i }));
        expect(setActiveDay).toHaveBeenCalledWith(4);
    });

    it('catch-up can be dismissed for the session', async () => {
        mockCtx({ kind: 'catch_up', missed: [{ day_of_week: 4, workout_type: 'upper', variant: 'B' }] });
        render(<RegenNudge />);
        await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
        expect(screen.queryByText(/You missed Upper B/i)).not.toBeInTheDocument();
    });
});
