import type { ReactNode } from 'react';

interface TabButtonProps {
    id: string;
    active: boolean;
    controls: string;
    onClick: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    badge?: string;
    className?: string;
    variant?: 'soft' | 'solid';
    children: ReactNode;
}

export default function TabButton({
    id,
    active,
    controls,
    onClick,
    onKeyDown,
    badge,
    className = '',
    variant = 'soft',
    children,
}: TabButtonProps) {
    const activeClass =
        variant === 'solid'
            ? 'bg-pulse-accent text-pulse-bg border-transparent'
            : 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent';
    const inactiveClass =
        variant === 'solid'
            ? 'bg-transparent border-transparent text-pulse-dim hover:text-pulse-text'
            : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text';

    return (
        <button
            role="tab"
            id={id}
            aria-selected={active}
            aria-controls={controls}
            onClick={onClick}
            onKeyDown={onKeyDown}
            className={`border cursor-pointer transition-all duration-150 ${
                active ? activeClass : inactiveClass
            } ${className}`}>
            {children}
            {badge != null && (
                <span
                    className={`font-pulse text-[0.625rem] rounded-full px-1.5 py-0.5 ${
                        active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                    }`}>
                    {badge}
                </span>
            )}
        </button>
    );
}
