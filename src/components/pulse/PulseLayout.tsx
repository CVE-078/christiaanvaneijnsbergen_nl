'use client';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Hanken_Grotesk, Sora, Big_Shoulders_Display } from 'next/font/google';
import { SWRConfig } from 'swr';
import { PulseProvider } from './PulseProvider';
import { AppShell } from './AppShell';
import ServiceWorkerRegister from './ServiceWorkerRegister';
import { ToastProvider } from '@/lib/pulse/toast';
import ToastContainer from './ToastContainer';
import { makeSWRCacheProvider } from '@/lib/pulse/swrCache';
import { resolveView } from '@/lib/pulse/navigation';
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

// Condensed athletic display face for big numerals (week number, day labels,
// set-progress), the distinctive "Focus" character shared by Train + guided mode.
const bigShoulders = Big_Shoulders_Display({
    subsets: ['latin'],
    weight: ['600', '700', '800'],
    variable: '--font-pulse-display',
    display: 'swap',
});

interface Props {
    userId: string;
    email: string;
    children: React.ReactNode;
}

export default function PulseLayout({ userId, email, children }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const view = resolveView(pathname);

    const navigate = useCallback(
        (v: View) => {
            router.push(`/pulse/${v}`);
        },
        [router],
    );

    // Build the cache provider once per user so its unload listeners register once.
    const cacheProvider = useMemo(() => makeSWRCacheProvider(userId), [userId]);

    return (
        <div className={`${hanken.variable} ${sora.variable} ${bigShoulders.variable}`}>
            <ServiceWorkerRegister />
            <SWRConfig value={{ provider: cacheProvider }}>
                <ToastProvider>
                    <PulseProvider userId={userId} email={email} navigate={navigate}>
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
