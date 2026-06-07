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
    exercises: [],
    swaps: {},
    setSwap: vi.fn().mockResolvedValue(undefined),
    clearSwap: vi.fn().mockResolvedValue(undefined),
    hiddenExerciseIds: new Set<string>(),
    workoutModeOpen: false,
    setWorkoutModeOpen: vi.fn(),
    adjustments: [],
    currentWeek: 1,
    programPosition: null,
    regenSuggestion: null,
    lightenThisWeek: vi.fn().mockResolvedValue(undefined),
    refreshSessions: vi.fn(),
    decisions: [],
    routines: [],
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

    it('steps the active week and disables Previous at week 1', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const setActiveWeek = vi.fn();
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeWeek: 1,
            setActiveWeek,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        // At week 1, Previous is disabled; Next advances to week 2.
        expect(screen.getByRole('button', { name: /previous week/i })).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: /next week/i }));
        expect(setActiveWeek).toHaveBeenCalledWith(2);
    });

    it('opens guided mode by setting workoutModeOpen when Start workout is clicked', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const setWorkoutModeOpen = vi.fn();
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            setWorkoutModeOpen,
        } as unknown as ReturnType<typeof usePulse>);
        vi.mocked(useWorkoutSession).mockReturnValue({
            session: null,
            startSession: vi.fn(() => new Promise(() => {})), // never resolves
            completeSession: vi.fn(),
            clearSession: vi.fn(),
        } as unknown as ReturnType<typeof useWorkoutSession>);
        renderWithToast(<LogView />);
        await userEvent.click(screen.getByRole('button', { name: /start workout/i }));
        expect(setWorkoutModeOpen).toHaveBeenCalledWith(true);
    });

    it('renders WorkoutModeScreen when workoutModeOpen is true', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            workoutModeOpen: true,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    // mockRE has 3 sets; logging all three completes the day.
    const fullDayLogs = {
        '1-re-test-uuid-0': { kg: 60, reps: 10, rir: 3, saved: true },
        '1-re-test-uuid-1': { kg: 60, reps: 10, rir: 3, saved: true },
        '1-re-test-uuid-2': { kg: 60, reps: 10, rir: 3, saved: true },
    };

    it('shows the Complete done-state and hides Start workout when the day is fully logged', () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            logs: fullDayLogs,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        expect(screen.getByText(/^complete$/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /re-open/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /clear day/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /start workout/i })).not.toBeInTheDocument();
    });

    it('Re-open opens guided mode without starting a new session', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const setWorkoutModeOpen = vi.fn();
        const startSession = vi.fn();
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            setWorkoutModeOpen,
            logs: fullDayLogs,
        } as unknown as ReturnType<typeof usePulse>);
        vi.mocked(useWorkoutSession).mockReturnValue({
            session: null,
            startSession,
            completeSession: vi.fn(),
            clearSession: vi.fn(),
        } as unknown as ReturnType<typeof useWorkoutSession>);
        renderWithToast(<LogView />);
        await userEvent.click(screen.getByRole('button', { name: /re-open/i }));
        expect(setWorkoutModeOpen).toHaveBeenCalledWith(true);
        expect(startSession).not.toHaveBeenCalled();
    });

    it('Clear day arms a confirm, then clears every logged set for the day', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const deleteLog = vi.fn();
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            deleteLog,
            logs: fullDayLogs,
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        await userEvent.click(screen.getByRole('button', { name: /clear day/i }));
        expect(deleteLog).not.toHaveBeenCalled(); // first click only arms the confirm
        await userEvent.click(screen.getByRole('button', { name: /confirm clear/i }));
        expect(deleteLog).toHaveBeenCalledTimes(3);
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

    it('opens the swap picker when "Swap exercise" is clicked on a solo card', async () => {
        const { default: userEvent } = await import('@testing-library/user-event');
        const swapRE: RoutineExercise = {
            ...mockRE,
            exercise: {
                id: 'ex-1',
                name: 'Bench Press',
                category: 'chest',
                default_sets: '3',
                default_reps: '8-12',
                user_id: null,
                movement_pattern: 'horizontal_push',
                equipment: ['barbell'],
            },
        };
        const altExercise = {
            id: 'ex-2',
            name: 'Dumbbell Press',
            category: 'chest',
            default_sets: '3',
            default_reps: '8-12',
            user_id: null,
            movement_pattern: 'horizontal_push',
            equipment: ['dumbbell'],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            routineExercisesByTabKey: { chest: [swapRE] },
            activeRoutine: { id: 'r1', user_id: 'u1', name: 'Push', created_at: '', exercises: [swapRE] },
            exercises: [swapRE.exercise, altExercise],
        } as unknown as ReturnType<typeof usePulse>);
        renderWithToast(<LogView />);
        // Expand the card, then click the swap control.
        await userEvent.click(screen.getByRole('button', { name: /expand bench press/i }));
        await userEvent.click(screen.getByRole('button', { name: /⇄ swap/i }));
        expect(screen.getByRole('dialog', { name: /swap bench press/i })).toBeInTheDocument();
        expect(screen.getByText('Dumbbell Press')).toBeInTheDocument();
    });
});
