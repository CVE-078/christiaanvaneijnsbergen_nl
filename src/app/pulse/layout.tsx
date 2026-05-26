import { Outfit } from 'next/font/google';
import type { Metadata } from 'next';

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

export default function PulseLayout({ children }: { children: React.ReactNode }) {
    return <div className={outfit.variable}>{children}</div>;
}
