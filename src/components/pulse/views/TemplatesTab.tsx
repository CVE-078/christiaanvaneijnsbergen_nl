'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import type { RoutineTemplate, EquipmentKey } from '@/lib/pulse/types';

type EquipmentFilter = 'all' | 'dumbbells' | 'home' | 'gym';

const FILTER_EQUIPMENT: Record<Exclude<EquipmentFilter,'all'>, Set<EquipmentKey>> = {
    dumbbells: new Set(['dumbbells']),
    home: new Set(['dumbbells','barbell','bench']),
    gym: new Set(['barbell','bench','cables','machines']),
};

const FILTER_LABELS: Record<EquipmentFilter, string> = {
    all: 'All', dumbbells: 'Dumbbells', home: 'Home Gym', gym: 'Full Gym',
};

const LEVEL_CLASS: Record<RoutineTemplate['experience_level'], string> = {
    beginner: 'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced: 'text-red-400',
};

export default function TemplatesTab() {
    const { cloneTemplate, navigate, routines } = usePulse();
    const { data: templates = [] } = useSWR<RoutineTemplate[]>(
        '/api/pulse/templates',
        (url: string) => fetch(url).then((r) => r.json()),
    );
    const [filter, setFilter] = useState<EquipmentFilter>('all');
    const [loading, setLoading] = useState<string | null>(null);

    const visible = filter === 'all'
        ? templates
        : templates.filter((t) => templateMatchesEquipment(t, FILTER_EQUIPMENT[filter]));

    async function handleUse(t: RoutineTemplate) {
        if (
            routines.length > 0 &&
            !window.confirm(`This will replace your active routine with "${t.name}". Continue?`)
        ) return;
        setLoading(t.slug);
        await cloneTemplate(t.slug);
        navigate('log');
        setLoading(null);
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2 flex-wrap">
                {(['all','dumbbells','home','gym'] as EquipmentFilter[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`font-pulse text-xs tracking-[0.04em] capitalize rounded-full px-3 py-1.5 border cursor-pointer ${
                            filter === f
                                ? 'bg-pulse-accent text-black border-pulse-accent font-semibold'
                                : 'bg-transparent text-pulse-dim border-pulse-border'
                        }`}>
                        {FILTER_LABELS[f]}
                    </button>
                ))}
            </div>
            {visible.map((t) => (
                <div key={t.slug} className="bg-pulse-surface border border-pulse-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <span className="font-pulse text-sm font-semibold text-white">{t.name}</span>
                        <button
                            onClick={() => handleUse(t)}
                            disabled={loading === t.slug}
                            className="font-pulse text-xs font-semibold text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/20 rounded-lg px-3 py-1.5 shrink-0 cursor-pointer disabled:opacity-50">
                            {loading === t.slug ? '…' : 'Use this'}
                        </button>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <span className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${LEVEL_CLASS[t.experience_level]}`}>
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
    );
}
