import { useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { flushQueue } from '@/lib/pulse/offlineSync';

export function useOfflineSync(userId: string): void {
    const { mutate } = useSWRConfig();
    useEffect(() => {
        let cancelled = false;
        const sync = async () => {
            const { remaining } = await flushQueue(userId);
            if (!cancelled && remaining === 0) {
                mutate('/api/pulse/logs');
                mutate('/api/pulse/notes');
            }
        };
        sync();
        const onOnline = () => sync();
        window.addEventListener('online', onOnline);
        window.addEventListener('focus', onOnline);
        return () => {
            cancelled = true;
            window.removeEventListener('online', onOnline);
            window.removeEventListener('focus', onOnline);
        };
    }, [mutate, userId]);
}
