import type { View } from '@/lib/pulse/types';

const ITEMS: { id: View; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
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
            /* safe-area-inset cannot be expressed in Tailwind v4 — must stay inline */
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
            {ITEMS.map(({ id, label }) => {
                const active = view === id;
                return (
                    <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-label={label}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 bg-transparent border-none cursor-pointer py-2 ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                        <span className="font-pulse text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
                            {label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
