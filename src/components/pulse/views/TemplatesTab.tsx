'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import type { RoutineTemplate, EquipmentKey } from '@/lib/pulse/types';
import RoutineSetupFlow from '@/components/pulse/RoutineSetupFlow';

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
            <div className="flex gap-2 flex-wrap">
                {(['all', 'dumbbells', 'home', 'gym'] as EquipmentFilter[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`font-pulse text-xs tracking-[0.04em] capitalize rounded-full px-3 py-1.5 border cursor-pointer ${
                            filter === f
                                ? 'bg-pulse-accent text-pulse-bg border-pulse-accent font-semibold'
                                : 'bg-transparent text-pulse-dim border-pulse-border'
                        }`}>
                        {FILTER_LABELS[f]}
                    </button>
                ))}
            </div>
            {visible.map((t) => (
                <div
                    key={t.slug}
                    className="bg-pulse-surface border border-pulse-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <span className="font-pulse text-sm font-semibold text-pulse-text">{t.name}</span>
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
