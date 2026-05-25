import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogView from '../views/LogView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const defaultContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    activeTab: 'push' as const,
    setActiveTab: vi.fn(),
    logs: {},
    profile: { display_name: null, unit: 'kg' as const },
    prMap: {},
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    fireTrigger: vi.fn(),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as ReturnType<typeof usePulse>);
});

describe('LogView', () => {
    it('shows an empty state hint when no sets are logged for the current week', () => {
        render(<LogView />);
        expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
    });

    it('hides the empty state hint when at least one set is logged', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: { '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true } },
        } as ReturnType<typeof usePulse>);
        render(<LogView />);
        expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
    });
});
