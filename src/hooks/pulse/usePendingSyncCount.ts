import { useEffect, useState } from 'react';
import { count } from '@/lib/pulse/offlineQueue';

export function usePendingSyncCount(): number {
    const [n, setN] = useState(0);
    useEffect(() => {
        let active = true;
        const refresh = () =>
            count()
                .then((c) => active && setN(c))
                .catch(() => {});
        refresh();
        const id = setInterval(refresh, 5000);
        window.addEventListener('online', refresh);
        window.addEventListener('offline', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            clearInterval(id);
            window.removeEventListener('online', refresh);
            window.removeEventListener('offline', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, []);
    return n;
}
