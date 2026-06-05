'use client';
import { useEffect, useRef } from 'react';

export interface FilterChipItem {
    key: string;
    label: string;
    /** Optional count badge (e.g. exercises per category). */
    count?: number;
}

// A single-row filter rail shared by the Library tabs. It stays one row and
// scrolls horizontally rather than wrapping (wrapping stacked into many rows on
// narrow screens). Touch/trackpad scroll it natively; the wheel handler maps a
// vertical mouse wheel to horizontal scroll so it is usable with a plain mouse
// on desktop, where a horizontal overflow otherwise can't be panned.
export default function FilterChips({
    items,
    activeKey,
    onSelect,
    className = '',
}: {
    items: FilterChipItem[];
    activeKey: string;
    onSelect: (key: string) => void;
    className?: string;
}) {
    const railRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = railRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            // Only hijack a predominantly-vertical wheel when there is something
            // to scroll horizontally; leave trackpad horizontal gestures alone.
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            if (el.scrollWidth <= el.clientWidth) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    return (
        <div className={`relative min-w-0 ${className}`}>
            <div
                ref={railRef}
                className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {items.map((item) => {
                    const active = item.key === activeKey;
                    return (
                        <button
                            key={item.key}
                            onClick={() => onSelect(item.key)}
                            aria-label={item.label}
                            aria-pressed={active}
                            className={`font-pulse text-xs tracking-[0.02em] capitalize rounded-full px-3 py-1.5 cursor-pointer border-none shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                                active ? 'bg-pulse-accent text-pulse-bg font-semibold' : 'bg-pulse-surface-2 text-pulse-dim'
                            }`}>
                            {item.label}
                            {item.count !== undefined && (
                                <span
                                    className={`font-pulse text-[0.625rem] font-semibold tabular-nums rounded px-1 ${
                                        active ? 'bg-pulse-bg/20 text-pulse-bg' : 'bg-white/5 text-pulse-muted'
                                    }`}>
                                    {item.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-pulse-bg to-transparent" />
        </div>
    );
}
