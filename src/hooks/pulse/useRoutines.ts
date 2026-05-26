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
} from '@/app/pulse/actions';
import type {
    DbExercise,
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

    async function createRoutine(name: string): Promise<WorkoutRoutine> {
        const routine = await serverCreateRoutine(name);
        await mutateRoutines();
        return routine;
    }

    async function deleteRoutine(id: string): Promise<void> {
        await serverDeleteRoutine(id);
        await mutateRoutines();
        await globalMutate(PROFILE_KEY);
    }

    async function setActiveRoutine(routineId: string | null): Promise<void> {
        await serverSetActiveRoutine(routineId);
        await globalMutate(PROFILE_KEY);
        await mutateRoutines();
    }

    async function addExerciseToRoutine(
        routineId: string,
        exerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
    ): Promise<RoutineExercise> {
        const re = await serverAddExerciseToRoutine(routineId, exerciseId, sets, reps, startingWeightKg);
        await mutateRoutines();
        return re;
    }

    async function removeExerciseFromRoutine(routineExerciseId: string): Promise<void> {
        await serverRemoveExerciseFromRoutine(routineExerciseId);
        await mutateRoutines();
    }

    async function updateRoutineExercise(
        routineExerciseId: string,
        sets: string,
        reps: string,
        startingWeightKg: number | null,
    ): Promise<void> {
        await serverUpdateRoutineExercise(routineExerciseId, sets, reps, startingWeightKg);
        await mutateRoutines();
    }

    async function reorderRoutineExercises(routineId: string, orderedIds: string[]): Promise<void> {
        await serverReorderRoutineExercises(routineId, orderedIds);
        await mutateRoutines();
    }

    async function createExercise(name: string, category: ExerciseCategory): Promise<DbExercise> {
        const exercise = await serverCreateExercise(name, category);
        await mutateExercises();
        return exercise;
    }

    async function updateExercise(id: string, name: string): Promise<void> {
        await serverUpdateExercise(id, name);
        await mutateExercises();
    }

    async function deleteExercise(id: string): Promise<void> {
        await serverDeleteExercise(id);
        await mutateExercises();
    }

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
        createExercise,
        updateExercise,
        deleteExercise,
    };
}
