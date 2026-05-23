import { JetBrains_Mono, Inter } from 'next/font/google';
import type { Metadata } from 'next';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--pulse-mono',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--pulse-sans',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Pulse' };

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} ${inter.variable}`}>{children}</div>;
}
