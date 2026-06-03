import { vi, describe, it, expect, beforeEach } from 'vitest';

const getUser = vi.fn();
const createClientMock = vi.fn(async () => ({ auth: { getUser } }));

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => createClientMock(),
}));

import { getUserOrThrow, getUserOrUnauthorized } from '../auth';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getUserOrThrow', () => {
    it('returns supabase and user when authenticated', async () => {
        const user = { id: 'user-1' };
        getUser.mockResolvedValueOnce({ data: { user } });

        const result = await getUserOrThrow();

        expect(result.user).toBe(user);
        expect(result.supabase).toBeDefined();
    });

    it("throws Error('Unauthorized') when no user", async () => {
        getUser.mockResolvedValueOnce({ data: { user: null } });

        await expect(getUserOrThrow()).rejects.toThrow('Unauthorized');
    });
});

describe('getUserOrUnauthorized', () => {
    it('returns user with null response when authenticated', async () => {
        const user = { id: 'user-1' };
        getUser.mockResolvedValueOnce({ data: { user } });

        const result = await getUserOrUnauthorized();

        expect(result.user).toBe(user);
        expect(result.response).toBeNull();
        expect(result.supabase).toBeDefined();
    });

    it('returns null user with a 401 response when not authenticated', async () => {
        getUser.mockResolvedValueOnce({ data: { user: null } });

        const result = await getUserOrUnauthorized();

        expect(result.user).toBeNull();
        expect(result.response).not.toBeNull();
        expect(result.response?.status).toBe(401);
        await expect(result.response?.json()).resolves.toEqual({ error: 'Unauthorized' });
    });
});
