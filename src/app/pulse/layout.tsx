import { Outfit } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const outfit = Outfit({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700', '800'],
    variable: '--pulse-sans',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Pulse',
    robots: { index: false, follow: false },
};

export default function PulseRootLayout({ children }: { children: ReactNode }) {
    return <div className={`${outfit.variable} -m-5 md:-m-8`}>{children}</div>;
}
