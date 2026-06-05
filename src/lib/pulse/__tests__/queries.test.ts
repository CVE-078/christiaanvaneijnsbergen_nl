import { describe, it, expect } from 'vitest';
import { loadLogs, loadProfile, loadBodyweight, loadExercises, loadRoutines, loadNotes, loadSwaps } from '../queries';

// A minimal fake of the chainable Supabase query builder. Every chain method
// returns the same object, and the builder is awaitable so it resolves to
// { data, error }. We record the table and the select string for assertions.
function makeBuilder(result: { data: unknown; error: unknown }) {
    const calls: { table: string; select?: string } = { table: '' };
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = (s: string) => {
        calls.select = s;
        return builder;
    };
    builder.eq = chain;
    builder.or = chain;
    builder.order = chain;
    builder.limit = chain;
    builder.maybeSingle = () => Promise.resolve(result);
    // Awaitable: resolve to the result for queries that don't end in single().
    builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
    return { builder, calls };
}

function makeClient(result: { data: unknown; error: unknown }) {
    const calls: { table: string; select?: string } = { table: '' };
    const client = {
        from(table: string) {
            calls.table = table;
            const { builder, calls: bc } = makeBuilder(result);
            // Forward the select string into the shared calls object.
            const origSelect = builder.select as (s: string) => unknown;
            builder.select = (s: string) => {
                calls.select = s;
                return origSelect(s);
            };
            void bc;
            return builder;
        },
    };
    // The loaders only need the subset above; cast through unknown.
    return { client: client as never, calls };
}

const UID = '11111111-1111-4111-8111-111111111111';
const REID = '22222222-2222-4222-8222-222222222222';

describe('loadLogs', () => {
    it('selects the canonical columns and builds keyed logs', async () => {
        const { client, calls } = makeClient({
            data: [{ week: 3, routine_exercise_id: REID, set_idx: 0, kg: 50, reps: 8, rir: 2, saved: true }],
            error: null,
        });
        const logs = await loadLogs(client, UID);
        expect(calls.table).toBe('set_logs');
        expect(calls.select).toBe('week, routine_exercise_id, set_idx, kg, reps, rir, saved, drops');
        expect(logs[`3-${REID}-0`]).toEqual({ kg: 50, reps: 8, rir: 2, saved: true });
    });

    it('returns empty when validation fails', async () => {
        const { client } = makeClient({
            data: [{ week: 3, routine_exercise_id: 'not-a-uuid', set_idx: 0, kg: 50, reps: 8, rir: 2, saved: true }],
            error: null,
        });
        expect(await loadLogs(client, UID)).toEqual({});
    });

    it('throws on query error', async () => {
        const { client } = makeClient({ data: null, error: new Error('boom') });
        await expect(loadLogs(client, UID)).rejects.toThrow('boom');
    });
});

describe('loadProfile', () => {
    it('selects canonical columns and normalizes the row', async () => {
        const { client, calls } = makeClient({
            data: {
                display_name: 'Sam',
                unit: 'lbs',
                length_unit: 'in',
                active_routine_id: 'r1',
                onboarding_completed: true,
                goal_weight_kg: '80',
                gender: 'female',
                priority_muscle: 'glutes',
            },
            error: null,
        });
        const profile = await loadProfile(client, UID);
        expect(calls.table).toBe('profiles');
        expect(calls.select).toBe(
            'display_name, unit, length_unit, active_routine_id, onboarding_completed, goal_weight_kg, gender, priority_muscle, timezone, accent_color',
        );
        expect(profile).toEqual({
            display_name: 'Sam',
            unit: 'lbs',
            length_unit: 'in',
            active_routine_id: 'r1',
            onboarding_completed: true,
            goal_weight_kg: 80,
            gender: 'female',
            priority_muscle: 'glutes',
            timezone: 'UTC',
            accent_color: null,
        });
    });

    it('applies defaults for a missing row', async () => {
        const { client } = makeClient({ data: null, error: null });
        expect(await loadProfile(client, UID)).toEqual({
            display_name: null,
            unit: 'kg',
            length_unit: 'cm',
            active_routine_id: null,
            onboarding_completed: false,
            goal_weight_kg: null,
            gender: null,
            priority_muscle: null,
            timezone: 'UTC',
            accent_color: null,
        });
    });

    it('maps a valid gender value through', async () => {
        const { client } = makeClient({ data: { gender: 'male' }, error: null });
        expect((await loadProfile(client, UID)).gender).toBe('male');
    });

    it('maps an invalid or missing gender value to null', async () => {
        const invalid = makeClient({ data: { gender: 'other' }, error: null });
        expect((await loadProfile(invalid.client, UID)).gender).toBeNull();
        const missing = makeClient({ data: { display_name: 'Sam' }, error: null });
        expect((await loadProfile(missing.client, UID)).gender).toBeNull();
    });
});

