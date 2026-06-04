import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryView from '../views/LibraryView';
import type { DbExercise, RoutineWithExercises } from '@/lib/pulse/types';

global.fetch = vi.fn();

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
            variant: null,
            order: 0,
            sets: '3',
            reps: '8-12',
            starting_weight_kg: 60,
            superset_group_id: null,
            exercise: globalExercise,
        },
    ],
    schedule: [],
};

const inactiveRoutine: RoutineWithExercises = {
    id: 'r2',
    user_id: 'user-123',
    name: 'Pull Day',
    created_at: '2026-05-02',
    exercises: [],
    schedule: [],
};

const mocks = {
    createExercise: vi.fn().mockResolvedValue(userExercise),
    updateExercise: vi.fn().mockResolvedValue(undefined),
    deleteExercise: vi.fn().mockResolvedValue(undefined),
    createRoutine: vi.fn().mockResolvedValue(inactiveRoutine),
    renameRoutine: vi.fn().mockResolvedValue(undefined),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
    setActiveRoutine: vi.fn().mockResolvedValue(undefined),
    addExerciseToRoutine: vi.fn().mockResolvedValue(undefined),
    removeExerciseFromRoutine: vi.fn().mockResolvedValue(undefined),
    updateRoutineExercise: vi.fn().mockResolvedValue(undefined),
    reorderRoutineExercises: vi.fn().mockResolvedValue(undefined),
    toggleHideExercise: vi.fn().mockResolvedValue(undefined),
};

