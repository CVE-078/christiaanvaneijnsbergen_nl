'use client';
import type { WorkoutType } from '@/lib/pulse/types';
import { MONO, ACCENT, BORDER } from '@/lib/pulse/theme';

interface Props {
    activeTab: WorkoutType;
    onSelect: (t: WorkoutType) => void;
}

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

export default function WorkoutTabs({ activeTab, onSelect }: Props) {
    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSelect(TABS[(idx + 1) % TABS.length].type);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSelect(TABS[(idx - 1 + TABS.length) % TABS.length].type);
        }
    }

    return (
        <div role="tablist" style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            {TABS.map(({ type, label }, idx) => {
                const active = activeTab === type;
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        style={{
                            flex: 1,
                            padding: '0.875rem 0',
                            textAlign: 'center',
                            fontFamily: MONO,
                            fontSize: '0.6875rem',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: active ? '#fff' : '#555',
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`,
                            marginBottom: '-1px',
                        }}>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
