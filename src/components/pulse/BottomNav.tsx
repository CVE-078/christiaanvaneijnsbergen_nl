import type { View } from '@/lib/pulse/types';

const ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
    {
        id: 'log',
        label: 'Log',
        icon: (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <rect x="3" y="3" width="6" height="6" rx="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" />
            </svg>
        ),
    },
    {
        id: 'program',
        label: 'Program',
        icon: (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <polyline points="3,14 7,9 11,11 17,5" />
                <line x1="3" y1="17" x2="17" y2="17" />
            </svg>
        ),
    },
    {
        id: 'history',
        label: 'History',
        icon: (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <circle cx="10" cy="10" r="7" />
                <polyline points="10,6 10,10 13,12" />
            </svg>
        ),
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
                <circle cx="10" cy="7" r="3" />
                <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" />
            </svg>
        ),
    },
];

interface Props {
    view: View;
    onNavigate: (v: View) => void;
}

export default function BottomNav({ view, onNavigate }: Props) {
    return (
        <nav
            aria-label="Main navigation"
            className="fixed bottom-0 left-0 right-0 flex h-16 bg-pulse-bg/95 backdrop-blur-sm border-t border-pulse-border z-30"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
            {ITEMS.map(({ id, label, icon }) => {
                const active = view === id;
                return (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer py-2 transition-colors duration-150 ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                        {icon}
                        <span className="font-pulse text-[0.625rem] font-semibold">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
