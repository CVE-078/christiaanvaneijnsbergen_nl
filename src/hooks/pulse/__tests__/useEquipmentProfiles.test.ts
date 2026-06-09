import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Stable globalMutate spy so tests can assert the profile cache is revalidated.
const globalMutate = vi.fn();
vi.mock('swr', () => ({ default: vi.fn(), useSWRConfig: () => ({ mutate: globalMutate }) }));
vi.mock('@/app/pulse/actions', () => ({
    createEquipmentProfile: vi.fn(),
    updateEquipmentProfile: vi.fn().mockResolvedValue(undefined),
    deleteEquipmentProfile: vi.fn().mockResolvedValue(undefined),
    setActiveEquipmentProfile: vi.fn().mockResolvedValue(undefined),
}));

import useSWR from 'swr';
import {
    createEquipmentProfile as serverCreate,
    updateEquipmentProfile as serverUpdate,
    deleteEquipmentProfile as serverDelete,
    setActiveEquipmentProfile as serverSetActive,
} from '@/app/pulse/actions';
import { useEquipmentProfiles } from '../useEquipmentProfiles';
import type { EquipmentProfile } from '@/lib/pulse/types';

const PROFILE_KEY = '/api/pulse/profile';
const home: EquipmentProfile = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Home', equipment: ['dumbbells'], created_at: '2026-06-09T00:00:00Z', expires_at: null };
const mutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR).mockReturnValue({ data: [home], mutate, isLoading: false, error: undefined } as unknown as ReturnType<typeof useSWR>);
    mutate.mockClear();
    globalMutate.mockClear();
    vi.mocked(serverCreate).mockClear();
    vi.mocked(serverUpdate).mockClear();
    vi.mocked(serverDelete).mockClear();
    vi.mocked(serverSetActive).mockClear();
});

describe('useEquipmentProfiles', () => {
    it('returns profiles from SWR data', () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        expect(result.current.equipmentProfiles).toEqual([home]);
    });

    it('create calls the server action and revalidates', async () => {
        const created = { ...home, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Gym' };
        vi.mocked(serverCreate).mockResolvedValue(created);
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            const out = await result.current.createEquipmentProfile('Gym', ['barbell']);
            expect(out).toEqual(created);
        });
        expect(serverCreate).toHaveBeenCalledWith('Gym', ['barbell']);
        expect(mutate).toHaveBeenCalled();
    });

    it('update optimistically patches then persists', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.updateEquipmentProfile(home.id, 'Home Gym', ['dumbbells', 'bench']);
        });
        expect(typeof mutate.mock.calls[0][0]).toBe('function');
        expect(mutate.mock.calls[0][1]).toBe(false);
        expect(serverUpdate).toHaveBeenCalledWith(home.id, 'Home Gym', ['dumbbells', 'bench']);
    });

    it('update revalidates even when the server action throws', async () => {
        vi.mocked(serverUpdate).mockRejectedValueOnce(new Error('boom'));
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await expect(result.current.updateEquipmentProfile(home.id, 'Gym', ['barbell'])).rejects.toThrow('boom');
        });
        expect(mutate).toHaveBeenCalledTimes(2);
    });

    it('delete optimistically removes then persists and refreshes the profile cache', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.deleteEquipmentProfile(home.id);
        });
        expect(typeof mutate.mock.calls[0][0]).toBe('function');
        expect(serverDelete).toHaveBeenCalledWith(home.id);
        expect(globalMutate).toHaveBeenCalledWith(PROFILE_KEY);
    });

    it('setActive calls the server action and refreshes the profile cache', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.setActiveEquipmentProfile(home.id);
        });
        expect(serverSetActive).toHaveBeenCalledWith(home.id);
        expect(globalMutate).toHaveBeenCalledWith(PROFILE_KEY);
    });

    it('setActive(null) clears the active pointer', async () => {
        const { result } = renderHook(() => useEquipmentProfiles());
        await act(async () => {
            await result.current.setActiveEquipmentProfile(null);
        });
        expect(serverSetActive).toHaveBeenCalledWith(null);
    });
});
