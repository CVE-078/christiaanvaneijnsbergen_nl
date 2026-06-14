import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({
    default: vi.fn(),
    useSWRConfig: vi.fn(() => ({ mutate: globalMutate })),
}));

vi.mock('@/app/pulse/actions', () => ({
    createRoutine: vi.fn(),
    deleteRoutine: vi.fn().mockResolvedValue(undefined),
    setActiveRoutine: vi.fn().mockResolvedValue(undefined),
    addExerciseToRoutine: vi.fn(),
    removeExerciseFromRoutine: vi.fn().mockResolvedValue(undefined),
    updateRoutineExercise: vi.fn().mockResolvedValue(undefined),
    reorderRoutineExercises: vi.fn().mockResolvedValue(undefined),
    createExercise: vi.fn(),
    updateExercise: vi.fn().mockResolvedValue(undefined),
    deleteExercise: vi.fn().mockResolvedValue(undefined),
}));

import useSWR, { useSWRConfig } from 'swr';
import {
    createRoutine as serverCreateRoutine,
    setActiveRoutine as serverSetActiveRoutine,
    deleteRoutine as serverDeleteRoutine,
    addExerciseToRoutine as serverAddExerciseToRoutine,
    removeExerciseFromRoutine as serverRemoveExerciseFromRoutine,
    updateRoutineExercise as serverUpdateRoutineExercise,
    reorderRoutineExercises as serverReorderRoutineExercises,
    createExercise as serverCreateExercise,
    updateExercise as serverUpdateExercise,
    deleteExercise as serverDeleteExercise,
} from '@/app/pulse/actions';
import { useRoutines } from '../useRoutines';
import type { DbExercise, RoutineWithExercises, WorkoutRoutine, RoutineExercise } from '@/lib/pulse/types';

// Top-level mock so the vi.mock factory can reference it
const globalMutate = vi.fn().mockResolvedValue(undefined);

const exercisesMutate = vi.fn().mockResolvedValue(undefined);
const routinesMutate = vi.fn().mockResolvedValue(undefined);

