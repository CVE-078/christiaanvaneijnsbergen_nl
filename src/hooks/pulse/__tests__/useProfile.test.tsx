import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { useProfile } from '../useProfile';

vi.mock('@/lib/pulse/fetcher', () => ({
    fetcher: vi.fn(async (key: string) => {
        if (key === '/api/pulse/profile')
            return {
                display_name: 'Sam',
                unit: 'kg',
                active_routine_id: null,
                onboarding_completed: true,
                goal_weight_kg: null,
            };
        return [];
    }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('useProfile (client fetch)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reports loading then resolves the fetched profile with no initial data', async () => {
        const { result } = renderHook(() => useProfile(), { wrapper });
        // Default profile while loading
        expect(result.current.profile.display_name).toBeNull();
        await waitFor(() => expect(result.current.profile.display_name).toBe('Sam'));
        expect(result.current.loadingProfile).toBe(false);
    });
});
