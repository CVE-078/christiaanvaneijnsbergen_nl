import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/pulse/auth', () => ({ getUserOrUnauthorized: vi.fn() }));

import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { POST } from '../route';
import { DELETE } from '../[groupId]/route';

const UID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GROUP = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// Minimal thenable query builder: every chain method returns the builder, and
// awaiting it resolves the next queued result in call order.
function makeSupabase(results: unknown[]) {
    let i = 0;
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'update']) builder[m] = () => builder;
    builder.then = (resolve: (v: unknown) => void) => resolve(results[i++]);
    return { from: () => builder };
}

function authed(results: unknown[]) {
    vi.mocked(getUserOrUnauthorized).mockResolvedValue({
        supabase: makeSupabase(results),
        user: { id: 'u1' },
        response: null,
    } as unknown as Awaited<ReturnType<typeof getUserOrUnauthorized>>);
}

function unauthed() {
    vi.mocked(getUserOrUnauthorized).mockResolvedValue({
        supabase: null,
        user: null,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as unknown as Awaited<ReturnType<typeof getUserOrUnauthorized>>);
}

function postReq(body: unknown) {
    return new Request('http://localhost/api/pulse/supersets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/pulse/supersets', () => {
    it('returns 401 when there is no user', async () => {
        unauthed();
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_B }));
        expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID exercise ids', async () => {
        authed([]);
        const res = await POST(postReq({ exerciseAId: 'nope', exerciseBId: UID_B }));
        expect(res.status).toBe(400);
    });

    it('returns 400 when pairing an exercise with itself', async () => {
        authed([]);
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_A }));
        expect(res.status).toBe(400);
    });

    it('returns 404 when the two rows are not both found', async () => {
        authed([{ data: [{ id: UID_A }], error: null }]);
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_B }));
        expect(res.status).toBe(404);
    });

    it('returns 403 when a routine is owned by another user', async () => {
        authed([
            {
                data: [
                    { id: UID_A, routine_id: 'r1', order: 0, superset_group_id: null, workout_routines: { user_id: 'someone-else' } },
                    { id: UID_B, routine_id: 'r1', order: 1, superset_group_id: null, workout_routines: { user_id: 'u1' } },
                ],
                error: null,
            },
        ]);
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_B }));
        expect(res.status).toBe(403);
    });

    it('pairs two adjacent owned exercises (200)', async () => {
        authed([
            // fetch the two rows
            {
                data: [
                    { id: UID_A, routine_id: 'r1', order: 0, superset_group_id: null, workout_routines: { user_id: 'u1' } },
                    { id: UID_B, routine_id: 'r1', order: 5, superset_group_id: null, workout_routines: { user_id: 'u1' } },
                ],
                error: null,
            },
            // adjacency lookup (sorted positions are consecutive despite the order gap)
            { data: [{ id: UID_A, order: 0 }, { id: UID_B, order: 5 }], error: null },
            // update returns both rows
            { data: [{ id: UID_A }, { id: UID_B }], error: null },
        ]);
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_B }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(typeof json.groupId).toBe('string');
    });

    it('rejects non-adjacent exercises (400)', async () => {
        authed([
            {
                data: [
                    { id: UID_A, routine_id: 'r1', order: 0, superset_group_id: null, workout_routines: { user_id: 'u1' } },
                    { id: UID_B, routine_id: 'r1', order: 5, superset_group_id: null, workout_routines: { user_id: 'u1' } },
                ],
                error: null,
            },
            // a third exercise sits between them in sorted order
            { data: [{ id: UID_A, order: 0 }, { id: 'mid', order: 3 }, { id: UID_B, order: 5 }], error: null },
        ]);
        const res = await POST(postReq({ exerciseAId: UID_A, exerciseBId: UID_B }));
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/pulse/supersets/[groupId]', () => {
    it('returns 400 for an invalid group id', async () => {
        const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ groupId: 'bad' }) });
        expect(res.status).toBe(400);
    });

    it('returns 401 when there is no user', async () => {
        unauthed();
        const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ groupId: GROUP }) });
        expect(res.status).toBe(401);
    });

    it('returns 404 when the group has no rows', async () => {
        authed([{ data: [], error: null }]);
        const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ groupId: GROUP }) });
        expect(res.status).toBe(404);
    });

    it('clears the group for an owned superset (200)', async () => {
        authed([
            { data: [{ id: UID_A, workout_routines: { user_id: 'u1' } }, { id: UID_B, workout_routines: { user_id: 'u1' } }], error: null },
            { error: null },
        ]);
        const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ groupId: GROUP }) });
        expect(res.status).toBe(200);
    });
});
