import useSWR from 'swr';
import {
    updateProfile as serverUpdateProfile,
    logBodyWeight as serverLogBodyWeight,
    deleteBodyWeight as serverDeleteBodyWeight,
} from '@/app/pulse/actions';
import { fetcher } from '@/lib/pulse/fetcher';
import type { Profile, BodyweightEntry, Unit } from '@/lib/pulse/types';

const PROFILE_KEY = '/api/pulse/profile';
const BODYWEIGHT_KEY = '/api/pulse/bodyweight';

const DEFAULT_PROFILE: Profile = {
    display_name: null,
    unit: 'kg',
    active_routine_id: null,
    onboarding_completed: false,
    goal_weight_kg: null,
};

export function useProfile(initialProfile?: Profile, initialBodyweightLogs?: BodyweightEntry[]) {
    const {
        data: profileData,
        mutate: mutateProfile,
        isLoading: loadingProfile,
        error: profileError,
    } = useSWR<Profile>(PROFILE_KEY, fetcher, {
        fallbackData: initialProfile,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const profile = profileData ?? DEFAULT_PROFILE;

    const {
        data: bwData,
        mutate: mutateBW,
        isLoading: loadingBodyweight,
        error: bodyweightError,
    } = useSWR<BodyweightEntry[]>(BODYWEIGHT_KEY, fetcher, {
        fallbackData: initialBodyweightLogs,
        revalidateOnFocus: false,
        revalidateIfStale: true,
        dedupingInterval: 5000,
    });
    const bodyweightLogs = bwData ?? [];

    async function updateProfile(displayName: string | null, unit: Unit): Promise<void> {
        mutateProfile({ ...profile, display_name: displayName, unit }, false);
        try {
            await serverUpdateProfile(displayName, unit);
        } finally {
            mutateProfile();
        }
    }

    async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
        const entry = await serverLogBodyWeight(weightKg);
        mutateBW((prev = []) => {
            const deduped = prev.filter((e) => e.logged_at !== entry.logged_at);
            return [entry, ...deduped].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
        }, false);
        return entry;
    }

    async function deleteBodyWeight(id: string): Promise<void> {
        mutateBW((prev = []) => prev.filter((e) => e.id !== id), false);
        try {
            await serverDeleteBodyWeight(id);
        } finally {
            mutateBW();
        }
    }

    return {
        profile,
        bodyweightLogs,
        updateProfile,
        logBodyWeight,
        deleteBodyWeight,
        loadingProfile,
        loadingBodyweight,
        profileError,
        bodyweightError,
    };
}
