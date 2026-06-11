import type { ReactNode } from 'react';

// The shared frame for every auth screen: centered surface card with the Pulse
// wordmark and tagline. Mirrors the login page's card; forms render as children.
export default function AuthShell({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-pulse-bg flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] bg-pulse-surface rounded-2xl p-7 flex flex-col">
                <div className="mb-7">
                    <div className="font-pulse font-bold text-lg tracking-[0.06em] uppercase text-pulse-text">
                        Pulse<span className="text-pulse-accent">.</span>
                    </div>
                    <div className="font-pulse text-[0.8125rem] tracking-[0.02em] text-pulse-dim mt-1">
                        An adaptive strength coach, on any device
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
