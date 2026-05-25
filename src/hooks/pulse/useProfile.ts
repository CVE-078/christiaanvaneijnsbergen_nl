import useSWR from 'swr';
import {
    updateProfile as serverUpdateProfile,
    logBodyWeight as serverLogBodyWeight,
    deleteBodyWeight as serverDeleteBodyWeight,
} from '@/app/pulse/actions';
import type { Profile, BodyweightEntry, Unit } from '@/lib/pulse/types';

const PROFILE_KEY = '/api/pulse/profile';
const BODYWEIGHT_KEY = '/api/pulse/bodyweight';

async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<T>;
}

export function useProfile(initialProfile: Profile, initialBodyweightLogs: BodyweightEntry[]) {
    const { data: profileData, mutate: mutateProfile } = useSWR<Profile>(
        PROFILE_KEY,
        fetcher,
        { fallbackData: initialProfile, revalidateOnFocus: true },
    );
    const profile = profileData ?? initialProfile;

    const { data: bwData, mutate: mutateBW } = useSWR<BodyweightEntry[]>(
        BODYWEIGHT_KEY,
        fetcher,
        { fallbackData: initialBodyweightLogs, revalidateOnFocus: true },
    );
    const bodyweightLogs = bwData ?? initialBodyweightLogs;

    async function updateProfile(displayName: string | null, unit: Unit): Promise<void> {
        mutateProfile({ ...profile, display_name: displayName, unit }, false);
        await serverUpdateProfile(displayName, unit);
        mutateProfile();
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
        await serverDeleteBodyWeight(id);
        mutateBW();
    }

    return { profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight };
}
