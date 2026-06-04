/** Error thrown by {@link fetcher} carrying the HTTP status so the UI can react (e.g. route to /pulse/login on 401). */
export class FetchError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'FetchError';
        this.status = status;
    }
}

export async function fetcher<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 401) {
            throw new FetchError(401, 'Unauthorized');
        }
        throw new FetchError(res.status, 'Failed to fetch');
    }
    return res.json() as Promise<T>;
}

// Shared SWR read options for the Pulse data hooks: fetch on mount, no focus
// revalidation, dedupe rapid re-fetches across navigation.
export const SWR_READ_OPTS = {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    dedupingInterval: 5000,
} as const;