const defaultContext = {
    profile: { display_name: null, unit: 'kg' as const, active_routine_id: 'r1' },
    exercises: [globalExercise, userExercise, pullExercise],
    routines: [activeRoutine, inactiveRoutine],
    activeRoutine,
    ...mocks,
    notes: {},
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    hiddenExerciseIds: new Set<string>(),
    timerDuration: null,
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

    it('shows a per-category count badge on each filter chip', () => {
        render(<LibraryView />);
        // Sample library: 2 chest (Bench Press, Cable Fly) + 1 back (Barbell Row) = 3 total.
        expect(within(screen.getByRole('button', { name: 'all' })).getByText('3')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: 'chest' })).getByText('2')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: 'back' })).getByText('1')).toBeInTheDocument();
    });

    it('only shows edit/delete on user exercises', () => {
        render(<LibraryView />);
        // Cable Fly is the only user exercise → its delete button exists
        expect(screen.getByRole('button', { name: /delete cable fly/i })).toBeInTheDocument();
        // Bench Press is global → no delete button
        expect(screen.queryByRole('button', { name: /delete bench press/i })).not.toBeInTheDocument();
    });

    it('hides an exercise via the hide toggle', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /hide bench press/i }));
        expect(mocks.toggleHideExercise).toHaveBeenCalledWith('g1', true);
    });

    it('hides hidden exercises from the list until Show hidden is toggled', async () => {
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            hiddenExerciseIds: new Set(['g1']),
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        // Bench Press (g1) is hidden → not listed by default
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /show hidden/i }));
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        // Now its toggle offers Unhide
        expect(screen.getByRole('button', { name: /unhide bench press/i })).toBeInTheDocument();
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
            expect(mocks.updateExercise).toHaveBeenCalledWith('u1', 'Cable Crossover', '3', '12-15');
        });
    });

    it('shows default sets and reps inputs when editing a user exercise', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /edit cable fly/i }));
        expect(screen.getByLabelText(/default sets/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/default reps/i)).toBeInTheDocument();
    });

    it('calls updateExercise with name, sets, and reps when edit is saved', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('button', { name: /edit cable fly/i }));

        const setsInput = screen.getByLabelText(/default sets/i);
        const repsInput = screen.getByLabelText(/default reps/i);

        await userEvent.clear(setsInput);
        await userEvent.type(setsInput, '4');
        await userEvent.clear(repsInput);
        await userEvent.type(repsInput, '10-15');

        await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

        await waitFor(() => {
            expect(mocks.updateExercise).toHaveBeenCalledWith('u1', 'Cable Fly', '4', '10-15');
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

    it('renames a routine inline', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /rename push day/i }));
        const input = screen.getByRole('textbox', { name: /rename push day/i });
        await userEvent.clear(input);
        await userEvent.type(input, 'Leg Smasher{Enter}');
        await waitFor(() => {
            expect(mocks.renameRoutine).toHaveBeenCalledWith('r1', 'Leg Smasher');
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
            expect(mocks.updateRoutineExercise).toHaveBeenCalledWith('re1', '4', '8-12', 60, null);
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

    it('shows Pair ↓ button when active routine has two adjacent unpaired exercises', async () => {
        const twoExerciseRoutine: RoutineWithExercises = {
            ...activeRoutine,
            exercises: [
                {
                    id: 're1',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'chest' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: 60,
                    superset_group_id: null,
                    exercise: globalExercise,
                },
                {
                    id: 're2',
                    routine_id: 'r1',
                    exercise_id: 'g2',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 1,
                    sets: '4',
                    reps: '6-10',
                    starting_weight_kg: null,
                    superset_group_id: null,
                    exercise: pullExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: twoExerciseRoutine,
            routines: [twoExerciseRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);

        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // First exercise should have "Pair ↓" (it can be paired with the next one)
        expect(screen.getByText('Pair ↓')).toBeInTheDocument();
    });

    it('shows Unpair button on the first exercise of a paired pair', async () => {
        const pairedRoutine: RoutineWithExercises = {
            ...activeRoutine,
            exercises: [
                {
                    id: 're1',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'chest' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: 60,
                    superset_group_id: 'sg1',
                    exercise: globalExercise,
                },
                {
                    id: 're2',
                    routine_id: 'r1',
                    exercise_id: 'g2',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 1,
                    sets: '4',
                    reps: '6-10',
                    starting_weight_kg: null,
                    superset_group_id: 'sg1',
                    exercise: pullExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: pairedRoutine,
            routines: [pairedRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);

        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // Should show exactly one Unpair button (on the first of the pair)
        const unpairButtons = screen.getAllByText('Unpair');
        expect(unpairButtons).toHaveLength(1);
    });

    it('moves a single down past a superset pair as a block', async () => {
        const routine: RoutineWithExercises = {
            ...activeRoutine,
            exercises: [
                {
                    id: 's',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'chest' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: null,
                    exercise: globalExercise,
                },
                {
                    id: 'a',
                    routine_id: 'r1',
                    exercise_id: 'g2',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 1,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: 'sg1',
                    exercise: pullExercise,
                },
                {
                    id: 'b',
                    routine_id: 'r1',
                    exercise_id: 'u1',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 2,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: 'sg1',
                    exercise: userExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: `Move ${globalExercise.name} down` }));
        expect(mocks.reorderRoutineExercises).toHaveBeenCalledWith(expect.any(String), ['a', 'b', 's']);
    });

    it('pairs two adjacent exercises via the supersets API', async () => {
        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
        const routine: RoutineWithExercises = {
            ...activeRoutine,
            exercises: [
                {
                    id: 're1',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'chest' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: null,
                    exercise: globalExercise,
                },
                {
                    id: 're2',
                    routine_id: 'r1',
                    exercise_id: 'g2',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 1,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: null,
                    exercise: pullExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByText('Pair ↓'));
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/pulse/supersets',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ exerciseAId: 're1', exerciseBId: 're2' }),
            }),
        );
    });

    it('unpairs a superset via the supersets API', async () => {
        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
        const routine: RoutineWithExercises = {
            ...activeRoutine,
            exercises: [
                {
                    id: 're1',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'chest' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: 'sg1',
                    exercise: globalExercise,
                },
                {
                    id: 're2',
                    routine_id: 'r1',
                    exercise_id: 'g2',
                    workout_type: 'back' as const,
                    variant: null,
                    order: 1,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: 'sg1',
                    exercise: pullExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByText('Unpair'));
        expect(global.fetch).toHaveBeenCalledWith('/api/pulse/supersets/sg1', { method: 'DELETE' });
    });

    it('groups the routine editor into sessions by workout type and variant', async () => {
        const re = (id: string, type: string, variant: string | null, order: number) => ({
            id,
            routine_id: 'r1',
            exercise_id: 'g1',
            workout_type: type,
            variant,
            order,
            sets: '3',
            reps: '8-12',
            starting_weight_kg: null,
            superset_group_id: null,
            exercise: globalExercise,
        });
        const routine = {
            ...activeRoutine,
            exercises: [
                re('a', 'upper', 'A', 0),
                re('b', 'lower', 'A', 1),
                re('c', 'upper', 'B', 2),
                re('d', 'lower', 'B', 3),
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        expect(screen.getByText('Upper · A')).toBeInTheDocument();
        expect(screen.getByText('Lower · A')).toBeInTheDocument();
        expect(screen.getByText('Upper · B')).toBeInTheDocument();
        expect(screen.getByText('Lower · B')).toBeInTheDocument();
    });

    it('renders a flat list with no session header for a single-session routine', async () => {
        const routine = {
            ...activeRoutine,
            exercises: [
                {
                    id: 're1',
                    routine_id: 'r1',
                    exercise_id: 'g1',
                    workout_type: 'full_body' as const,
                    variant: null,
                    order: 0,
                    sets: '3',
                    reps: '8-12',
                    starting_weight_kg: null,
                    superset_group_id: null,
                    exercise: globalExercise,
                },
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // The exercise row renders, but there is no `Type · Variant` session header.
        expect(screen.getAllByText('Bench Press').length).toBeGreaterThan(0);
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    });

    it('rolls a full-body routine up to Full Body sessions even though exercises are tagged push/pull/legs', async () => {
        // Mirrors a cloned full-body template: schedule is full_body, but the
        // template tags exercises push/pull/legs. Sections must read Full Body,
        // split only by variant — never Push/Pull/Legs.
        const re = (id: string, type: string, variant: string | null, order: number) => ({
            id,
            routine_id: 'r1',
            exercise_id: 'g1',
            workout_type: type,
            variant,
            order,
            sets: '3',
            reps: '8-12',
            starting_weight_kg: null,
            superset_group_id: null,
            exercise: globalExercise,
        });
        const routine = {
            ...activeRoutine,
            schedule: [
                { day_of_week: 1, workout_type: 'full_body' as const },
                { day_of_week: 3, workout_type: 'full_body' as const },
            ],
            exercises: [
                re('a', 'push', 'A', 0),
                re('b', 'pull', 'A', 1),
                re('c', 'legs', 'A', 2),
                re('d', 'push', 'B', 3),
                re('e', 'pull', 'B', 4),
                re('f', 'legs', 'B', 5),
            ],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: routine,
            routines: [routine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        expect(screen.getByText('Full Body · A')).toBeInTheDocument();
        expect(screen.getByText('Full Body · B')).toBeInTheDocument();
        // The granular per-exercise types must not surface as section headers.
        expect(screen.queryByText('Push · A')).not.toBeInTheDocument();
        expect(screen.queryByText('Pull · A')).not.toBeInTheDocument();
        expect(screen.queryByText('Legs · A')).not.toBeInTheDocument();
    });
});
