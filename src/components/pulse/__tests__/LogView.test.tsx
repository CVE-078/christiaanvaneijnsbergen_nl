import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import LogView from '../views/LogView';
import { ToastProvider } from '@/lib/pulse/toast';
import type { RoutineExercise } from '@/lib/pulse/types';

function renderWithToast(ui: ReactElement) {
    return render(<ToastProvider>{ui}</ToastProvider>);
}

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/hooks/pulse/useWorkoutSession', () => ({
    useWorkoutSession: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import { useWorkoutSession } from '@/hooks/pulse/useWorkoutSession';

const mockRE: RoutineExercise = {
    id: 're-test-uuid',
    routine_id: 'r1',
    exercise_id: 'ex-1',
    workout_type: 'chest',
    variant: null,
    order: 0,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    superset_group_id: null,
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
    routineExercisesByTabKey: { chest: [mockRE] },
    navigate,
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    timerTrigger: 0,
    timerDuration: null,
    fireTrigger: vi.fn(),
    notes: {},
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    vi.mocked(useWorkoutSession).mockReturnValue({
        session: null,
        startSession: vi.fn().mockResolvedValue(undefined),
        completeSession: vi.fn().mockResolvedValue(undefined),
        clearSession: vi.fn(),
    } as unknown as ReturnType<typeof useWorkoutSession>);
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
        expect(screen.getByRole('button', { name: /generate a routine/i })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /browse the library/i }));
        expect(navigate).toHaveBeenCalledWith('library');
    });

    it('shows an empty state hint when no sets are logged for the current week', () => {
        renderWithToast(<LogView />);
        expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
    });

    it('hides the empty state hint when at least one set is logged', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: { '1-re-test-uuid-0': { kg: 60, reps: 10, rir: 3, saved: true } },
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
    });

    it('marks only weeks with saved data in the 12-week strip', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: {
                '1-re-test-uuid-0': { kg: 60, reps: 10, rir: 3, saved: true },
                '3-re-test-uuid-0': { kg: 60, reps: 10, rir: 3, saved: false },
            },
        } as unknown as ReturnType<typeof usePulse>);
        const { container } = renderWithToast(<LogView />);
        const weekButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
            /^\d+$/.test(b.textContent ?? ''),
        );
        const week1 = weekButtons.find((b) => b.textContent === '1');
        const week2 = weekButtons.find((b) => b.textContent === '2');
        const week3 = weekButtons.find((b) => b.textContent === '3');
        // Week 1 has a saved entry -> accent dot.
        expect(week1?.querySelector('.bg-pulse-accent')).toBeTruthy();
        // Week 2 has no entry -> transparent dot.
        expect(week2?.querySelector('.bg-pulse-accent')).toBeFalsy();
        // Week 3 entry is not saved -> transparent dot.
        expect(week3?.querySelector('.bg-pulse-accent')).toBeFalsy();
    });

    it('shows WorkoutModeScreen immediately when Start workout is clicked, before session resolves', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        vi.mocked(useWorkoutSession).mockReturnValue({
            session: null,
            startSession: vi.fn(() => new Promise(() => {})), // never resolves
            completeSession: vi.fn(),
            clearSession: vi.fn(),
        } as unknown as ReturnType<typeof useWorkoutSession>);
        renderWithToast(<LogView />);
        await userEvent.click(screen.getByRole('button', { name: /start workout/i }));
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('renders a SupersetCard when two exercises share a superset_group_id', async () => {
        const reA: RoutineExercise = {
            ...mockRE,
            id: 're-a',
            order: 0,
            superset_group_id: 'grp-1',
            exercise: {
                id: 'ex-a',
                name: 'Bench Press',
                category: 'chest',
                default_sets: '3',
                default_reps: '8-12',
                user_id: null,
            },
        };
        const reB: RoutineExercise = {
            ...mockRE,
            id: 're-b',
            order: 1,
            superset_group_id: 'grp-1',
            exercise: {
                id: 'ex-b',
                name: 'Cable Fly',
                category: 'chest',
                default_sets: '3',
                default_reps: '12-15',
                user_id: null,
            },
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            routineExercisesByTabKey: { chest: [reA, reB] },
            activeRoutine: { id: 'r1', user_id: 'u1', name: 'Push', created_at: '', exercises: [reA, reB] },
        } as unknown as ReturnType<typeof usePulse>);
        render(<LogView />);
        expect(screen.getByText(/superset/i)).toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
    });
});
