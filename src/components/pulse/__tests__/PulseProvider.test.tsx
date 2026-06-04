import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type {
    RoutineExercise,
    RoutineWithExercises,
    ScheduleEntry,
    TabKey,
    WorkoutType,
    WorkoutVariant,
} from '@/lib/pulse/types';

// State shared between the test and the mocked useUIState/useRoutines so we can drive
// activeRoutine and observe activeTab changes the provider makes.
let activeTab: TabKey = 'push';
const setActiveTabSpy = vi.fn((tab: TabKey) => {
    activeTab = tab;
});
let activeRoutine: RoutineWithExercises | null = null;

vi.mock('@/hooks/pulse/useUIState', () => ({
    useUIState: () => ({
        activeWeek: 1,
        setActiveWeek: vi.fn(),
        activeTab,
        setActiveTab: setActiveTabSpy,
    }),
}));

vi.mock('@/hooks/pulse/useRoutines', () => ({
    useRoutines: () => ({
        exercises: [],
        routines: activeRoutine ? [activeRoutine] : [],
        activeRoutine,
        createRoutine: vi.fn(),
        deleteRoutine: vi.fn(),
        setActiveRoutine: vi.fn(),
        addExerciseToRoutine: vi.fn(),
        removeExerciseFromRoutine: vi.fn(),
        updateRoutineExercise: vi.fn(),
        reorderRoutineExercises: vi.fn(),
        cloneTemplate: vi.fn(),
        completeOnboarding: vi.fn(),
        createExercise: vi.fn(),
        updateExercise: vi.fn(),
        deleteExercise: vi.fn(),
    }),
}));

vi.mock('@/hooks/pulse/useWorkoutLogs', () => ({
    useWorkoutLogs: () => ({ logs: {}, updateLog: vi.fn(), deleteLog: vi.fn(), handleExport: vi.fn() }),
}));

vi.mock('@/hooks/pulse/useProfile', () => ({
    useProfile: () => ({
        profile: {
            unit: 'kg',
            display_name: null,
            active_routine_id: null,
            onboarding_completed: true,
            goal_weight_kg: null,
        },
        bodyweightLogs: [],
        updateProfile: vi.fn(),
        logBodyWeight: vi.fn(),
        deleteBodyWeight: vi.fn(),
    }),
}));

vi.mock('@/hooks/pulse/useRestTimer', () => ({
    useRestTimer: () => ({ timerTrigger: 0, timerDuration: null, fireTrigger: vi.fn() }),
}));

vi.mock('@/hooks/pulse/useNotes', () => ({
    useNotes: () => ({ notes: {}, saveNote: vi.fn(), deleteNote: vi.fn() }),
}));

vi.mock('@/lib/pulse/toast', () => ({
    useToast: () => ({ show: vi.fn() }),
}));

import { PulseProvider } from '../PulseProvider';
import { usePulse } from '@/context/PulseContext';

const mockExercise = (
    id: string,
    workoutType: WorkoutType,
    variant: WorkoutVariant | null = null,
): RoutineExercise => ({
    id,
    routine_id: 'r1',
    exercise_id: id,
    workout_type: workoutType,
    variant,
    order: 0,
    sets: '3',
    reps: '8-12',
    starting_weight_kg: null,
    superset_group_id: null,
    exercise: { id, name: `Exercise ${id}`, category: 'chest', default_sets: '3', default_reps: '8-12', user_id: null },
});

const mockRoutine = (exercises: RoutineExercise[], schedule: ScheduleEntry[] = []): RoutineWithExercises => ({
    id: 'r1',
    user_id: 'u1',
    name: 'PPL',
    created_at: '2026-01-01',
    exercises,
    schedule,
});

function Consumer() {
    const ctx = usePulse();
    return (
        <div>
            <span data-testid="active-tab">{ctx.activeTab}</span>
            <span data-testid="has-isloading">{String('isLoading' in ctx)}</span>
        </div>
    );
}

const baseProps = {
    email: 'test@example.com',
    navigate: vi.fn(),
};

beforeEach(() => {
    activeTab = 'push';
    activeRoutine = null;
    setActiveTabSpy.mockClear();
});

describe('PulseProvider', () => {
    it('does not expose isLoading on the context value', () => {
        activeRoutine = mockRoutine([mockExercise('e1', 'push')]);
        render(
            <PulseProvider {...baseProps}>
                <Consumer />
            </PulseProvider>,
        );
        expect(screen.getByTestId('has-isloading').textContent).toBe('false');
    });

    it('does not clamp activeTab when it is already a valid tab', () => {
        activeTab = 'push';
        activeRoutine = mockRoutine([mockExercise('e1', 'push'), mockExercise('e2', 'pull')]);
        render(
            <PulseProvider {...baseProps}>
                <Consumer />
            </PulseProvider>,
        );
        expect(setActiveTabSpy).not.toHaveBeenCalled();
        expect(screen.getByTestId('active-tab').textContent).toBe('push');
    });

    it('clamps activeTab to the first valid tab when the active tab is absent', () => {
        // activeTab defaults to 'push' but the routine only has pull and legs.
        activeRoutine = mockRoutine([mockExercise('e1', 'legs'), mockExercise('e2', 'pull')]);
        render(
            <PulseProvider {...baseProps}>
                <Consumer />
            </PulseProvider>,
        );
        // pull sorts before legs in WORKOUT_TYPE_ORDER, so it becomes the clamp target.
        expect(setActiveTabSpy).toHaveBeenCalledWith('pull');
    });

    it('does not clamp when there are no tabs (empty routine)', () => {
        activeRoutine = null;
        render(
            <PulseProvider {...baseProps}>
                <Consumer />
            </PulseProvider>,
        );
        expect(setActiveTabSpy).not.toHaveBeenCalled();
    });

    it('pins the active tab to today’s scheduled variant (Upper B → upper:B)', () => {
        const today = new Date().getDay();
        // Two upper sessions A/B; today is pinned to B.
        activeRoutine = mockRoutine(
            [mockExercise('e1', 'upper', 'A'), mockExercise('e2', 'upper', 'B')],
            [{ day_of_week: today, workout_type: 'upper', variant: 'B' }],
        );
        render(
            <PulseProvider {...baseProps}>
                <Consumer />
            </PulseProvider>,
        );
        expect(setActiveTabSpy).toHaveBeenCalledWith('upper:B');
    });
});
