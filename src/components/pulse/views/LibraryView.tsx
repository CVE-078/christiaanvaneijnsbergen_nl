'use client';
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import PageTitle from '@/components/pulse/PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import SegmentedTabs from '@/components/pulse/SegmentedTabs';
import ExercisesTab from './library/ExercisesTab';
import RoutinesTab from './library/RoutinesTab';

type LibraryTab = 'exercises' | 'routines';

const LIBRARY_TABS = [
    { id: 'exercises', label: 'Exercises' },
    { id: 'routines', label: 'Routines' },
];

// ── LibraryView ──────────────────────────────────────────────────────────────
export default function LibraryView() {
    const [tab, setTab] = useState<LibraryTab>('exercises');
    const { loading, errors, retry } = usePulse();

    if (errors?.exercises || errors?.routines) return <ErrorState onRetry={retry} />;
    if (loading?.exercises || loading?.routines) return <PageSkeleton />;

    return (
        <div className="px-4 pt-5 pb-12 mx-auto w-full max-w-[600px] lg:max-w-[1000px] lg:px-6 lg:pt-6 lg:pb-12 flex flex-col gap-5">
            <PageTitle>Library</PageTitle>

            {/* Tab switcher */}
            <SegmentedTabs
                tabs={LIBRARY_TABS}
                active={tab}
                onChange={(id) => setTab(id as LibraryTab)}
                ariaLabel="Library sections"
                variant="solid"
            />

            {tab === 'exercises' && <ExercisesTab />}
            {tab === 'routines' && <RoutinesTab />}
        </div>
    );
}
