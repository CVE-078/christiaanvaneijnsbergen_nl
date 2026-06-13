import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('@/app/pulse/actions', () => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn(),
    deleteBodyWeight: vi.fn().mockResolvedValue(undefined),
    updateVarietyPreference: vi.fn().mockResolvedValue(undefined),
    updateLoadingLean: vi.fn().mockResolvedValue(undefined),
    updateGoalWeight: vi.fn().mockResolvedValue(undefined),
    logBodyMeasurement: vi.fn(),
}));

import useSWR from 'swr';
import {
    updateProfile,
    logBodyWeight,
    deleteBodyWeight,
    updateVarietyPreference,
    updateLoadingLean,
    updateGoalWeight,
    logBodyMeasurement,
} from '@/app/pulse/actions';
import { useProfile } from '../useProfile';
import type { Profile, BodyweightEntry, BodyMeasurement } from '@/lib/pulse/types';

const defaultProfile: Profile = {
    display_name: 'Test User',
    unit: 'kg',
    length_unit: 'cm',
    active_routine_id: null,
    active_equipment_profile_id: null,
    onboarding_completed: false,
    goal_weight_kg: null,
    gender: null,
    priority_muscle: null,
    training_style: null,
    variety_preference: null,
    loading_lean: null,
    movement_restrictions: null,
    timezone: 'UTC',
};
const defaultBWLogs: BodyweightEntry[] = [];

const profileMutate = vi.fn();
const bwMutate = vi.fn();
const measurementsMutate = vi.fn();

beforeEach(() => {
    vi.mocked(useSWR)
        .mockReturnValueOnce({ data: defaultProfile, mutate: profileMutate } as unknown as ReturnType<typeof useSWR>)
        .mockReturnValueOnce({ data: defaultBWLogs, mutate: bwMutate } as unknown as ReturnType<typeof useSWR>)
        .mockReturnValueOnce({ data: [], mutate: measurementsMutate } as unknown as ReturnType<typeof useSWR>);
    profileMutate.mockClear();
    bwMutate.mockClear();
    measurementsMutate.mockClear();
    vi.mocked(updateProfile).mockClear();
    vi.mocked(logBodyWeight).mockClear();
    vi.mocked(deleteBodyWeight).mockClear();
    vi.mocked(updateVarietyPreference).mockClear();
    vi.mocked(updateLoadingLean).mockClear();
    vi.mocked(updateGoalWeight).mockClear();
    vi.mocked(logBodyMeasurement).mockClear();
});

