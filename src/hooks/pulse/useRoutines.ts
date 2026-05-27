import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
    createRoutine as serverCreateRoutine,
    deleteRoutine as serverDeleteRoutine,
    setActiveRoutine as serverSetActiveRoutine,
    addExerciseToRoutine as serverAddExerciseToRoutine,
    removeExerciseFromRoutine as serverRemoveExerciseFromRoutine,
    updateRoutineExercise as serverUpdateRoutineExercise,
    reorderRoutineExercises as serverReorderRoutineExercises,
    createExercise as serverCreateExercise,
    updateExercise as serverUpdateExercise,
    deleteExercise as serverDeleteExercise,
    cloneTemplate as serverCloneTemplate,
    completeOnboarding as serverCompleteOnboarding,
} from '@/app/pulse/actions';
import type {
    DbExercise,
    WorkoutType,
    WorkoutRoutine,
    RoutineWithExercises,
    RoutineExercise,
    ExerciseCategory,
} from '@/lib/pulse/types';

const EXERCISES_KEY = '/api/pulse/exercises';
const ROUTINES_KEY = '/api/pulse/routines';
const PROFILE_KEY = '/api/pulse/profile';

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<T>;
}

export function useRoutines(
    initialExercises: DbExercise[],
    initialRoutines: RoutineWithExercises[],
    activeRoutineId: string | null,
) {
    const { mutate: globalMutate } = useSWRConfig();

    const { data: exercises, mutate: mutateExercises } = useSWR<DbExercise[]>(
        EXERCISES_KEY,
        fetcher,
        { fallbackData: initialExercises, revalidateOnFocus: true },
    );

    const { data: routines, mutate: mutateRoutines } = useSWR<RoutineWithExercises[]>(
        ROUTINES_KEY,
        fetcher,
        { fallbackData: initialRoutines, revalidateOnFocus: true },
    );

    const activeRoutine =
        (routines ?? initialRoutines).find((r) => r.id === activeRoutineId) ?? null;

    const createRoutine = useCallback(async (name: string): Promise<WorkoutRoutine> => {
        const routine = await serverCreateRoutine(name);
        await mutateRoutines();
        return routine;
    }, [mutateRoutines]);

    const deleteRoutine = useCallback(async (id: string): Promise<void> => {
        await serverDeleteRoutine(id);
        await mutateRoutines();
        await globalMutate(PROFILE_KEY);
    }, [mutateRoutines, globalMutate]);

    const setActiveRoutine = useCallback(async (routineId: string | null): Promise<void> => {
        await serverSetActiveRoutine(routineId);
        await globalMutate(PROFILE_KEY);
        await mutateRoutines();
    }, [globalMutate, mutateRoutines]);

    const addExerciseToRoutine = useCallback(async (
        routineId: string,
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
        workoutType: WorkoutType,
    ): Promise<RoutineExercise> => {
        const re = await serverAddExerciseToRoutine(routineId, exerciseId, sets, reps, startingWeightKg, workoutType);
        await mutateRoutines();
        return re;
    }, [mutateRoutines]);

    const removeExerciseFromRoutine = useCallback(async (routineExerciseId: string): Promise<void> => {
        await serverRemoveExerciseFromRoutine(routineExerciseId);
        await mutateRoutines();
    }, [mutateRoutines]);

    const updateRoutineExercise = useCallback(async (
        routineExerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
    ): Promise<void> => {
        await serverUpdateRoutineExercise(routineExerciseId, sets, reps, startingWeightKg);
        await mutateRoutines();
    }, [mutateRoutines]);

    const reorderRoutineExercises = useCallback(async (routineId: string, orderedIds: string[]): Promise<void> => {
        await serverReorderRoutineExercises(routineId, orderedIds);
        await mutateRoutines();
    }, [mutateRoutines]);

    const cloneTemplate = useCallback(async (slug: string): Promise<WorkoutRoutine> => {
        const routine = await serverCloneTemplate(slug);
        await mutateRoutines();
        await globalMutate(PROFILE_KEY);
        return routine;
    }, [mutateRoutines, globalMutate]);

    const completeOnboarding = useCallback(async (): Promise<void> => {
        await serverCompleteOnboarding();
        await globalMutate(PROFILE_KEY);
    }, [globalMutate]);

    const createExercise = useCallback(async (name: string, category: ExerciseCategory, defaultSets: string, defaultReps: string): Promise<DbExercise> => {
        const exercise = await serverCreateExercise(name, category, defaultSets, defaultReps);
        await mutateExercises();
        return exercise;
    }, [mutateExercises]);

    const updateExercise = useCallback(async (id: string, name: string): Promise<void> => {
        await serverUpdateExercise(id, name);
        await mutateExercises();
    }, [mutateExercises]);

    const deleteExercise = useCallback(async (id: string): Promise<void> => {
        await serverDeleteExercise(id);
        await mutateExercises();
    }, [mutateExercises]);

    return {
        exercises: exercises ?? initialExercises,
        routines: routines ?? initialRoutines,
        activeRoutine,
        createRoutine,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
        cloneTemplate,
        completeOnboarding,
        createExercise,
        updateExercise,
        deleteExercise,
    };
}
