'use client';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Hanken_Grotesk, Sora } from 'next/font/google';
import { SWRConfig } from 'swr';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from './ToastContainer';
import { makeSWRCacheProvider } from '@/lib/pulse/swrCache';
import type { View } from '@/lib/pulse/types';

const hanken = Hanken_Grotesk({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-pulse',
    display: 'swap',
});

const sora = Sora({
    subsets: ['latin'],
    weight: ['400', '500', '600'],
    variable: '--font-pulse-body',
    display: 'swap',
});

const PATH_TO_VIEW: Record<string, View> = {
    '/pulse/train': 'train',
    '/pulse/plan': 'plan',
    '/pulse/progress': 'progress',
    '/pulse/profile': 'profile',
    '/pulse/explore': 'explore',
};

interface Props {
    userId: string;
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ userId, email, children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = (pathname ? PATH_TO_VIEW[pathname] : undefined) ?? 'train';

    const navigate = useCallback(
        (v: View) => {
            router.push(`/pulse/${v}`);
        },
        [router],
    );

    // Build the cache provider once per user so its unload listeners register once.
    const cacheProvider = useMemo(() => makeSWRCacheProvider(userId), [userId]);

    return (
        <div className={`${hanken.variable} ${sora.variable}`}>
            <SWRConfig value={{ provider: cacheProvider }}>
                <ToastProvider>
                    <PulseProvider email={email} navigate={navigate}>
                        <AppShell view={view} navigate={navigate}>
                            {children}
                        </AppShell>
                        <ToastContainer />
                    </PulseProvider>
                </ToastProvider>
            </SWRConfig>
        </div>
    );
}
