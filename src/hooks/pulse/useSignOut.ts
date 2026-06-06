'use client';
import { useState } from 'react';
import { logout } from '@/app/pulse/actions';
import { clearAllSWRCache } from '@/lib/pulse/swrCache';
import { flushQueue } from '@/lib/pulse/offlineSync';
import { usePulse } from '@/context/PulseContext';

// Sign-out with immediate UI feedback. `signingOut` flips true on the first call
// so the button can show a pending state right away (the old flow awaited a queue
// flush + the logout round-trip with no visible feedback). The session ends with a
// redirect, so the flag never needs resetting. Drains this user's queued writes
// while still authenticated (best-effort, so they land in the right account and
// don't linger on a shared device), clears the per-user SWR cache, then ends the
// session. Shared by the mobile (AppShell) and desktop (DesktopLayout) shells.
export function useSignOut() {
    const { userId } = usePulse();
    const [signingOut, setSigningOut] = useState(false);
    const signOut = async () => {
        if (signingOut) return;
        setSigningOut(true);
        try {
            await flushQueue(userId);
        } catch {
            // offline or failed, writes stay queued (scoped to this user) and sync on next sign-in
        }
        clearAllSWRCache();
        await logout();
    };
    return { signOut, signingOut };
}
