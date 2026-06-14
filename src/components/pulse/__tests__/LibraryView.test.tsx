import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryView from '../views/LibraryView';
import type { DbExercise, RoutineExercise, RoutineWithExercises, WorkoutType, WorkoutVariant } from '@/lib/pulse/types';

global.fetch = vi.fn();

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

// LibraryView reads the active tab from the path and pushes on tab change.
vi.mock('next/navigation', () => ({
    usePathname: () => '/pulse/library',
    useRouter: () => ({ push: vi.fn() }),
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
    toggleFavorite: vi.fn().mockResolvedValue(undefined),
};

const defaultContext = {
    profile: {
        display_name: null,
        unit: 'kg' as const,
        active_routine_id: 'r1',
        active_equipment_profile_id: null,
        timezone: 'Europe/Amsterdam',
        movement_restrictions: [],
    },
    exercises: [globalExercise, userExercise, pullExercise],
    routines: [activeRoutine, inactiveRoutine],
    activeRoutine,
    ...mocks,
    notes: {},
    saveNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    hiddenExerciseIds: new Set<string>(),
    favoriteExerciseIds: new Set<string>(),
    equipmentProfiles: [],
    timerDuration: null,
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
    Object.values(mocks).forEach((m) => m.mockClear());
});

describe('LibraryView', () => {
    it('renders exactly two tabs: Exercises and Routines (no Templates)', () => {
        render(<LibraryView />);
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(2);
        expect(screen.getByRole('tab', { name: /exercises/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /routines/i })).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: /templates/i })).toBeNull();
    });

    it('shows the exercise list on the Exercises tab', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /exercises/i }));
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Cable Fly')).toBeInTheDocument();
        expect(screen.getByText('Barbell Row')).toBeInTheDocument();
    });

    it('filters exercises by category', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /exercises/i }));
        await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
        expect(screen.getByText('Barbell Row')).toBeInTheDocument();
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    });

    it('shows a per-category count badge on each filter chip', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /exercises/i }));
        // Sample library: 2 chest (Bench Press, Cable Fly) + 1 back (Barbell Row) = 3 total.
        expect(within(screen.getByRole('button', { name: 'all' })).getByText('3')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: 'chest' })).getByText('2')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: 'back' })).getByText('1')).toBeInTheDocument();
    });

    it('shows both routines as cards on the Routines tab', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // Each routine renders as a "Manage {name}" card button.
        expect(screen.getByRole('button', { name: /manage push day/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /manage pull day/i })).toBeInTheDocument();
    });

    it('creates an ad-hoc routine from the New routine chooser', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /new routine/i }));
        await userEvent.click(screen.getByRole('button', { name: /ad-hoc routine/i }));
        await userEvent.type(screen.getByLabelText(/routine name/i), 'Leg Day');
        await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
        await waitFor(() => {
            expect(mocks.createRoutine).toHaveBeenCalledWith('Leg Day');
        });
    });

    it('calls setActiveRoutine from the manage sheet', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // Pull Day is the inactive routine (active_routine_id = r1).
        await userEvent.click(screen.getByRole('button', { name: /manage pull day/i }));
        await userEvent.click(screen.getByRole('button', { name: /^set active$/i }));
        await waitFor(() => {
            expect(mocks.setActiveRoutine).toHaveBeenCalledWith('r2');
        });
    });

    it('renames a routine from the manage sheet', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        await userEvent.click(screen.getByRole('button', { name: /rename push day/i }));
        const input = screen.getByRole('textbox', { name: /rename push day/i });
        await userEvent.clear(input);
        await userEvent.type(input, 'Leg Smasher{Enter}');
        await waitFor(() => {
            expect(mocks.renameRoutine).toHaveBeenCalledWith('r1', 'Leg Smasher');
        });
    });

    it('deletes a routine from the manage sheet when the confirm is accepted', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage pull day/i }));
        await userEvent.click(screen.getByRole('button', { name: /delete pull day/i }));
        await waitFor(() => {
            expect(mocks.deleteRoutine).toHaveBeenCalledWith('r2');
        });
    });

    it('adds an exercise to an ad-hoc routine via the inline form (with the type select)', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        // Push Day is ad-hoc (schedule: []), so the manage sheet shows the inline editor.
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        // The ad-hoc add form carries the workout-type select.
        expect(screen.getByLabelText(/workout type/i)).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByLabelText(/^exercise$/i), 'g2');
        await userEvent.click(screen.getByRole('button', { name: /^add$/i }));
        await waitFor(() => {
            // Barbell Row's category 'back' auto-selects workout type 'back'.
            expect(mocks.addExerciseToRoutine).toHaveBeenCalledWith('r1', 'g2', '3', '8-12', null, 'back');
        });
    });

    it('edits a routine exercise (sets) inline in the ad-hoc manage sheet', async () => {
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        await userEvent.click(screen.getByRole('button', { name: /edit bench press/i }));
        const setsInput = screen.getByLabelText(/bench press sets/i);
        await userEvent.clear(setsInput);
        await userEvent.type(setsInput, '4');
        await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
        await waitFor(() => {
            expect(mocks.updateRoutineExercise).toHaveBeenCalledWith('re1', '4', '8-12', 60, null);
        });
    });

    it('opens the session editor for a scheduled routine and reorders within the session as a block', async () => {
        // A scheduled (chest) routine: three exercises in one rolled-up session,
        // the last two paired. Moving the first down past the pair reorders the
        // whole block. Reorder is reached through the manage sheet -> session editor.
        const scheduledRoutine: RoutineWithExercises = {
            ...activeRoutine,
            schedule: [{ day_of_week: 1, workout_type: 'chest' as const, variant: null }],
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
            activeRoutine: scheduledRoutine,
            routines: [scheduledRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        // All three exercises roll up to one "Chest" session (variant null).
        await userEvent.click(screen.getByRole('button', { name: /edit chest/i }));
        await userEvent.click(screen.getByRole('button', { name: `Move ${globalExercise.name} down` }));
        expect(mocks.reorderRoutineExercises).toHaveBeenCalledWith('r1', ['a', 'b', 's']);
    });

    it('pairs two adjacent exercises in the session editor via the supersets API', async () => {
        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
        const scheduledRoutine: RoutineWithExercises = {
            ...activeRoutine,
            schedule: [{ day_of_week: 1, workout_type: 'chest' as const, variant: null }],
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
            activeRoutine: scheduledRoutine,
            routines: [scheduledRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        await userEvent.click(screen.getByRole('button', { name: /edit chest/i }));
        // First exercise can pair with the next: "Pair {name} with next".
        await userEvent.click(screen.getByRole('button', { name: `Pair ${globalExercise.name} with next` }));
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/pulse/supersets',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ exerciseAId: 're1', exerciseBId: 're2' }),
            }),
        );
    });

    it('unpairs a superset in the session editor via the supersets API', async () => {
        vi.mocked(global.fetch).mockClear();
        vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
        const scheduledRoutine: RoutineWithExercises = {
            ...activeRoutine,
            schedule: [{ day_of_week: 1, workout_type: 'chest' as const, variant: null }],
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
            activeRoutine: scheduledRoutine,
            routines: [scheduledRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        await userEvent.click(screen.getByRole('button', { name: /edit chest/i }));
        // Unpair sits on the first exercise of the pair: "Unpair {name}".
        await userEvent.click(screen.getByRole('button', { name: `Unpair ${globalExercise.name}` }));
        expect(global.fetch).toHaveBeenCalledWith('/api/pulse/supersets/sg1', { method: 'DELETE' });
    });

    it('lists a scheduled routine as session rows in the manage sheet', async () => {
        const re = (id: string, type: WorkoutType, variant: WorkoutVariant | null, order: number): RoutineExercise => ({
            id,
            routine_id: 'r1',
            exercise_id: 'g1',
            workout_type: type,
            variant,
            order,
            sets: '3',
            reps: '8-12',
            starting_weight_kg: null,
            rest_seconds: null,
            superset_group_id: null,
            exercise: globalExercise,
        });
        const scheduledRoutine: RoutineWithExercises = {
            ...activeRoutine,
            schedule: [
                { day_of_week: 1, workout_type: 'upper' as const, variant: 'A' },
                { day_of_week: 3, workout_type: 'lower' as const, variant: 'A' },
                { day_of_week: 5, workout_type: 'upper' as const, variant: 'B' },
            ],
            exercises: [re('a', 'upper', 'A', 0), re('b', 'lower', 'A', 1), re('c', 'upper', 'B', 2)],
        };
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            activeRoutine: scheduledRoutine,
            routines: [scheduledRoutine, inactiveRoutine],
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        // The manage sheet lists each session as an "Edit {SessionLabel}" row.
        expect(screen.getByRole('button', { name: 'Edit Upper A' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit Lower A' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit Upper B' })).toBeInTheDocument();
    });

    it('floats a favorited exercise to the top of the add-exercise picker', async () => {
        // By default the picker lists [Bench Press, Cable Fly, Barbell Row] (order
        // from the exercises array). When Cable Fly ('u1') is favorited it should
        // appear first in the <select> option list. The picker lives in the ad-hoc
        // manage sheet's inline add form.
        vi.mocked(usePulse).mockReturnValue({
            ...defaultContext,
            favoriteExerciseIds: new Set(['u1']),
        } as unknown as ReturnType<typeof usePulse>);
        render(<LibraryView />);
        await userEvent.click(screen.getByRole('tab', { name: /routines/i }));
        await userEvent.click(screen.getByRole('button', { name: /manage push day/i }));
        const select = screen.getByLabelText(/^exercise$/i) as HTMLSelectElement;
        const options = Array.from(select.options)
            .filter((o) => o.value !== '')
            .map((o) => o.text);
        expect(options[0]).toBe('Cable Fly');
    });
});
