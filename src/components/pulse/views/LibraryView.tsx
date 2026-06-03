'use client';
import { useState } from 'react';
import TemplatesTab from './TemplatesTab';
import ExercisesTab from './library/ExercisesTab';
import RoutinesTab from './library/RoutinesTab';

// ── LibraryView ──────────────────────────────────────────────────────────────
export default function LibraryView() {
    const [tab, setTab] = useState<'exercises' | 'routines' | 'templates'>('exercises');

    return (
        <div className="pt-5 px-4 pb-12 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-5">
            {/* Tab switcher */}
            <div className="flex gap-2" role="tablist" aria-label="Library sections">
                {(['exercises', 'routines', 'templates'] as const).map((t) => {
                    const active = tab === t;
                    return (
                        <button
                            key={t}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(t)}
                            className={`font-pulse text-sm tracking-[0.04em] capitalize rounded-lg px-4 py-2 cursor-pointer border ${
                                active
                                    ? 'bg-pulse-accent/10 text-pulse-accent border-pulse-accent/25 font-semibold'
                                    : 'bg-transparent text-pulse-dim border-pulse-border'
                            }`}>
                            {t}
                        </button>
                    );
                })}
            </div>

            {tab === 'exercises' && <ExercisesTab />}
            {tab === 'routines' && <RoutinesTab />}
            {tab === 'templates' && <TemplatesTab />}
        </div>
    );
}
