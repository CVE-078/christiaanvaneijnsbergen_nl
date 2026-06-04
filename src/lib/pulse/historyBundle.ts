import { calcE1RM, parseLogKey } from './utils';
import type {
    Logs,
    HistorySession,
    BestSet,
    RoutineExercise,
    WorkoutType,
    ExerciseCategory,
} from './types';

export interface HistoryBundle {
    // buildHistory(logs)
    sessions: HistorySession[];
    // computeVolumeByTypeAndWeek(logs, allRoutineExercises)
    volByWeek: Record<number, Partial<Record<WorkoutType, number>>>;
    // computeBestSets(logs)
    bestSets: Record<string, BestSet>;
    // computePerMuscleVolume(logs, activeRoutineExercises, activeWeek)
    muscleVolume: Partial<Record<ExerciseCategory, number>>;
    // default-exercise scan (most-logged routine exercise id)
    defaultExerciseId: string | null;
}

// Single-pass replacement for the five independent Object.entries(logs) scans
// HistoryView used to run (buildHistory, computeVolumeByTypeAndWeek,
// computeBestSets, computePerMuscleVolume, default-exercise scan). Walks logs
// once, accumulating every per-week / per-exercise bucket, and returns exactly
// the same shapes those helpers produced. The per-exercise e1RM history stays a
// separate memo in the view because it is keyed on a user-selected exercise id,
// not on logs alone.
//
// Reuses the pure helpers (parseLogKey, calcE1RM) read-only; does not touch utils.
export function computeHistoryBundle(
    logs: Logs,
    allRoutineExercises: RoutineExercise[],
    activeRoutineExercises: RoutineExercise[],
    activeWeek: number,
): HistoryBundle {
    // Lookup maps mirroring computeVolumeByTypeAndWeek / computePerMuscleVolume.
    const typeById = new Map<string, WorkoutType>(allRoutineExercises.map((re) => [re.id, re.workout_type]));
    const catById = new Map<string, ExerciseCategory>();
    for (const re of activeRoutineExercises) {
        if (re.exercise?.category) catById.set(re.id, re.exercise.category);
    }

    const sessionsByWeek: Record<string, HistorySession> = {};
    const volByWeek: Record<number, Partial<Record<WorkoutType, number>>> = {};
    const bestSets: Record<string, BestSet> = {};
    const muscleVolume: Partial<Record<ExerciseCategory, number>> = {};
    const counts: Record<string, number> = {};

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId, setIdx } = parsed;

        // buildHistory: group sets by week (iteration order preserved)
        const sessionKey = String(week);
        if (!sessionsByWeek[sessionKey]) {
            sessionsByWeek[sessionKey] = { week, sets: [] };
        }
        sessionsByWeek[sessionKey].sets.push({ routineExerciseId, setIdx, ...val });

        // computeVolumeByTypeAndWeek
        const wt = typeById.get(routineExerciseId);
        if (wt) {
            if (!volByWeek[week]) volByWeek[week] = {};
            volByWeek[week][wt] = (volByWeek[week][wt] ?? 0) + 1;
        }

        // computeBestSets
        const e1rm = calcE1RM(val.kg, val.reps);
        const currentBest = bestSets[routineExerciseId];
        if (!currentBest || e1rm > currentBest.e1rm) {
            bestSets[routineExerciseId] = {
                routineExerciseId,
                week,
                kg: val.kg,
                reps: val.reps,
                e1rm,
            };
        }

        // computePerMuscleVolume (active week only)
        if (week === activeWeek) {
            const cat = catById.get(routineExerciseId);
            if (cat) muscleVolume[cat] = (muscleVolume[cat] ?? 0) + 1;
        }

        // default-exercise scan: most-logged routine exercise id
        counts[routineExerciseId] = (counts[routineExerciseId] ?? 0) + 1;
    }

    const sessions = Object.values(sessionsByWeek).sort((a, b) => b.week - a.week);
    const defaultExerciseId = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    return { sessions, volByWeek, bestSets, muscleVolume, defaultExerciseId };
}
