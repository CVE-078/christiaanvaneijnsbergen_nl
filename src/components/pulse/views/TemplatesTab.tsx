'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import type { RoutineTemplate, EquipmentKey } from '@/lib/pulse/types';
import RoutineSetupFlow from '@/components/pulse/RoutineSetupFlow';
import FilterChips from './library/FilterChips';

type EquipmentFilter = 'all' | 'dumbbells' | 'home' | 'gym';

const FILTER_EQUIPMENT: Record<Exclude<EquipmentFilter, 'all'>, Set<EquipmentKey>> = {
    dumbbells: new Set(['dumbbells']),
    home: new Set(['dumbbells', 'barbell', 'bench']),
    gym: new Set(['barbell', 'bench', 'cables', 'machines']),
};

const FILTER_LABELS: Record<EquipmentFilter, string> = {
    all: 'All',
    dumbbells: 'Dumbbells',
    home: 'Home Gym',
    gym: 'Full Gym',
};

// One-accent Slate rule: experience level is differentiated by its uppercase
// tracked label, not by color (matches the neutralized CategoryBadge).
const LEVEL_CLASS: Record<RoutineTemplate['experience_level'], string> = {
    beginner: 'text-pulse-dim',
    intermediate: 'text-pulse-dim',
    advanced: 'text-pulse-dim',
};

export default function TemplatesTab() {
    const { cloneTemplate, navigate } = usePulse();
    // Templates are static per session — dedupe aggressively and don't refetch on focus.
    const { data: templates = [] } = useSWR<RoutineTemplate[]>('/api/pulse/templates', fetcher, {
        ...SWR_READ_OPTS,
        dedupingInterval: 600000,
        revalidateIfStale: false,
    });
    const [filter, setFilter] = useState<EquipmentFilter>('all');
    const [setupTemplate, setSetupTemplate] = useState<RoutineTemplate | null>(null);

    const visible =
        filter === 'all' ? templates : templates.filter((t) => templateMatchesEquipment(t, FILTER_EQUIPMENT[filter]));

    return (
        <div className="flex flex-col gap-4">
            {/* Unified toolbar — same scrollable FilterChips rail as the other tabs. */}
            <div className="flex items-center gap-2">
                <FilterChips
                    className="flex-1"
                    items={(['all', 'dumbbells', 'home', 'gym'] as EquipmentFilter[]).map((f) => ({
                        key: f,
                        label: FILTER_LABELS[f],
                    }))}
                    activeKey={filter}
                    onSelect={(k) => setFilter(k as EquipmentFilter)}
                />
            </div>

            {/* Template list — unified row card. */}
            <div className="flex flex-col gap-2">
                {visible.map((t) => (
                    <div
                        key={t.slug}
                        className="bg-pulse-surface rounded-xl px-3 py-2.5 flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <span className="font-pulse text-sm font-semibold text-pulse-text flex-1 min-w-0 truncate">
                                {t.name}
                            </span>
                            <button
                                onClick={() => setSetupTemplate(t)}
                                className="font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 rounded-lg px-3 py-1.5 shrink-0 cursor-pointer">
                                Use this
                            </button>
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                            <span
                                className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${LEVEL_CLASS[t.experience_level]}`}>
                                {t.experience_level}
                            </span>
                            <span className="font-pulse text-[0.625rem] text-pulse-dim">
                                {t.days_per_week}×/week · {t.session_time}
                            </span>
                        </div>
                        <p className="font-pulse text-xs text-pulse-muted">{t.description}</p>
                    </div>
                ))}
            </div>

            {setupTemplate && (
                <RoutineSetupFlow
                    initial={{
                        equipment: setupTemplate.required_equipment,
                        experience: setupTemplate.experience_level,
                    }}
                    completeLabel="Use this routine"
                    onComplete={async ({ answers, trainingDays, sessionTime }) => {
                        await cloneTemplate(setupTemplate.slug, trainingDays, sessionTime, answers.experience);
                        navigate('train');
                    }}
                    onClose={() => setSetupTemplate(null)}
                />
            )}
        </div>
    );
}
