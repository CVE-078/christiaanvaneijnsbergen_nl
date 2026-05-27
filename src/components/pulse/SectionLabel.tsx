import type { ReactNode } from 'react';

interface SectionLabelProps {
    children: ReactNode;
    className?: string;
}

export default function SectionLabel({ children, className }: SectionLabelProps) {
    return (
        <div className={`font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted${className ? ` ${className}` : ''}`}>
            {children}
        </div>
    );
}
