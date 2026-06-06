'use client';
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import PageTitle from '@/components/pulse/PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import TemplatesTab from './TemplatesTab';
import ExercisesTab from './library/ExercisesTab';
import RoutinesTab from './library/RoutinesTab';

// ── LibraryView ──────────────────────────────────────────────────────────────
export default function LibraryView() {
    const [tab, setTab] = useState<'exercises' | 'routines' | 'templates'>('routines');
    const { loading, errors, retry } = usePulse();

    if (errors?.exercises || errors?.routines) return <ErrorState onRetry={retry} />;
    if (loading?.exercises || loading?.routines) return <PageSkeleton />;

    return (
        <div className="pt-5 px-4 pb-12 max-w-[600px] lg:max-w-[820px] mx-auto flex flex-col gap-5">
            <PageTitle>Library</PageTitle>

            {/* Tab switcher */}
            <div className="flex gap-2" role="tablist" aria-label="Library sections">
                {(['routines', 'exercises', 'templates'] as const).map((t) => {
                    const active = tab === t;
                    return (
                        <button
                            key={t}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(t)}
                            className={`font-pulse text-sm tracking-[0.04em] capitalize rounded-lg px-4 py-2 cursor-pointer border-none ${
                                active
                                    ? 'bg-pulse-accent text-pulse-bg font-semibold'
                                    : 'bg-pulse-surface-2 text-pulse-dim'
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
