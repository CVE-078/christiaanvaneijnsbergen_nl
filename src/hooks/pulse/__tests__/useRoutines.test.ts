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
} from '@/app/pulse/actions';
import { useRoutines } from '../useRoutines';
import type { DbExercise, RoutineWithExercises, WorkoutRoutine } from '@/lib/pulse/types';

// Top-level mock so the vi.mock factory can reference it
const globalMutate = vi.fn().mockResolvedValue(undefined);

const exercisesMutate = vi.fn().mockResolvedValue(undefined);
const routinesMutate = vi.fn().mockResolvedValue(undefined);

const defaultExercises: DbExercise[] = [
    { id: 'ex-1', name: 'Bench Press', category: 'push', default_sets: '3', default_reps: '8', user_id: null },
];

const defaultRoutine: RoutineWithExercises = {
    id: 'r-1',
    user_id: 'u-1',
    name: 'PPL',
    created_at: '2026-01-01T00:00:00Z',
    exercises: [],
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
});

describe('useRoutines', () => {
    it('returns exercises from SWR data', () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));
        expect(result.current.exercises).toEqual(defaultExercises);
    });

    it('falls back to initialExercises when SWR data is undefined', () => {
        setupSWRMocks(undefined, defaultRoutines);
        // Override the default beforeEach setup
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: undefined, mutate: exercisesMutate } as unknown as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: defaultRoutines, mutate: routinesMutate } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));
        expect(result.current.exercises).toEqual(defaultExercises);
    });

    it('returns routines from SWR data', () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));
        expect(result.current.routines).toEqual(defaultRoutines);
    });

    it('derives activeRoutine from routines + activeRoutineId', () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, 'r-1'));
        expect(result.current.activeRoutine).toEqual(defaultRoutine);
    });

    it('returns null activeRoutine when activeRoutineId does not match', () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, 'r-999'));
        expect(result.current.activeRoutine).toBeNull();
    });

    it('returns null activeRoutine when activeRoutineId is null', () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));
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

        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));

        await act(async () => {
            const returned = await result.current.createRoutine('Upper/Lower');
            expect(returned).toEqual(newRoutine);
        });

        expect(serverCreateRoutine).toHaveBeenCalledWith('Upper/Lower');
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('setActiveRoutine calls server action and revalidates profile and routines', async () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, null));

        await act(async () => {
            await result.current.setActiveRoutine('r-1');
        });

        expect(serverSetActiveRoutine).toHaveBeenCalledWith('r-1');
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
        expect(routinesMutate).toHaveBeenCalled();
    });

    it('setActiveRoutine accepts null to clear active routine', async () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, 'r-1'));

        await act(async () => {
            await result.current.setActiveRoutine(null);
        });

        expect(serverSetActiveRoutine).toHaveBeenCalledWith(null);
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
    });

    it('deleteRoutine calls server action, revalidates routines and profile', async () => {
        const { result } = renderHook(() => useRoutines(defaultExercises, defaultRoutines, 'r-1'));

        await act(async () => {
            await result.current.deleteRoutine('r-1');
        });

        expect(serverDeleteRoutine).toHaveBeenCalledWith('r-1');
        expect(routinesMutate).toHaveBeenCalled();
        expect(globalMutate).toHaveBeenCalledWith('/api/pulse/profile');
    });
});
