import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import {
    createEquipmentProfile as serverCreate,
    updateEquipmentProfile as serverUpdate,
    deleteEquipmentProfile as serverDelete,
    setActiveEquipmentProfile as serverSetActive,
    startTravel as serverStartTravel,
    endTravel as serverEndTravel,
} from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';

const EQUIPMENT_PROFILES_KEY = '/api/pulse/equipment-profiles';
const PROFILE_KEY = '/api/pulse/profile';

// Stable empty default so `data ?? EMPTY` keeps constant identity across renders.
const EMPTY: EquipmentProfile[] = [];

export function useEquipmentProfiles() {
    const { mutate: globalMutate } = useSWRConfig();
    const { data, mutate, isLoading, error } = useSWR<EquipmentProfile[]>(
        EQUIPMENT_PROFILES_KEY,
        fetcher,
        SWR_READ_OPTS,
    );

    const createEquipmentProfile = useCallback(
        async (name: string, equipment: EquipmentKey[]): Promise<EquipmentProfile> => {
            const created = await serverCreate(name, equipment);
            await mutate();
            return created;
        },
        [mutate],
    );

    const updateEquipmentProfile = useCallback(
        async (id: string, name: string, equipment: EquipmentKey[]): Promise<void> => {
            await mutate(
                (prev?: EquipmentProfile[]) => prev?.map((p) => (p.id === id ? { ...p, name, equipment } : p)),
                false,
            );
            // try/finally so a server error still revalidates, rolling the
            // optimistic patch back to the real server state (the caller surfaces
            // the thrown error as a toast).
            try {
                await serverUpdate(id, name, equipment);
            } finally {
                await mutate();
            }
        },
        [mutate],
    );

    const deleteEquipmentProfile = useCallback(
        async (id: string): Promise<void> => {
            await mutate((prev?: EquipmentProfile[]) => prev?.filter((p) => p.id !== id), false);
            try {
                await serverDelete(id);
            } finally {
                await mutate();
                // Deleting the active profile clears the pointer (ON DELETE SET NULL);
                // refresh the profile cache so the active marker updates.
                await globalMutate(PROFILE_KEY);
            }
        },
        [mutate, globalMutate],
    );

    const setActiveEquipmentProfile = useCallback(
        async (id: string | null): Promise<void> => {
            await serverSetActive(id);
            await globalMutate(PROFILE_KEY);
        },
        [globalMutate],
    );

    // Travel mode (#322). Optimistically set the overlay on the target and clear
    // it on the others (mirrors the server's one-overlay invariant); the finally
    // revalidate rolls back on failure. The default pointer is untouched, so no
    // PROFILE_KEY mutation.
    const startTravel = useCallback(
        async (id: string, expiresAt: string): Promise<void> => {
            await mutate(
                (prev?: EquipmentProfile[]) =>
                    prev?.map((p) => ({ ...p, expires_at: p.id === id ? expiresAt : null })),
                false,
            );
            try {
                await serverStartTravel(id, expiresAt);
            } finally {
                await mutate();
            }
        },
        [mutate],
    );

    const endTravel = useCallback(async (): Promise<void> => {
        await mutate((prev?: EquipmentProfile[]) => prev?.map((p) => ({ ...p, expires_at: null })), false);
        try {
            await serverEndTravel();
        } finally {
            await mutate();
        }
    }, [mutate]);

    return {
        equipmentProfiles: data ?? EMPTY,
        loadingEquipmentProfiles: isLoading,
        equipmentProfilesError: error,
        createEquipmentProfile,
        updateEquipmentProfile,
        deleteEquipmentProfile,
        setActiveEquipmentProfile,
        startTravel,
        endTravel,
    };
}
