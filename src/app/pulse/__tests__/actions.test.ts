import { vi, describe, it, expect, beforeEach } from 'vitest';

// A chainable query builder stub. Terminal calls (.single(), .insert(...).select().single())
// resolve via queued results; awaiting the builder itself resolves the next queued result.
type QueuedResult = { data: unknown; error: unknown };

const queue: QueuedResult[] = [];
function nextResult(): QueuedResult {
    return queue.shift() ?? { data: null, error: null };
}

function makeBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const method of ['select', 'eq', 'in', 'order', 'limit', 'update', 'delete', 'upsert']) {
        builder[method] = vi.fn(chain);
    }
    builder.insert = vi.fn(() => builder);
    builder.single = vi.fn(() => Promise.resolve(nextResult()));
    // Allow awaiting the builder directly (e.g. .in(...).eq(...))
    builder.then = (resolve: (v: QueuedResult) => unknown) => resolve(nextResult());
    return builder;
}

const from = vi.fn(() => makeBuilder());
const supabase = { from };

const user = { id: 'user-1' };

vi.mock('@/lib/pulse/auth', () => ({
    getUserOrThrow: vi.fn(async () => ({ supabase, user })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { logBodyMeasurement, addExerciseToRoutine, updateGender } from '../actions';

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_UUID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
    queue.length = 0;
    from.mockClear();
});

describe('logBodyMeasurement validation', () => {
    it('accepts valid finite measurements within range', async () => {
        // insert(...) result is awaited directly
        queue.push({ data: null, error: null });
        await expect(
            logBodyMeasurement({ waist_cm: 80, hips_cm: 95, chest_cm: 100, arms_cm: 35 }),
        ).resolves.toBeUndefined();
    });

    it('rejects a measurement above the sane range', async () => {
        await expect(logBodyMeasurement({ waist_cm: 9000 })).rejects.toThrow('Invalid measurement');
    });

    it('rejects a measurement below the sane range', async () => {
        await expect(logBodyMeasurement({ chest_cm: 0 })).rejects.toThrow('Invalid measurement');
    });

    it('rejects a non-finite measurement', async () => {
        await expect(logBodyMeasurement({ arms_cm: Infinity })).rejects.toThrow('Invalid measurement');
    });

    it('rejects an invalid measured_at date', async () => {
        await expect(logBodyMeasurement({ waist_cm: 80, measured_at: 'not-a-date' })).rejects.toThrow('Invalid date');
    });

    it('accepts a valid measured_at date', async () => {
        queue.push({ data: null, error: null });
        await expect(logBodyMeasurement({ waist_cm: 80, measured_at: '2024-01-15' })).resolves.toBeUndefined();
    });
});

describe('updateGender validation', () => {
    it('accepts male, female, and null', async () => {
        queue.push({ data: null, error: null });
        await expect(updateGender('male')).resolves.toBeUndefined();
        queue.push({ data: null, error: null });
        await expect(updateGender('female')).resolves.toBeUndefined();
        queue.push({ data: null, error: null });
        await expect(updateGender(null)).resolves.toBeUndefined();
    });

    it('rejects an invalid gender value', async () => {
        await expect(updateGender('other' as never)).rejects.toThrow('Invalid gender');
    });
});

describe('addExerciseToRoutine exercise visibility', () => {
    it('allows a global exercise (user_id null)', async () => {
        queue.push({ data: { id: VALID_UUID }, error: null }); // routine lookup
        queue.push({ data: { id: VALID_UUID_2, user_id: null }, error: null }); // exercise lookup
        queue.push({ data: [], error: null }); // existing order lookup
        queue.push({ data: { id: 're-1' }, error: null }); // insert result

        await expect(addExerciseToRoutine(VALID_UUID, VALID_UUID_2, '3', '8-12', null, 'push')).resolves.toBeDefined();
    });

    it('allows an exercise owned by the user', async () => {
        queue.push({ data: { id: VALID_UUID }, error: null }); // routine lookup
        queue.push({ data: { id: VALID_UUID_2, user_id: user.id }, error: null }); // exercise lookup
        queue.push({ data: [], error: null }); // existing order lookup
        queue.push({ data: { id: 're-1' }, error: null }); // insert result

        await expect(addExerciseToRoutine(VALID_UUID, VALID_UUID_2, '3', '8-12', null, 'push')).resolves.toBeDefined();
    });

    it('rejects an exercise owned by another user', async () => {
        queue.push({ data: { id: VALID_UUID }, error: null }); // routine lookup
        queue.push({ data: { id: VALID_UUID_2, user_id: 'other-user' }, error: null }); // exercise lookup

        await expect(addExerciseToRoutine(VALID_UUID, VALID_UUID_2, '3', '8-12', null, 'push')).rejects.toThrow(
            'Unauthorized',
        );
    });

    it('rejects a missing exercise', async () => {
        queue.push({ data: { id: VALID_UUID }, error: null }); // routine lookup
        queue.push({ data: null, error: null }); // exercise lookup -> not found

        await expect(addExerciseToRoutine(VALID_UUID, VALID_UUID_2, '3', '8-12', null, 'push')).rejects.toThrow(
            'Invalid exercise id',
        );
    });
});
