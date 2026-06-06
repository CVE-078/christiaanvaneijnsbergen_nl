import { describe, it, expect } from 'vitest';
import { computeHistoryBundle } from '../historyBundle';
import { logKey } from '../utils';
import type { Logs, RoutineExercise } from '../types';

// historyBundle.muscleVolume is the REAL production path for the Progress bars
// (computePerMuscleVolume in utils is the tested twin). This guards that the inline
// fractional attribution here stays aligned with the shared bucketing rule.
describe('computeHistoryBundle, muscleVolume fractional attribution', () => {
    const UUID = '550e8400-e29b-41d4-a716-446655440000';
    const re = [
        { id: UUID, workout_type: 'push', exercise: { category: 'chest', movement_pattern: 'horizontal_push' } },
    ] as unknown as RoutineExercise[];

    it('credits the pattern secondaries on top of the primary for the active week', () => {
        const logs: Logs = {
            [logKey(1, UUID, 0)]: { kg: 60, reps: 8, rir: 2, saved: true },
            [logKey(1, UUID, 1)]: { kg: 60, reps: 8, rir: 2, saved: true },
        };
        const bundle = computeHistoryBundle(logs, re, re, 1);
        expect(bundle.muscleVolume.chest).toBe(2); // primary 1.0 x2
        expect(bundle.muscleVolume.triceps).toBe(1); // secondary 0.5 x2
        expect(bundle.muscleVolume.shoulders).toBe(1); // secondary 0.5 x2
    });

    it('falls back to primary-only when the exercise has no movement_pattern', () => {
        const reNoPattern = [
            { id: UUID, workout_type: 'push', exercise: { category: 'chest' } },
        ] as unknown as RoutineExercise[];
        const logs: Logs = { [logKey(1, UUID, 0)]: { kg: 60, reps: 8, rir: 2, saved: true } };
        const bundle = computeHistoryBundle(logs, reNoPattern, reNoPattern, 1);
        expect(bundle.muscleVolume.chest).toBe(1);
        expect(bundle.muscleVolume.triceps ?? 0).toBe(0);
    });
});
