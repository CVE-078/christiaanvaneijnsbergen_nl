import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '700'] });

export const metadata: Metadata = {
    title: 'Christiaan van Eijnsbergen',
    description: 'Christiaan van Eijnsbergen is a Front-end Developer based in The Netherlands',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="scroll-smooth">
            <body className={`${poppins.className} scroll-smooth text-primary bg-primary leading-normal p-5 md:p-8`}>
                {children}
            </body>
        </html>
    );
}
