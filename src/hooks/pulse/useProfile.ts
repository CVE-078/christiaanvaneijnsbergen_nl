import useSWR from 'swr';
import { useCallback } from 'react';
import {
    updateProfile as serverUpdateProfile,
    updateGender as serverUpdateGender,
    updateLengthUnit as serverUpdateLengthUnit,
    updatePriorityMuscle as serverUpdatePriorityMuscle,
    updateTimezone as serverUpdateTimezone,
    logBodyWeight as serverLogBodyWeight,
    deleteBodyWeight as serverDeleteBodyWeight,
} from '@/app/pulse/actions';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import type {
    Profile,
    BodyweightEntry,
    BodyMeasurement,
    Unit,
    LengthUnit,
    Gender,
    PriorityMuscle,
} from '@/lib/pulse/types';

const PROFILE_KEY = '/api/pulse/profile';
const BODYWEIGHT_KEY = '/api/pulse/bodyweight';
const MEASUREMENTS_KEY = '/api/pulse/measurements';

// Stable empty default so `bwData ?? EMPTY_BW` keeps a constant identity across
// renders (otherwise the provider's profileValue memo churns every render).
const EMPTY_BW: BodyweightEntry[] = [];
const EMPTY_MEASUREMENTS: BodyMeasurement[] = [];

const DEFAULT_PROFILE: Profile = {
    display_name: null,
    unit: 'kg',
    length_unit: 'cm',
    active_routine_id: null,
    onboarding_completed: false,
    goal_weight_kg: null,
    gender: null,
    priority_muscle: null,
    timezone: 'UTC',
};

export function useProfile() {
    const {
        data: profileData,
        mutate: mutateProfile,
        isLoading: loadingProfile,
        error: profileError,
    } = useSWR<Profile>(PROFILE_KEY, fetcher, SWR_READ_OPTS);
    const profile = profileData ?? DEFAULT_PROFILE;

    const {
        data: bwData,
        mutate: mutateBW,
        isLoading: loadingBodyweight,
        error: bodyweightError,
    } = useSWR<BodyweightEntry[]>(BODYWEIGHT_KEY, fetcher, SWR_READ_OPTS);
    const bodyweightLogs = bwData ?? EMPTY_BW;

    const { data: measurementsData, mutate: mutateMeasurements } = useSWR<BodyMeasurement[]>(
        MEASUREMENTS_KEY,
        fetcher,
        SWR_READ_OPTS,
    );
    const bodyMeasurements = measurementsData ?? EMPTY_MEASUREMENTS;

    const refreshMeasurements = useCallback((): void => {
        mutateMeasurements();
    }, [mutateMeasurements]);

    const updateProfile = useCallback(
        async (displayName: string | null, unit: Unit): Promise<void> => {
            mutateProfile({ ...profile, display_name: displayName, unit }, false);
            try {
                await serverUpdateProfile(displayName, unit);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateGender = useCallback(
        async (gender: Gender | null): Promise<void> => {
            mutateProfile({ ...profile, gender }, false);
            try {
                await serverUpdateGender(gender);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateLengthUnit = useCallback(
        async (lengthUnit: LengthUnit): Promise<void> => {
            mutateProfile({ ...profile, length_unit: lengthUnit }, false);
            try {
                await serverUpdateLengthUnit(lengthUnit);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updatePriorityMuscle = useCallback(
        async (priority: PriorityMuscle | 'balanced' | null): Promise<void> => {
            mutateProfile({ ...profile, priority_muscle: priority }, false);
            try {
                await serverUpdatePriorityMuscle(priority);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateTimezone = useCallback(
        async (timezone: string): Promise<void> => {
            mutateProfile({ ...profile, timezone }, false);
            try {
                await serverUpdateTimezone(timezone);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const logBodyWeight = useCallback(
        async (weightKg: number): Promise<BodyweightEntry> => {
            const entry = await serverLogBodyWeight(weightKg);
            mutateBW((prev = []) => {
                const deduped = prev.filter((e) => e.logged_at !== entry.logged_at);
                return [entry, ...deduped].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
            }, false);
            return entry;
        },
        [mutateBW],
    );

    const deleteBodyWeight = useCallback(
        async (id: string): Promise<void> => {
            mutateBW((prev = []) => prev.filter((e) => e.id !== id), false);
            try {
                await serverDeleteBodyWeight(id);
            } finally {
                mutateBW();
            }
        },
        [mutateBW],
    );

    return {
        profile,
        bodyweightLogs,
        bodyMeasurements,
        refreshMeasurements,
        updateProfile,
        updateGender,
        updateLengthUnit,
        updatePriorityMuscle,
        updateTimezone,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    };
}
