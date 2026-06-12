import { describe, it, expect } from 'vitest';
import { assembleWorkouts, workoutDurationMin } from '../workouts';
import type { Logs, WorkoutSession } from '../types';

const RE1 = '11111111-1111-4111-8111-111111111111';
const RE2 = '22222222-2222-4222-8222-222222222222';
const k = (w: number, re: string, i: number) => `${w}-${re}-${i}`;

const sessions = [
    {
        id: 'sess-1',
        user_id: 'u',
        routine_id: null,
        workout_type: 'upper',
        variant: 'B',
        started_at: '2026-05-29T16:00:00.000Z',
        completed_at: '2026-05-29T17:15:00.000Z',
        session_rpe: null,
        session_note: null,
    },
    {
        id: 'sess-2',
        user_id: 'u',
        routine_id: null,
        workout_type: 'lower',
        variant: 'A',
        started_at: '2026-05-26T16:00:00.000Z',
        completed_at: '2026-05-26T17:00:00.000Z',
        session_rpe: null,
        session_note: null,
    },
] as unknown as WorkoutSession[];

const logs: Logs = {
    [k(5, RE1, 0)]: { kg: 90, reps: 6, rir: 2, saved: true, session_id: 'sess-1' },
    [k(5, RE1, 1)]: { kg: 90, reps: 5, rir: 1, saved: true, session_id: 'sess-1' },
    [k(5, RE2, 0)]: { kg: 110, reps: 5, rir: 2, saved: true, session_id: 'sess-2' },
    [k(5, RE2, 1)]: { kg: 100, reps: 8, rir: 2, saved: true, session_id: 'sess-2' },
    // an unlinked set (no session_id) is ignored entirely
    [k(4, RE1, 0)]: { kg: 80, reps: 8, rir: 3, saved: true, session_id: null },
};

const nameFor = (re: string) => (re === RE1 ? 'Bench Press' : 'Back Squat');

describe('assembleWorkouts', () => {
    it('groups sets by session and exercise, newest first, with aggregates', () => {
        const w = assembleWorkouts(sessions, logs, nameFor);
        expect(w.map((x) => x.id)).toEqual(['sess-1', 'sess-2']); // newest first

        const s1 = w[0];
        expect(s1.workoutType).toBe('upper');
        expect(s1.variant).toBe('B');
        expect(s1.durationMin).toBe(75);
        expect(s1.setCount).toBe(2);
        expect(s1.exercises).toHaveLength(1);
        expect(s1.exercises[0].name).toBe('Bench Press');
        expect(s1.exercises[0].sets).toEqual([
            { kg: 90, reps: 6, rir: 2 },
            { kg: 90, reps: 5, rir: 1 },
        ]);
        expect(s1.exercises[0].maxKg).toBe(90);

        const s2 = w[1];
        expect(s2.exercises[0].name).toBe('Back Squat');
        expect(s2.exercises[0].maxKg).toBe(110);
        expect(s2.exercises[0].avgKg).toBe(105); // (110 + 100) / 2
    });

    it('ignores set logs with no session_id', () => {
        const w = assembleWorkouts(sessions, logs, nameFor);
        const allSets = w.flatMap((x) => x.exercises.flatMap((e) => e.sets));
        expect(allSets).toHaveLength(4);
    });

    it('workoutDurationMin returns null when not completed, minutes otherwise', () => {
        expect(workoutDurationMin({ started_at: '2026-05-29T16:00:00Z', completed_at: null })).toBeNull();
        expect(
            workoutDurationMin({ started_at: '2026-05-29T16:00:00Z', completed_at: '2026-05-29T17:15:00Z' }),
        ).toBe(75);
    });
});
