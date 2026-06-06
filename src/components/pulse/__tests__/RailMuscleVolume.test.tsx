import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import RailMuscleVolume from '../RailMuscleVolume';
import { usePulse } from '@/context/PulseContext';

function ctx(over: Record<string, unknown> = {}) {
    vi.mocked(usePulse).mockReturnValue({
        logs: {},
        activeRoutine: { id: 'r1', exercises: [] },
        currentWeek: 1,
        profile: { priority_muscle: null },
        ...over,
    } as unknown as ReturnType<typeof usePulse>);
}

beforeEach(() => vi.clearAllMocks());

describe('RailMuscleVolume', () => {
    it('renders nothing without an active routine', () => {
        ctx({ activeRoutine: null });
        const { container } = render(<RailMuscleVolume />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the "This week" heading and one row per targeted muscle', () => {
        ctx();
        render(<RailMuscleVolume />);
        expect(screen.getByText('This week')).toBeInTheDocument();
        // computeVolumeProgress covers every VOLUME_TARGETS category (9), even at 0 sets.
        for (const m of ['Chest', 'Back', 'Legs', 'Shoulders', 'Glutes', 'Biceps', 'Triceps', 'Calves', 'Abs']) {
            expect(screen.getByText(m)).toBeInTheDocument();
        }
    });
});
