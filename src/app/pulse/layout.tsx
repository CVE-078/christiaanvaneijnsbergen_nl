import { JetBrains_Mono, Inter } from 'next/font/google';
import type { Metadata } from 'next';

const mono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--pulse-mono',
    display: 'swap',
});

// Only weights actually used across Pulse components
const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--pulse-sans',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Pulse',
    robots: { index: false, follow: false },
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
    return <div className={`${mono.variable} ${inter.variable}`}>{children}</div>;
}
