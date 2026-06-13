import useSWR from 'swr';
import { useCallback } from 'react';
import {
    updateProfile as serverUpdateProfile,
    updateGender as serverUpdateGender,
    updateLengthUnit as serverUpdateLengthUnit,
    updatePriorityMuscle as serverUpdatePriorityMuscle,
    updateTrainingStyle as serverUpdateTrainingStyle,
    updateMovementRestrictions as serverUpdateMovementRestrictions,
    updateVarietyPreference as serverUpdateVarietyPreference,
    updateLoadingLean as serverUpdateLoadingLean,
    updateTimezone as serverUpdateTimezone,
    updateAccentColor as serverUpdateAccentColor,
    updateGoalWeight as serverUpdateGoalWeight,
    logBodyWeight as serverLogBodyWeight,
    deleteBodyWeight as serverDeleteBodyWeight,
    logBodyMeasurement as serverLogBodyMeasurement,
    deleteBodyMeasurement as serverDeleteBodyMeasurement,
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
    TrainingStyle,
    RestrictionFlag,
    VarietyPreference,
    LoadingPreference,
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

    const updateTrainingStyle = useCallback(
        async (style: TrainingStyle | null): Promise<void> => {
            mutateProfile({ ...profile, training_style: style }, false);
            try {
                await serverUpdateTrainingStyle(style);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateMovementRestrictions = useCallback(
        async (restrictions: RestrictionFlag[]): Promise<void> => {
            mutateProfile({ ...profile, movement_restrictions: restrictions }, false);
            try {
                await serverUpdateMovementRestrictions(restrictions);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateVarietyPreference = useCallback(
        async (pref: VarietyPreference): Promise<void> => {
            mutateProfile({ ...profile, variety_preference: pref }, false);
            try {
                await serverUpdateVarietyPreference(pref);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateLoadingLean = useCallback(
        async (pref: LoadingPreference | null): Promise<void> => {
            mutateProfile({ ...profile, loading_lean: pref }, false);
            try {
                await serverUpdateLoadingLean(pref);
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

    const updateAccentColor = useCallback(
        async (accentColor: string): Promise<void> => {
            mutateProfile({ ...profile, accent_color: accentColor }, false);
            try {
                await serverUpdateAccentColor(accentColor);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const updateGoalWeight = useCallback(
        async (goalWeightKg: number | null): Promise<void> => {
            mutateProfile({ ...profile, goal_weight_kg: goalWeightKg }, false);
            try {
                await serverUpdateGoalWeight(goalWeightKg);
            } finally {
                mutateProfile();
            }
        },
        [mutateProfile, profile],
    );

    const logBodyWeight = useCallback(
        // `date` is an optional YYYY-MM-DD for backdated entries; the server upserts
        // by (user, logged_at) and returns the canonical row, which we insert directly
        // into the cache (deduped by logged_at, re-sorted). No revalidate needed, and
        // it works for any date, so the UI updates live whether or not it is today.
        async (weightKg: number, date?: string): Promise<BodyweightEntry> => {
            const entry = await serverLogBodyWeight(weightKg, date);
            mutateBW((prev = []) => {
                const deduped = prev.filter((e) => e.logged_at !== entry.logged_at);
                return [entry, ...deduped].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
            }, false);
            return entry;
        },
        [mutateBW],
    );

    const logBodyMeasurement = useCallback(
        // Mirror logBodyWeight: await the server, get the upserted row back, and insert
        // it straight into the cache. One row per date, so replace any existing row for
        // that date (dedupe by measured_at). No revalidate, so it shows live for any date.
        async (data: {
            measured_at?: string;
            waist_cm?: number;
            hips_cm?: number;
            chest_cm?: number;
            arms_cm?: number;
        }): Promise<BodyMeasurement> => {
            const row = await serverLogBodyMeasurement(data);
            mutateMeasurements((prev = []) => {
                const deduped = prev.filter((m) => m.measured_at !== row.measured_at);
                return [row, ...deduped].sort((a, b) => b.measured_at.localeCompare(a.measured_at));
            }, false);
            return row;
        },
        [mutateMeasurements],
    );

    const deleteBodyMeasurement = useCallback(
        async (id: string): Promise<void> => {
            mutateMeasurements((prev = []) => prev.filter((m) => m.id !== id), false);
            try {
                await serverDeleteBodyMeasurement(id);
            } finally {
                mutateMeasurements();
            }
        },
        [mutateMeasurements],
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
        updateTrainingStyle,
        updateMovementRestrictions,
        updateVarietyPreference,
        updateLoadingLean,
        updateTimezone,
        updateAccentColor,
        updateGoalWeight,
        logBodyWeight,
        logBodyMeasurement,
        deleteBodyWeight,
        deleteBodyMeasurement,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    };
}
