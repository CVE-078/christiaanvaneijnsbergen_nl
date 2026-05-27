import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogView from '../views/LogView';
import type { RoutineExercise } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const mockRE: RoutineExercise = {
    id: 're-test-uuid',
    routine_id: 'r1',
    exercise_id: 'ex-1',
    workout_type: 'chest',
    order: 0,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    exercise: {
        id: 'ex-1',
        name: 'Bench Press',
        category: 'chest',
        default_sets: '3',
        default_reps: '8-12',
        user_id: null,
    },
};

const navigate = vi.fn();

const defaultContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    activeTab: 'chest' as const,
    setActiveTab: vi.fn(),
    activeSchedule: [],
    logs: {},
    profile: { display_name: null, unit: 'kg' as const, active_routine_id: 'r1' },
    prMap: {},
    activeRoutine: { id: 'r1', user_id: 'u1', name: 'Push Day', created_at: '', exercises: [mockRE] },
    routineExercisesByType: { push: [], pull: [], legs: [], chest: [mockRE], back: [], shoulders: [], arms: [] },
    navigate,
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    fireTrigger: vi.fn(),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
});

describe('LogView', () => {
    it('shows the no-routine onboarding state when activeRoutine is null', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: null,
        } as unknown as ReturnType<typeof usePulse>);
        const { default: userEvent } = await import('@testing-library/user-event');
        render(<LogView />);
        expect(screen.getByText(/no routine active/i)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /go to library/i }));
        expect(navigate).toHaveBeenCalledWith('explore');
    });

    it('shows an empty state hint when no sets are logged for the current week', () => {
        render(<LogView />);
        expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
    });

    it('hides the empty state hint when at least one set is logged', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: { '1-re-test-uuid-0': { kg: 60, reps: 10, rir: 3, saved: true } },
        } as unknown as ReturnType<typeof usePulse>);
        render(<LogView />);
        expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
    });
});
