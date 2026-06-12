import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import ProgramStatusCard from '@/components/pulse/ProgramStatusCard';

const baseContext = {
    programPosition: {
        status: 'on_track' as const,
        weekInteger: 6,
        calendarWeek: 6,
        behindBy: 0,
    },
    activeRoutine: { program_weeks: 12 },
    // Weekly sets value for "this week" sub-stat
    activeWeek: 6,
    logs: {},
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(baseContext as unknown as ReturnType<typeof usePulse>);
});

describe('ProgramStatusCard', () => {
    it('renders the status pill and week label', () => {
        render(<ProgramStatusCard />);
        expect(screen.getByText('On track')).toBeInTheDocument();
        expect(screen.getByText('Week 6 of 12')).toBeInTheDocument();
    });

    it('renders nothing when programPosition is null', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            programPosition: null,
        } as unknown as ReturnType<typeof usePulse>);
        const { container } = render(<ProgramStatusCard />);
        expect(container.firstChild).toBeNull();
    });

    it('shows the next deload week', () => {
        render(<ProgramStatusCard />);
        // For week 6 of 12, next deload is week 12
        expect(screen.getByText(/deload/i)).toBeInTheDocument();
    });
});
