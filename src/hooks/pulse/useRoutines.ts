import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
    createRoutine as serverCreateRoutine,
    renameRoutine as serverRenameRoutine,
    updateRoutineProgramWeeks as serverUpdateRoutineProgramWeeks,
    setProgramAnchor as serverSetProgramAnchor,
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
    generateAndSaveRoutine as serverGenerateRoutine,
    completeOnboarding as serverCompleteOnboarding,
} from '@/app/pulse/actions';
import type {
    DbExercise,
    WorkoutType,
    WorkoutVariant,
    WorkoutRoutine,
    RoutineWithExercises,
    RoutineExercise,
    ExerciseCategory,
    TrainingStyle,
} from '@/lib/pulse/types';
import type { ExperienceLevel, OnboardingAnswers } from '@/lib/pulse/recommendation';
import type { SessionTime } from '@/lib/pulse/types';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';

const EXERCISES_KEY = '/api/pulse/exercises';
const ROUTINES_KEY = '/api/pulse/routines';
const PROFILE_KEY = '/api/pulse/profile';

// Stable empty defaults so the `?? EMPTY` fallbacks keep constant identity across
// renders (otherwise the provider's routinesValue memo and downstream memos churn).
const EMPTY_EXERCISES: DbExercise[] = [];
const EMPTY_ROUTINES: RoutineWithExercises[] = [];

// The exercise library is effectively static within a session (it only changes
// when the user creates/edits/deletes an exercise, which calls mutateExercises
// explicitly). Skip stale revalidation on mount and dedupe aggressively so view
// switches never re-fetch it.
const EXERCISES_READ_OPTS = {
    ...SWR_READ_OPTS,
    revalidateIfStale: false,
    dedupingInterval: 600000,
} as const;

