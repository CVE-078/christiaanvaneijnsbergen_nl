import type { Logs, WorkoutSession } from './types';
import { parseLogKey } from './utils';

// A single logged set within an exercise.
export interface WorkoutSet {
    kg: number;
    reps: number;
    rir: number;
}

// One exercise within a workout, with its sets and quick aggregates for the
// collapsed row (name + max/avg weight + sets x reps).
export interface WorkoutExercise {
    routineExerciseId: string;
    name: string;
    sets: WorkoutSet[];
    setCount: number;
    maxKg: number;
    avgKg: number;
}

// A real workout: a completed workout_session plus the sets logged in it,
// grouped by exercise. Sourced from workout_sessions (real date/type/duration)
// joined to set_logs via session_id.
export interface Workout {
    id: string;
    date: string; // started_at ISO
    workoutType: string;
    variant: string | null;
    durationMin: number | null;
    setCount: number;
    exercises: WorkoutExercise[];
}

// Duration in whole minutes, or null if not completed / nonsensical.
export function workoutDurationMin(s: { started_at: string; completed_at: string | null }): number | null {
    if (!s.completed_at) return null;
    const ms = Date.parse(s.completed_at) - Date.parse(s.started_at);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return Math.round(ms / 60000);
}

// Assemble completed workout_sessions into per-workout detail using the
// session_id link on each logged set. `nameFor` resolves a routine-exercise id
// (for the set's week, so swaps apply) to a display name. Pure + deterministic;
// returns newest-first, skipping sessions with no linked sets.
export function assembleWorkouts(
    sessions: WorkoutSession[],
    logs: Logs,
    nameFor: (routineExerciseId: string, week: number) => string,
): Workout[] {
    // Bucket every logged set under its session_id.
    const bySession = new Map<
        string,
        Array<{ reId: string; week: number; setIdx: number; kg: number; reps: number; rir: number }>
    >();
    for (const [key, entry] of Object.entries(logs)) {
        const sid = entry.session_id;
        if (!sid) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const arr = bySession.get(sid) ?? [];
        arr.push({
            reId: parsed.routineExerciseId,
            week: parsed.week,
            setIdx: parsed.setIdx,
            kg: entry.kg,
            reps: entry.reps,
            rir: entry.rir,
        });
        bySession.set(sid, arr);
    }

    const workouts: Workout[] = [];
    for (const s of sessions) {
        if (!s.completed_at) continue;
        const raw = bySession.get(s.id);
        if (!raw || raw.length === 0) continue;

        // Group sets by exercise, preserving first-seen order, sets ordered by set_idx.
        const byEx = new Map<string, WorkoutExercise>();
        const order: string[] = [];
        for (const set of [...raw].sort((a, b) => a.setIdx - b.setIdx)) {
            let ex = byEx.get(set.reId);
            if (!ex) {
                ex = {
                    routineExerciseId: set.reId,
                    name: nameFor(set.reId, set.week),
                    sets: [],
                    setCount: 0,
                    maxKg: 0,
                    avgKg: 0,
                };
                byEx.set(set.reId, ex);
                order.push(set.reId);
            }
            ex.sets.push({ kg: set.kg, reps: set.reps, rir: set.rir });
        }

        const exercises = order.map((reId) => {
            const ex = byEx.get(reId)!;
            const kgs = ex.sets.map((x) => x.kg);
            ex.setCount = ex.sets.length;
            ex.maxKg = Math.max(...kgs);
            ex.avgKg = kgs.reduce((a, b) => a + b, 0) / kgs.length;
            return ex;
        });

        workouts.push({
            id: s.id,
            date: s.started_at,
            workoutType: s.workout_type,
            variant: s.variant,
            durationMin: workoutDurationMin(s),
            setCount: raw.length,
            exercises,
        });
    }

    // Newest first.
    workouts.sort((a, b) => (a.date < b.date ? 1 : -1));
    return workouts;
}
