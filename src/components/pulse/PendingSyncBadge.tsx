'use client';
import { useOnline } from '@/hooks/pulse/useOnline';
import { usePendingSyncCount } from '@/hooks/pulse/usePendingSyncCount';

export default function PendingSyncBadge() {
    const online = useOnline();
    const count = usePendingSyncCount();

    if (online && count === 0) return null;

    const label =
        count > 0
            ? `${count} ${count === 1 ? 'change' : 'changes'} pending sync`
            : 'Offline, changes save locally';

    return (
        <span className="font-pulse text-[0.6875rem] bg-pulse-surface-2 text-pulse-dim rounded-full px-2.5 py-1">
            {label}
        </span>
    );
}