describe('loadBodyweight', () => {
    it('selects canonical columns and maps weight_kg to a number', async () => {
        const { client, calls } = makeClient({
            data: [{ id: 'b1', logged_at: '2026-01-01', weight_kg: '82.5' }],
            error: null,
        });
        const entries = await loadBodyweight(client, UID);
        expect(calls.table).toBe('bodyweight_logs');
        expect(calls.select).toBe('id, logged_at, weight_kg');
        expect(entries).toEqual([{ id: 'b1', logged_at: '2026-01-01', weight_kg: 82.5 }]);
    });
});

describe('loadExercises', () => {
    it('sorts global exercises first, then alphabetically', async () => {
        const { client, calls } = makeClient({
            data: [
                { id: '3', name: 'Curl', category: 'biceps', default_sets: '3', default_reps: '10', user_id: UID },
                { id: '1', name: 'Squat', category: 'legs', default_sets: '3', default_reps: '5', user_id: null },
                { id: '2', name: 'Bench', category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
            ],
            error: null,
        });
        const exercises = await loadExercises(client, UID);
        expect(calls.table).toBe('exercises');
        expect(calls.select).toBe(
            'id, name, category, default_sets, default_reps, user_id, movement_pattern, equipment, is_compound',
        );
        expect(exercises.map((e) => e.name)).toEqual(['Bench', 'Squat', 'Curl']);
    });
});

describe('loadRoutines', () => {
    it('includes rest_seconds in the routine_exercises select', async () => {
        const { client, calls } = makeClient({ data: [], error: null });
        await loadRoutines(client, UID);
        expect(calls.table).toBe('workout_routines');
        expect(calls.select).toContain('rest_seconds');
    });

    it('selects variant on both exercises and schedule so A/B sessions stay separate', async () => {
        // Without the per-exercise variant, A/B sessions collapse into one tab
        // (a 4-day Upper/Lower routine shows 12 exercises per day instead of 6).
        const { client, calls } = makeClient({ data: [], error: null });
        await loadRoutines(client, UID);
        const select = calls.select ?? '';
        const exercisesSelect = select.slice(0, select.indexOf('schedule:routine_schedule'));
        expect(exercisesSelect).toContain('variant');
        expect(select).toContain('schedule:routine_schedule ( day_of_week, workout_type, variant )');
    });

    it('sorts exercises by order and schedule by day_of_week', async () => {
        const { client } = makeClient({
            data: [
                {
                    id: 'r1',
                    user_id: UID,
                    name: 'PPL',
                    created_at: '2026-01-01',
                    exercises: [
                        { id: 'e2', order: 2, rest_seconds: 90 },
                        { id: 'e1', order: 1, rest_seconds: 60 },
                    ],
                    schedule: [
                        { day_of_week: 5, workout_type: 'pull' },
                        { day_of_week: 1, workout_type: 'push' },
                    ],
                },
            ],
            error: null,
        });
        const routines = await loadRoutines(client, UID);
        expect(routines[0].exercises.map((e) => e.id)).toEqual(['e1', 'e2']);
        expect(routines[0].schedule.map((s) => s.day_of_week)).toEqual([1, 5]);
    });
});

describe('loadNotes', () => {
    it('selects canonical columns and keys notes by week-routineExerciseId', async () => {
        const { client, calls } = makeClient({
            data: [{ week: 2, routine_exercise_id: REID, note: 'felt strong' }],
            error: null,
        });
        const notes = await loadNotes(client, UID);
        expect(calls.table).toBe('exercise_notes');
        expect(calls.select).toBe('week, routine_exercise_id, note');
        expect(notes[`2-${REID}`]).toBe('felt strong');
    });
});

describe('loadExercises select', () => {
    it('includes movement_pattern and equipment for swap candidate ranking', async () => {
        const { client, calls } = makeClient({ data: [], error: null });
        await loadExercises(client, UID);
        expect(calls.select).toContain('movement_pattern');
        expect(calls.select).toContain('equipment');
    });
});

describe('loadSwaps', () => {
    it('builds a week-routineExerciseId keyed map of substitute exercise ids', async () => {
        const { client, calls } = makeClient({
            data: [{ week: 4, routine_exercise_id: REID, exercise_id: 'sub-1' }],
            error: null,
        });
        const swaps = await loadSwaps(client, UID);
        expect(calls.table).toBe('exercise_swaps');
        expect(swaps[`4-${REID}`]).toBe('sub-1');
    });
});
