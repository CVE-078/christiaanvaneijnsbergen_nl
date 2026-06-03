import type { View } from '@/lib/pulse/types';

const ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
    {
        id: 'train',
        label: 'Train',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[21px] h-[21px]"
                aria-hidden>
                <path d="M3 12l9-8 9 8M5 10v10h14V10" />
            </svg>
        ),
    },
    {
        id: 'plan',
        label: 'Plan',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[21px] h-[21px]"
                aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
        ),
    },
    {
        id: 'progress',
        label: 'Progress',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[21px] h-[21px]"
                aria-hidden>
                <path d="M4 19V9m5 10V5m5 14v-7m5 7V11" />
            </svg>
        ),
    },
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[21px] h-[21px]"
                aria-hidden>
                <circle cx="12" cy="8" r="3.4" />
                <path d="M5 20c1-3.6 4-5 7-5s6 1.4 7 5" />
            </svg>
        ),
    },
    {
        id: 'explore',
        label: 'Explore',
        icon: (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[21px] h-[21px]"
                aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" />
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
            className="fixed bottom-0 left-0 right-0 flex h-16 bg-pulse-surface border-t border-pulse-border z-30"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
            {ITEMS.map(({ id, label, icon }) => {
                const active = view === id;
                return (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        className={`flex-1 flex flex-col items-center justify-center gap-[5px] bg-transparent border-none cursor-pointer py-2 transition-colors duration-150 ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                        {icon}
                        <span className="font-pulse-body text-[0.6875rem] tracking-[0.04em]">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