const defaultExercises: DbExercise[] = [
    { id: 'ex-1', name: 'Bench Press', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
];

const defaultRoutine: RoutineWithExercises = {
    id: 'r-1',
    user_id: 'u-1',
    name: 'PPL',
    created_at: '2026-01-01T00:00:00Z',
    exercises: [],
    schedule: [],
};

const defaultRoutines: RoutineWithExercises[] = [defaultRoutine];

function setupSWRMocks(
    exercisesData: DbExercise[] | undefined = defaultExercises,
    routinesData: RoutineWithExercises[] | undefined = defaultRoutines,
) {
    vi.mocked(useSWR)
        .mockReturnValueOnce({ data: exercisesData, mutate: exercisesMutate } as unknown as ReturnType<typeof useSWR>)
        .mockReturnValueOnce({ data: routinesData, mutate: routinesMutate } as unknown as ReturnType<typeof useSWR>);
}

beforeEach(() => {
    vi.mocked(useSWRConfig).mockReturnValue({ mutate: globalMutate } as unknown as ReturnType<typeof useSWRConfig>);
    setupSWRMocks();
    globalMutate.mockClear();
    exercisesMutate.mockClear();
    routinesMutate.mockClear();
    vi.mocked(serverCreateRoutine).mockClear();
    vi.mocked(serverSetActiveRoutine).mockClear();
    vi.mocked(serverDeleteRoutine).mockClear();
    vi.mocked(serverAddExerciseToRoutine).mockClear();
    vi.mocked(serverRemoveExerciseFromRoutine).mockClear();
    vi.mocked(serverUpdateRoutineExercise).mockClear();
    vi.mocked(serverReorderRoutineExercises).mockClear();
    vi.mocked(serverCreateExercise).mockClear();
    vi.mocked(serverUpdateExercise).mockClear();
    vi.mocked(serverDeleteExercise).mockClear();
});

describe('useRoutines', () => {
    it('returns exercises from SWR data', () => {
        const { result } = renderHook(() => useRoutines(null));
        expect(result.current.exercises).toEqual(defaultExercises);
    });

    it('defaults to an empty exercise list when SWR data is undefined', () => {
        vi.mocked(useSWR).mockReset();
        // exercises SWR returns undefined data
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: undefined, mutate: exercisesMutate } as unknown as ReturnType<typeof useSWR>)
            // routines SWR returns normal data
            .mockReturnValueOnce({ data: defaultRoutines, mutate: routinesMutate } as unknown as ReturnType<
                typeof useSWR
            >);

        const { result } = renderHook(() => useRoutines(null));
        // initial props are only SWR fallbackData now; no resolved data -> empty.
        expect(result.current.exercises).toEqual([]);
    });

    it('returns routines from SWR data', () => {
        const { result } = renderHook(() => useRoutines(null));
        expect(result.current.routines).toEqual(defaultRoutines);
    });

    it('derives activeRoutine from routines + activeRoutineId', () => {
        const { result } = renderHook(() => useRoutines('r-1'));
        expect(result.current.activeRoutine).toEqual(defaultRoutine);
    });

    it('returns null activeRoutine when activeRoutineId does not match', () => {
        const { result } = renderHook(() => useRoutines('r-999'));
        expect(result.current.activeRoutine).toBeNull();
    });

    it('returns null activeRoutine when activeRoutineId is null', () => {
        const { result } = renderHook(() => useRoutines(null));
        expect(result.current.activeRoutine).toBeNull();
    });

    it('createRoutine calls server action and revalidates routines', async () => {
        const newRoutine: WorkoutRoutine = {
            id: 'r-2',
            user_id: 'u-1',
            name: 'Upper/Lower',
            created_at: '2026-01-02T00:00:00Z',
        };
        vi.mocked(serverCreateRoutine).mockResolvedValueOnce(newRoutine);

        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            const returned = await result.current.createRoutine('Upper/Lower');
            expect(returned).toEqual(newRoutine);
        });

        expect(serverCreateRoutine).toHaveBeenCalledWith('Upper/Lower');
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('setActiveRoutine calls server action and revalidates profile and routines', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.setActiveRoutine('r-1');
        });

        expect(serverSetActiveRoutine).toHaveBeenCalledWith('r-1');
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('setActiveRoutine accepts null to clear active routine', async () => {
        const { result } = renderHook(() => useRoutines('r-1'));

        await act(async () => {
            await result.current.setActiveRoutine(null);
        });

        expect(serverSetActiveRoutine).toHaveBeenCalledWith(null);
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
    });

    it('deleteRoutine calls server action, revalidates routines and profile', async () => {
        const { result } = renderHook(() => useRoutines('r-1'));

        await act(async () => {
            await result.current.deleteRoutine('r-1');
        });

        expect(serverDeleteRoutine).toHaveBeenCalledWith('r-1');
        expect(routinesMutate).toHaveBeenCalled();
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
    });

    it('addExerciseToRoutine calls server action and revalidates routines', async () => {
        const newRoutineExercise: RoutineExercise = {
            id: 're-1',
            routine_id: 'r-1',
            exercise_id: 'ex-1',
            workout_type: 'push',
            variant: null,
            order: 0,
            sets: '3',
            reps: '8',
            starting_weight_kg: 60,
            superset_group_id: null,
            exercise: defaultExercises[0],
        };
        vi.mocked(serverAddExerciseToRoutine).mockResolvedValueOnce(newRoutineExercise);

        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            const returned = await result.current.addExerciseToRoutine('r-1', 'ex-1', '3', '8', 60, 'push');
            expect(returned).toEqual(newRoutineExercise);
        });

        expect(serverAddExerciseToRoutine).toHaveBeenCalledWith('r-1', 'ex-1', '3', '8', 60, 'push', undefined);
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('removeExerciseFromRoutine calls server action and revalidates routines', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.removeExerciseFromRoutine('re-1');
        });

        expect(serverRemoveExerciseFromRoutine).toHaveBeenCalledWith('re-1');
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('updateRoutineExercise calls server action and revalidates routines', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.updateRoutineExercise('re-1', '4', '10', 80, null);
        });

        expect(serverUpdateRoutineExercise).toHaveBeenCalledWith('re-1', '4', '10', 80, null);
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('reorderRoutineExercises calls server action and revalidates routines', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.reorderRoutineExercises('r-1', ['re-2', 're-1']);
        });

        expect(serverReorderRoutineExercises).toHaveBeenCalledWith('r-1', ['re-2', 're-1']);
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('createExercise calls server action and revalidates exercises', async () => {
        const newExercise: DbExercise = {
            id: 'ex-2',
            name: 'Squat',
            category: 'legs',
            default_sets: '4',
            default_reps: '5',
            user_id: 'u-1',
        };
        vi.mocked(serverCreateExercise).mockResolvedValueOnce(newExercise);

        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            const returned = await result.current.createExercise('Squat', 'legs', '4', '5');
            expect(returned).toEqual(newExercise);
        });

        expect(serverCreateExercise).toHaveBeenCalledWith('Squat', 'legs', '4', '5', undefined);
        expect(exercisesMutate).toHaveBeenCalled();
    });

    it('updateExercise calls server action and revalidates exercises', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.updateExercise('ex-1', 'Incline Bench Press', 'chest', '4', '6-8');
        });

        expect(serverUpdateExercise).toHaveBeenCalledWith('ex-1', 'Incline Bench Press', 'chest', '4', '6-8', undefined);
        expect(exercisesMutate).toHaveBeenCalled();
    });

    it('deleteExercise calls server action and revalidates exercises', async () => {
        const { result } = renderHook(() => useRoutines(null));

        await act(async () => {
            await result.current.deleteExercise('ex-1');
        });

        expect(serverDeleteExercise).toHaveBeenCalledWith('ex-1');
        expect(exercisesMutate).toHaveBeenCalled();
    });
});
