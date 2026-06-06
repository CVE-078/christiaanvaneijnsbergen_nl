'use client';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, SWR_READ_OPTS } from '@/lib/pulse/fetcher';
import { usePulse } from '@/context/PulseContext';
import type { RoutineTemplate } from '@/lib/pulse/types';
import {
    filterTemplates,
    EQUIPMENT_LABELS,
    GOAL_LABELS,
    EXPERIENCE_LABELS,
    type EquipmentFilter,
    type GoalFilter,
    type ExperienceFilter,
} from '@/lib/pulse/templateFilters';
import RoutineSetupFlow from '@/components/pulse/RoutineSetupFlow';
import FilterChips from './library/FilterChips';
import SectionLabel from '@/components/pulse/SectionLabel';
import { BTN_GHOST } from '@/components/pulse/ui';

// One-accent Slate rule: experience level is differentiated by its uppercase
// tracked label, not by color (matches the neutralized CategoryBadge).
const LEVEL_CLASS: Record<RoutineTemplate['experience_level'], string> = {
    beginner: 'text-pulse-dim',
    intermediate: 'text-pulse-dim',
    advanced: 'text-pulse-dim',
};

export default function TemplatesTab() {
    const { cloneTemplate, setProgramAnchor, updateRoutineProgramWeeks, navigate, profile } = usePulse();
    // Templates are static per session, dedupe aggressively and don't refetch on focus.
    const { data: templates = [] } = useSWR<RoutineTemplate[]>('/api/pulse/templates', fetcher, {
        ...SWR_READ_OPTS,
        dedupingInterval: 600000,
        revalidateIfStale: false,
    });
    const [equip, setEquip] = useState<EquipmentFilter>('all');
    const [goal, setGoal] = useState<GoalFilter>('all');
    const [experience, setExperience] = useState<ExperienceFilter>('all');
    const [days, setDays] = useState<string>('all');
    const [forYou, setForYou] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [setupTemplate, setSetupTemplate] = useState<RoutineTemplate | null>(null);

    // Distinct days-per-week values present, for the Days chips.
    const dayValues = useMemo(
        () => [...new Set(templates.map((t) => t.days_per_week))].sort((a, b) => a.localeCompare(b)),
        [templates],
    );

    const visible = filterTemplates(templates, { equip, goal, experience, days, forYou, gender: profile.gender });
    // Count the filters tucked behind the expander that are active, for the badge.
    const advancedActive = (experience !== 'all' ? 1 : 0) + (days !== 'all' ? 1 : 0) + (forYou ? 1 : 0);

    return (
        <div className="flex flex-col gap-3">
            {/* Goal rail + a Filters expander toggle for the less-used dimensions. */}
            <div className="flex items-center gap-2">
                <FilterChips
                    className="flex-1"
                    items={(['all', 'build_muscle', 'lose_fat', 'general_fitness'] as GoalFilter[]).map((g) => ({
                        key: g,
                        label: GOAL_LABELS[g],
                    }))}
                    activeKey={goal}
                    onSelect={(k) => setGoal(k as GoalFilter)}
                />
                <button onClick={() => setShowFilters((v) => !v)} className={`${BTN_GHOST} shrink-0`}>
                    Filters{advancedActive > 0 ? ` (${advancedActive})` : ''}
                </button>
            </div>

            {/* Equipment rail, the second always-visible dimension. */}
            <FilterChips
                items={(['all', 'dumbbells', 'home', 'gym'] as EquipmentFilter[]).map((f) => ({
                    key: f,
                    label: EQUIPMENT_LABELS[f],
                }))}
                activeKey={equip}
                onSelect={(k) => setEquip(k as EquipmentFilter)}
            />

            {/* Expander: experience, days/week, and the "For you" gender-fit toggle. */}
            {showFilters && (
                <div className="bg-pulse-surface rounded-xl p-3 flex flex-col gap-3">
                    <div>
                        <SectionLabel className="mb-2">Experience</SectionLabel>
                        <FilterChips
                            items={(['all', 'beginner', 'intermediate', 'advanced'] as ExperienceFilter[]).map((e) => ({
                                key: e,
                                label: EXPERIENCE_LABELS[e],
                            }))}
                            activeKey={experience}
                            onSelect={(k) => setExperience(k as ExperienceFilter)}
                        />
                    </div>
                    <div>
                        <SectionLabel className="mb-2">Days / week</SectionLabel>
                        <FilterChips
                            items={[
                                { key: 'all', label: 'Any' },
                                ...dayValues.map((d) => ({ key: d, label: `${d}×` })),
                            ]}
                            activeKey={days}
                            onSelect={setDays}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <SectionLabel>For you</SectionLabel>
                            <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-0.5">
                                Hide templates not suited to your profile.
                            </p>
                        </div>
                        <button
                            role="switch"
                            aria-checked={forYou}
                            aria-label="Show only templates for you"
                            onClick={() => setForYou((v) => !v)}
                            className={`relative w-11 h-6 rounded-full shrink-0 cursor-pointer border-none transition-colors ${forYou ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}>
                            <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-pulse-bg transition-transform ${forYou ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
            )}

            {visible.length === 0 && (
                <p className="font-pulse text-xs text-pulse-muted py-2">No templates match these filters.</p>
            )}

            {/* Template list, unified row card. */}
            <div className="flex flex-col gap-2">
                {visible.map((t) => (
                    <div key={t.slug} className="bg-pulse-surface rounded-xl px-3 py-2.5 flex flex-col gap-2">
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
                    onComplete={async ({ answers, trainingDays, sessionTime, startAnchor, programWeeks }) => {
                        const routine = await cloneTemplate(
                            setupTemplate.slug,
                            trainingDays,
                            sessionTime,
                            answers.experience,
                        );
                        if (startAnchor) await setProgramAnchor(routine.id, startAnchor);
                        // New routines default to 12 weeks in the DB; only write when it differs.
                        if (programWeeks !== 12) await updateRoutineProgramWeeks(routine.id, programWeeks);
                        navigate('train');
                    }}
                    onClose={() => setSetupTemplate(null)}
                />
            )}
        </div>
    );
}
