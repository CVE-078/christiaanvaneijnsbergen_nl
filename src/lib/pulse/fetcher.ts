export async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json() as Promise<T>;
}

// Shared SWR read options for the Pulse data hooks: fetch on mount, no focus
// revalidation, dedupe rapid re-fetches across navigation.
export const SWR_READ_OPTS = {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: 5000,
} as const;
