import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryView from '../views/LibraryView';
import type { DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';

const globalExercise: DbExercise = {
    id: 'g1',
    name: 'Bench Press',
    category: 'chest',
    default_sets: '3',
    default_reps: '8-12',
    user_id: null,
};

const userExercise: DbExercise = {
    id: 'u1',
    name: 'Cable Fly',
    category: 'chest',
    default_sets: '3',
    default_reps: '12-15',
    user_id: 'user-123',
};

const pullExercise: DbExercise = {
    id: 'g2',
    name: 'Barbell Row',
    category: 'back',
    default_sets: '4',
    default_reps: '6-10',
    user_id: null,
};

const activeRoutine: RoutineWithExercises = {
    id: 'r1',
    user_id: 'user-123',
    name: 'Push Day',
    created_at: '2026-05-01',
    exercises: [
        {
            id: 're1',
            routine_id: 'r1',
            exercise_id: 'g1',
            workout_type: 'chest' as const,
            order: 0,
            sets: '3',
            reps: '8-12',
            starting_weight_kg: 60,
            exercise: globalExercise,
        },
    ],
};

const inactiveRoutine: RoutineWithExercises = {
    id: 'r2',
    user_id: 'user-123',
    name: 'Pull Day',
    created_at: '2026-05-02',
    exercises: [],
};

const mocks = {
    createExercise: vi.fn().mockResolvedValue(userExercise),
    updateExercise: vi.fn().mockResolvedValue(undefined),
    deleteExercise: vi.fn().mockResolvedValue(undefined),
    createRoutine: vi.fn().mockResolvedValue(inactiveRoutine),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
    setActiveRoutine: vi.fn().mockResolvedValue(undefined),
    addExerciseToRoutine: vi.fn().mockResolvedValue(undefined),
    removeExerciseFromRoutine: vi.fn().mockResolvedValue(undefined),
    updateRoutineExercise: vi.fn().mockResolvedValue(undefined),
    reorderRoutineExercises: vi.fn().mockResolvedValue(undefined),
};

const defaultContext = {
    profile: { display_name: null, unit: 'kg' as const, active_routine_id: 'r1' },
    exercises: [globalExercise, userExercise, pullExercise],
    routines: [activeRoutine, inactiveRoutine],
    activeRoutine,
    ...mocks,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    Object.values(mocks).forEach((m) => m.mockClear());
});

describe('LibraryView', () => {
    it('renders the Exercises/Routines tab switcher', () => {
        render(<LibraryView />);
        expect(screen.getByRole('tab', { name: /exercises/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /routines/i })).toBeInTheDocument();
    });

    it('shows the exercise list on the Exercises tab', () => {
        render(<LibraryView />);
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
        expect(screen.getByText('Barbell Row')).toBeInTheDocument();
    });

    it('filters exercises by category', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
        expect(screen.getByText('Barbell Row')).toBeInTheDocument();
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    });

    it('only shows edit/delete on user exercises', () => {
        render(<LibraryView />);
        // Cable Fly is the only user exercise → its delete button exists
        expect(screen.getByRole('button', { name: /delete cable fly/i })).toBeInTheDocument();
        // Bench Press is global → no delete button
        expect(screen.queryByRole('button', { name: /delete bench press/i })).not.toBeInTheDocument();
    });

    it('submits the add exercise form correctly', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /\+ add/i }));
        await userEvent.type(screen.getByLabelText(/exercise name/i), 'Incline Press');
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
        await waitFor(() => {
            expect(mocks.createExercise).toHaveBeenCalledWith('Incline Press', 'chest', '3', '8-12');
        });
    });

    it('calls updateExercise when a user exercise is renamed', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /edit cable fly/i }));
        const input = screen.getByLabelText(/rename cable fly/i);
        await userEvent.clear(input);
        await userEvent.type(input, 'Cable Crossover');
        await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
        await waitFor(() => {
            expect(mocks.updateExercise).toHaveBeenCalledWith('u1', 'Cable Crossover');
        });
    });

    it('shows the routine list on the Routines tab', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // "Push Day" appears in both the list and the active-routine header
        expect(screen.getAllByText('Push Day').length).toBeGreaterThan(0);
        expect(screen.getByText('Pull Day')).toBeInTheDocument();
    });

    it('calls setActiveRoutine when Set active is clicked', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /set active/i }));
        await waitFor(() => {
            expect(mocks.setActiveRoutine).toHaveBeenCalledWith('r2');
        });
    });

    it('calls createRoutine when the create form is submitted', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.type(screen.getByLabelText(/routine name/i), 'Leg Day');
        await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
        await waitFor(() => {
            expect(mocks.createRoutine).toHaveBeenCalledWith('Leg Day');
        });
    });

    it('calls addExerciseToRoutine when an exercise is added to the active routine', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.selectOptions(screen.getByLabelText(/^exercise$/i), 'g2');
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
        await waitFor(() => {
            expect(mocks.addExerciseToRoutine).toHaveBeenCalledWith('r1', 'g2', '3', '8-12', null, 'back');
        });
    });

    it('calls updateRoutineExercise with kg value when a routine exercise is edited', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /edit bench press/i }));
        const setsInput = screen.getByLabelText(/bench press sets/i);
        await userEvent.clear(setsInput);
        await userEvent.type(setsInput, '4');
        await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
        await waitFor(() => {
            expect(mocks.updateRoutineExercise).toHaveBeenCalledWith('re1', '4', '8-12', 60);
        });
    });

    it('calls deleteExercise when a user exercise delete is confirmed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /delete cable fly/i }));
        await waitFor(() => {
            expect(mocks.deleteExercise).toHaveBeenCalledWith('u1');
        });
    });

    it('does not call deleteExercise when delete is cancelled', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /delete cable fly/i }));
        expect(mocks.deleteExercise).not.toHaveBeenCalled();
    });

    it('calls deleteRoutine when routine delete is confirmed', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /delete pull day/i }));
        await waitFor(() => {
            expect(mocks.deleteRoutine).toHaveBeenCalledWith('r2');
        });
    });
});