export function useRoutines(activeRoutineId: string | null = null) {
    const { mutate: globalMutate } = useSWRConfig();

    const {
        data: exercises,
        mutate: mutateExercises,
        isLoading: loadingExercises,
        error: exercisesError,
    } = useSWR<DbExercise[]>(EXERCISES_KEY, fetcher, EXERCISES_READ_OPTS);

    const {
        data: routines,
        mutate: mutateRoutines,
        isLoading: loadingRoutines,
        error: routinesError,
    } = useSWR<RoutineWithExercises[]>(ROUTINES_KEY, fetcher, SWR_READ_OPTS);

    const activeRoutine = (routines ?? EMPTY_ROUTINES).find((r) => r.id === activeRoutineId) ?? null;

    const createRoutine = useCallback(
        async (name: string): Promise<WorkoutRoutine> => {
            const routine = await serverCreateRoutine(name);
            await mutateRoutines();
            return routine;
        },
        [mutateRoutines],
    );

    const renameRoutine = useCallback(
        async (id: string, name: string): Promise<void> => {
            // Optimistic: update the name in place, then persist and revalidate.
            await mutateRoutines(
                (prev?: RoutineWithExercises[]) => prev?.map((r) => (r.id === id ? { ...r, name } : r)),
                false,
            );
            await serverRenameRoutine(id, name);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const updateRoutineProgramWeeks = useCallback(
        async (id: string, weeks: number): Promise<void> => {
            await mutateRoutines(
                (prev?: RoutineWithExercises[]) => prev?.map((r) => (r.id === id ? { ...r, program_weeks: weeks } : r)),
                false,
            );
            await serverUpdateRoutineProgramWeeks(id, weeks);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const setProgramAnchor = useCallback(
        async (id: string, anchorISO: string): Promise<void> => {
            await mutateRoutines(
                (prev?: RoutineWithExercises[]) =>
                    prev?.map((r) => (r.id === id ? { ...r, program_anchor: anchorISO } : r)),
                false,
            );
            await serverSetProgramAnchor(id, anchorISO);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const deleteRoutine = useCallback(
        async (id: string): Promise<void> => {
            await serverDeleteRoutine(id);
            await mutateRoutines();
            await globalMutate(PROFILE_KEY);
        },
        [mutateRoutines, globalMutate],
    );

    const setActiveRoutine = useCallback(
        async (routineId: string | null): Promise<void> => {
            await serverSetActiveRoutine(routineId);
            await globalMutate(PROFILE_KEY);
            await mutateRoutines();
        },
        [globalMutate, mutateRoutines],
    );

    const addExerciseToRoutine = useCallback(
        async (
            routineId: string,
            exerciseId: string,
            sets: string,
            reps: string,
            startingWeightKg: number | null,
            workoutType: WorkoutType,
            variant?: WorkoutVariant | null,
        ): Promise<RoutineExercise> => {
            const re = await serverAddExerciseToRoutine(
                routineId,
                exerciseId,
                sets,
                reps,
                startingWeightKg,
                workoutType,
                variant,
            );
            await mutateRoutines();
            return re;
        },
        [mutateRoutines],
    );

    const removeExerciseFromRoutine = useCallback(
        async (routineExerciseId: string): Promise<void> => {
            await serverRemoveExerciseFromRoutine(routineExerciseId);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const updateRoutineExercise = useCallback(
        async (
            routineExerciseId: string,
            sets: string,
            reps: string,
            startingWeightKg: number | null,
            restSeconds: number | null,
        ): Promise<void> => {
            await serverUpdateRoutineExercise(routineExerciseId, sets, reps, startingWeightKg, restSeconds);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const reorderRoutineExercises = useCallback(
        async (routineId: string, orderedIds: string[]): Promise<void> => {
            await serverReorderRoutineExercises(routineId, orderedIds);
            await mutateRoutines();
        },
        [mutateRoutines],
    );

    const cloneTemplate = useCallback(
        async (
            slug: string,
            trainingDays?: number[],
            sessionTime?: string,
            experience?: ExperienceLevel,
        ): Promise<WorkoutRoutine> => {
            const routine = await serverCloneTemplate(slug, trainingDays, sessionTime, experience);
            await mutateRoutines();
            await globalMutate(PROFILE_KEY);
            return routine;
        },
        [mutateRoutines, globalMutate],
    );

    const generateRoutine = useCallback(
        async (
            answers: OnboardingAnswers,
            trainingDays: number[],
            sessionTime: SessionTime,
            styleKey: string,
            name?: string,
            trainingStyle?: TrainingStyle,
        ): Promise<WorkoutRoutine> => {
            const routine = await serverGenerateRoutine(answers, trainingDays, sessionTime, styleKey, name, trainingStyle);
            await mutateRoutines();
            await globalMutate(PROFILE_KEY);
            return routine;
        },
        [mutateRoutines, globalMutate],
    );

    const completeOnboarding = useCallback(async (): Promise<void> => {
        await serverCompleteOnboarding();
        await globalMutate(PROFILE_KEY);
    }, [globalMutate]);

    const createExercise = useCallback(
        async (
            name: string,
            category: ExerciseCategory,
            defaultSets: string,
            defaultReps: string,
        ): Promise<DbExercise> => {
            const exercise = await serverCreateExercise(name, category, defaultSets, defaultReps);
            await mutateExercises();
            return exercise;
        },
        [mutateExercises],
    );

    const updateExercise = useCallback(
        async (id: string, name: string, defaultSets: string, defaultReps: string): Promise<void> => {
            await serverUpdateExercise(id, name, defaultSets, defaultReps);
            await mutateExercises();
        },
        [mutateExercises],
    );

    const deleteExercise = useCallback(
        async (id: string): Promise<void> => {
            await serverDeleteExercise(id);
            await mutateExercises();
        },
        [mutateExercises],
    );

    return {
        exercises: exercises ?? EMPTY_EXERCISES,
        routines: routines ?? EMPTY_ROUTINES,
        activeRoutine,
        loadingExercises,
        loadingRoutines,
        exercisesError,
        routinesError,
        createRoutine,
        renameRoutine,
        updateRoutineProgramWeeks,
        setProgramAnchor,
        deleteRoutine,
        setActiveRoutine,
        addExerciseToRoutine,
        removeExerciseFromRoutine,
        updateRoutineExercise,
        reorderRoutineExercises,
        cloneTemplate,
        generateRoutine,
        completeOnboarding,
        createExercise,
        updateExercise,
        deleteExercise,
    };
}