describe('useProfile', () => {
    it('returns profile from SWR data', () => {
        const { result } = renderHook(() => useProfile());
        expect(result.current.profile).toEqual(defaultProfile);
    });

    it('falls back to initialProfile when SWR data is undefined', () => {
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: undefined, mutate: profileMutate } as unknown as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: [], mutate: bwMutate } as unknown as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: [], mutate: measurementsMutate } as unknown as ReturnType<typeof useSWR>);
        const { result } = renderHook(() => useProfile());
        expect(result.current.profile).toEqual(defaultProfile);
    });

    it('updateProfile calls mutate optimistically and calls the server action', async () => {
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.updateProfile('New Name', 'lbs');
        });

        expect(profileMutate).toHaveBeenCalledWith(
            {
                display_name: 'New Name',
                unit: 'lbs',
                length_unit: 'cm',
                active_routine_id: null,
                active_equipment_profile_id: null,
                onboarding_completed: false,
                goal_weight_kg: null,
                gender: null,
                priority_muscle: null,
                training_style: null,
                variety_preference: null,
                loading_lean: null,
                movement_restrictions: null,
                timezone: 'UTC',
                accent_color: null,
            },
            false,
        );
        expect(updateProfile).toHaveBeenCalledWith('New Name', 'lbs');
    });

    it('deleteBodyWeight removes entry optimistically then calls server action', async () => {
        const bwLogs: BodyweightEntry[] = [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }];
        vi.mocked(useSWR)
            .mockReturnValueOnce({ data: defaultProfile, mutate: profileMutate } as unknown as ReturnType<
                typeof useSWR
            >)
            .mockReturnValueOnce({ data: bwLogs, mutate: bwMutate } as unknown as ReturnType<typeof useSWR>)
            .mockReturnValueOnce({ data: [], mutate: measurementsMutate } as unknown as ReturnType<typeof useSWR>);

        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.deleteBodyWeight('abc');
        });

        const updaterArg = bwMutate.mock.calls[0][0] as (prev: BodyweightEntry[]) => BodyweightEntry[];
        expect(updaterArg(bwLogs)).toEqual([]);
        expect(deleteBodyWeight).toHaveBeenCalledWith('abc');
    });

    it('logBodyWeight calls server action and updates cache', async () => {
        const entry: BodyweightEntry = { id: 'xyz', logged_at: '2026-05-25', weight_kg: 75 };
        vi.mocked(logBodyWeight).mockResolvedValueOnce(entry);
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            const returned = await result.current.logBodyWeight(75);
            expect(returned).toEqual(entry);
        });

        expect(logBodyWeight).toHaveBeenCalledWith(75, undefined);
        expect(bwMutate).toHaveBeenCalled();
    });

    it('logBodyWeight forwards an explicit (non-today) date to the server action', async () => {
        const entry: BodyweightEntry = { id: 'd1', logged_at: '2026-05-01', weight_kg: 70 };
        vi.mocked(logBodyWeight).mockResolvedValueOnce(entry);
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.logBodyWeight(70, '2026-05-01');
        });

        expect(logBodyWeight).toHaveBeenCalledWith(70, '2026-05-01');
        // The optimistic insert places the backdated entry by logged_at order.
        const updater = bwMutate.mock.calls[0][0] as (prev: BodyweightEntry[]) => BodyweightEntry[];
        expect(updater([{ id: 'x', logged_at: '2026-04-01', weight_kg: 72 }])).toEqual([
            entry,
            { id: 'x', logged_at: '2026-04-01', weight_kg: 72 },
        ]);
    });

    it('updateGoalWeight optimistically mutates the profile then calls the server action', async () => {
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.updateGoalWeight(72);
        });

        expect(profileMutate).toHaveBeenCalledWith({ ...defaultProfile, goal_weight_kg: 72 }, false);
        expect(updateGoalWeight).toHaveBeenCalledWith(72);
        // Revalidates after the server confirms.
        expect(profileMutate).toHaveBeenCalledTimes(2);
    });

    it('logBodyMeasurement inserts the server-returned row into the cache (no revalidate)', async () => {
        const row: BodyMeasurement = {
            id: 'm1',
            measured_at: '2026-05-01',
            waist_cm: 80,
            hips_cm: null,
            chest_cm: null,
            arms_cm: null,
        };
        vi.mocked(logBodyMeasurement).mockResolvedValueOnce(row);
        const { result } = renderHook(() => useProfile());

        let returned: BodyMeasurement | undefined;
        await act(async () => {
            returned = await result.current.logBodyMeasurement({ measured_at: '2026-05-01', waist_cm: 80 });
        });

        expect(logBodyMeasurement).toHaveBeenCalledWith({ measured_at: '2026-05-01', waist_cm: 80 });
        expect(returned).toEqual(row);
        const updater = measurementsMutate.mock.calls[0][0] as (prev: BodyMeasurement[]) => BodyMeasurement[];
        expect(updater([])).toEqual([row]);
        // No revalidate: the canonical row is already in the cache.
        expect(measurementsMutate).toHaveBeenCalledTimes(1);
        expect(measurementsMutate).toHaveBeenCalledWith(expect.any(Function), false);
    });

    it('updateVarietyPreference optimistically mutates and calls the server action', async () => {
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.updateVarietyPreference('consistent');
        });

        expect(profileMutate).toHaveBeenCalledWith({ ...defaultProfile, variety_preference: 'consistent' }, false);
        expect(updateVarietyPreference).toHaveBeenCalledWith('consistent');
    });

    it('updateLoadingLean accepts an equipment value and null', async () => {
        const { result } = renderHook(() => useProfile());

        await act(async () => {
            await result.current.updateLoadingLean('barbell');
        });
        expect(profileMutate).toHaveBeenCalledWith({ ...defaultProfile, loading_lean: 'barbell' }, false);
        expect(updateLoadingLean).toHaveBeenCalledWith('barbell');

        await act(async () => {
            await result.current.updateLoadingLean(null);
        });
        expect(profileMutate).toHaveBeenCalledWith({ ...defaultProfile, loading_lean: null }, false);
        expect(updateLoadingLean).toHaveBeenCalledWith(null);
    });
});
