'use client';
import { useState, type ReactNode } from 'react';
import { usePulse } from '@/context/PulseContext';
import { STYLES, recommendStyle, suggestedStyleKey, genderDefault } from '@/lib/pulse/generation';
import {
    TRAINING_STYLE_OPTIONS,
    VARIETY_OPTIONS,
    LOADING_LEAN_OPTIONS,
    RESTRICTION_OPTIONS,
} from '@/lib/pulse/generationPreferences';
import { equipmentKey } from '@/lib/pulse/utils';
import { BTN_PRIMARY_BLOCK } from './ui';
import ModalSheet from './ModalSheet';
import type { OnboardingAnswers, ExperienceLevel } from '@/lib/pulse/recommendation';
import type {
    SessionTime,
    WorkoutRoutine,
    TrainingStyle,
    VarietyPreference,
    LoadingPreference,
    RestrictionFlag,
    PriorityMuscle,
    EquipmentKey,
} from '@/lib/pulse/types';

const SECTION_LABEL = 'mb-2 font-pulse text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-pulse-muted';
const BTN_SECONDARY_BLOCK =
    'font-pulse w-full py-3 rounded-xl bg-pulse-surface-2 text-pulse-text font-semibold text-sm cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

const GOAL_LABELS: Record<string, string> = {
    build_muscle: 'Build muscle',
    lose_fat: 'Lose fat',
    general_fitness: 'General fitness',
};
const RECAP_DATE_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

const PRIORITY_OPTIONS: { key: PriorityMuscle | 'balanced'; label: string; desc: string }[] = [
    { key: 'balanced', label: 'Balanced', desc: 'Even focus across the whole body.' },
    { key: 'glutes', label: 'Glutes', desc: 'Extra glute and hip volume.' },
    { key: 'legs', label: 'Legs', desc: 'Extra lower-body volume.' },
    { key: 'chest', label: 'Chest', desc: 'Extra chest volume.' },
    { key: 'back', label: 'Back', desc: 'Extra back volume.' },
    { key: 'shoulders', label: 'Shoulders', desc: 'Extra shoulder volume.' },
    { key: 'arms', label: 'Arms', desc: 'Extra arm volume.' },
];
const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.key, o.label]));

const EXPERIENCE_OPTIONS: { key: ExperienceLevel; label: string; desc: string }[] = [
    { key: 'beginner', label: 'Beginner', desc: 'New to lifting or back after a long break.' },
    { key: 'intermediate', label: 'Intermediate', desc: 'Training consistently, comfortable with the main lifts.' },
    { key: 'advanced', label: 'Advanced', desc: 'Years of consistent, structured training.' },
];
const EXPERIENCE_LABELS: Record<string, string> = Object.fromEntries(EXPERIENCE_OPTIONS.map((o) => [o.key, o.label]));

// A selectable option inside an expanded disclosure row.
function OptionRow({
    label,
    desc,
    active,
    onClick,
    disabled,
    badge,
}: {
    label: string;
    desc?: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
    badge?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex flex-col gap-0.5 rounded-xl p-3 text-left transition-colors ${
                active ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent' : 'bg-pulse-bg ring-0 hover:bg-pulse-bg/70'
            } disabled:cursor-not-allowed disabled:opacity-50`}>
            <span className="flex items-center gap-2">
                <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                {badge && (
                    <span className="rounded-full bg-pulse-accent/15 px-2 py-0.5 font-pulse text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-pulse-accent">
                        {badge}
                    </span>
                )}
            </span>
            {desc && <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>}
        </button>
    );
}

// A collapsed tunable: the header shows the label + current value; tapping
// expands the picker inline. Single-open accordion (see `open`/`onToggle`) so
// eight tunables stay scannable instead of becoming a wall.
function DisclosureRow({
    label,
    value,
    isNew,
    open,
    onToggle,
    disabled,
    children,
}: {
    label: string;
    value: string;
    isNew?: boolean;
    open: boolean;
    onToggle: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl bg-pulse-surface-2">
            <button
                type="button"
                aria-expanded={open}
                disabled={disabled}
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex items-center gap-2">
                    <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                    {isNew && (
                        <span className="rounded-full bg-pulse-accent/15 px-1.5 py-0.5 font-pulse text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-pulse-accent">
                            New
                        </span>
                    )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <span className="font-pulse text-[0.8125rem] text-pulse-accent">{value}</span>
                    <svg
                        className={`h-3.5 w-3.5 text-pulse-muted transition-transform ${open ? 'rotate-90' : ''}`}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden>
                        <polyline points="6 3 11 8 6 13" />
                    </svg>
                </span>
            </button>
            {open && <div className="flex flex-col gap-2 px-2.5 pb-3">{children}</div>}
        </div>
    );
}

// Everything a consumer collects from the quick flow's `onComplete` and the
// generate call, bundled for hand-off to the panel. Exported so OnboardingModal
// / GenerateRoutineButton can type the local state they stash it in.
export interface TuneYourPlanState {
    /** The routine the quick flow just created. Replaced in place on "Apply changes". */
    routine: WorkoutRoutine;
    answers: OnboardingAnswers;
    trainingDays: number[];
    sessionTime: SessionTime;
    styleKey: string;
    programWeeks: number;
    startAnchor?: string;
}

interface Props extends TuneYourPlanState {
    onDone: () => void;
    /** Escape hatch for the equipment chip-pick: open the Profile manager to
     *  create / edit equipment sets. The consumer clears the panel and navigates
     *  to Profile (avoids a navigate-vs-onDone race). When absent, the link is
     *  hidden. */
    onManageEquipment?: () => void;
}

// Shown immediately after a quick-mode generation, before any sets exist, so a
// rebuild is "free": nothing logged, nothing to lose. Surfaces the personalization
// inputs the trimmed flow skipped (split, training style, priority muscle,
// experience, variety, loading lean, restrictions) as progressive-disclosure rows,
// seeded from the user's stored profile, and rebuilds the routine in place on
// "Apply changes" (generate fresh, carry over anchor + length, drop the old one).
// "Looks good" always works without touching anything.
export default function TuneYourPlanPanel({
    routine,
    answers,
    trainingDays,
    sessionTime,
    styleKey: initialStyleKey,
    programWeeks,
    startAnchor,
    onDone,
    onManageEquipment,
}: Props) {
    const {
        profile,
        generateRoutine,
        deleteRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        updatePriorityMuscle,
        equipmentProfiles = [],
    } = usePulse();
    const [current, setCurrent] = useState(routine);
    const [styleKey, setStyleKey] = useState(initialStyleKey);
    // Equipment is a chip-pick from saved profiles only (Branch B); seeded from
    // the set the routine was generated with so the matching chip starts active.
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(() => new Set(answers.equipment));
    const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>(profile.training_style ?? 'balanced');
    const [varietyPreference, setVarietyPreference] = useState<VarietyPreference>(
        profile.variety_preference ?? 'varied',
    );
    const [loadingLean, setLoadingLean] = useState<LoadingPreference | null>(profile.loading_lean ?? null);
    const [restrictions, setRestrictions] = useState<RestrictionFlag[]>(profile.movement_restrictions ?? []);
    const initialPriority: PriorityMuscle | 'balanced' =
        profile.priority_muscle ?? genderDefault(profile.gender ?? null);
    const [priorityMuscle, setPriorityMuscle] = useState<PriorityMuscle | 'balanced'>(initialPriority);
    const [experience, setExperience] = useState<ExperienceLevel>(answers.experience);
    const [regenerating, setRegenerating] = useState(false);
    // Single-open accordion: which tunable's picker is expanded (null = all collapsed).
    const [openRow, setOpenRow] = useState<string | null>(null);
    const toggleRow = (key: string) => setOpenRow((prev) => (prev === key ? null : key));

    // Snapshot of the inputs `current` was built from; "Apply changes" stays
    // disabled until something actually differs (re-running identical inputs
    // would just churn out a near-duplicate routine).
    const [applied, setApplied] = useState({
        styleKey: initialStyleKey,
        trainingStyle: profile.training_style ?? 'balanced',
        varietyPreference: profile.variety_preference ?? 'varied',
        loadingLean: profile.loading_lean ?? null,
        restrictionsKey: [...(profile.movement_restrictions ?? [])].sort().join(','),
        equipmentKey: equipmentKey(answers.equipment),
        priorityMuscle: initialPriority,
        experience: answers.experience,
    });

    const styleOptions = STYLES[trainingDays.length] ?? [];
    // Intent-aware suggestion (#18 follow-up): reacts to the live training-style
    // pick. Only badge + float when it differs from the plain count default (e.g.
    // powerbuilding at 4 days -> PHUL); the default stays pre-selected and the auto
    // fallback, so ignoring the suggestion changes nothing.
    const suggestedKey = suggestedStyleKey(trainingDays.length, trainingStyle);
    const showSuggestion = suggestedKey !== recommendStyle(trainingDays.length);
    const orderedStyleOptions =
        showSuggestion && styleOptions.some((s) => s.key === suggestedKey)
            ? [...styleOptions].sort((a, b) => (a.key === suggestedKey ? -1 : b.key === suggestedKey ? 1 : 0))
            : styleOptions;
    const restrictionsKey = [...restrictions].sort().join(',');
    const eqKey = equipmentKey(equipment);
    const dirty =
        styleKey !== applied.styleKey ||
        trainingStyle !== applied.trainingStyle ||
        varietyPreference !== applied.varietyPreference ||
        loadingLean !== applied.loadingLean ||
        restrictionsKey !== applied.restrictionsKey ||
        eqKey !== applied.equipmentKey ||
        priorityMuscle !== applied.priorityMuscle ||
        experience !== applied.experience;

    // Read-only facts the panel does not change (structural choices are a new
    // routine, not a tune). The tunables show as live disclosure rows below.
    const summary: { label: string; value: string }[] = [
        { label: 'Goal', value: GOAL_LABELS[answers.goal] ?? answers.goal },
        { label: 'Length', value: `${programWeeks} weeks` },
        { label: 'Start', value: startAnchor ? RECAP_DATE_FMT.format(new Date(startAnchor)) : 'Today' },
    ];

    const splitValue = styleOptions.find((s) => s.key === styleKey)?.name ?? styleKey;
    const trainingStyleValue = TRAINING_STYLE_OPTIONS.find((o) => o.key === trainingStyle)?.label ?? trainingStyle;
    const varietyValue = VARIETY_OPTIONS.find((o) => o.key === varietyPreference)?.label ?? varietyPreference;
    const loadingValue = loadingLean
        ? (LOADING_LEAN_OPTIONS.find((o) => o.key === loadingLean)?.label ?? loadingLean)
        : 'No preference';
    const restrictionsValue =
        restrictions.length === 0
            ? 'None'
            : restrictions.length === 1
              ? (RESTRICTION_OPTIONS.find((o) => o.key === restrictions[0])?.label ?? '1 selected')
              : `${restrictions.length} selected`;
    const equipmentValue = equipmentProfiles.find((p) => equipmentKey(p.equipment) === eqKey)?.name ?? 'Custom';

    function toggleRestriction(flag: RestrictionFlag) {
        setRestrictions((prev) => (prev.includes(flag) ? prev.filter((r) => r !== flag) : [...prev, flag]));
    }

    async function applyChanges() {
        setRegenerating(true);
        try {
            // Priority muscle is read server-side from the profile by the generate
            // action (it is not a generateRoutine param), so persist it first.
            if (priorityMuscle !== applied.priorityMuscle) {
                await updatePriorityMuscle(priorityMuscle);
            }
            const next = await generateRoutine(
                { ...answers, equipment, experience },
                trainingDays,
                sessionTime,
                styleKey,
                undefined,
                trainingStyle,
                varietyPreference,
                loadingLean ?? undefined,
                restrictions,
                startAnchor,
            );
            if (startAnchor) await setProgramAnchor(next.id, startAnchor);
            if (programWeeks !== 12) await updateRoutineProgramWeeks(next.id, programWeeks);
            await deleteRoutine(current.id);
            setCurrent(next);
            setApplied({
                styleKey,
                trainingStyle,
                varietyPreference,
                loadingLean,
                restrictionsKey,
                equipmentKey: eqKey,
                priorityMuscle,
                experience,
            });
            setOpenRow(null);
        } finally {
            setRegenerating(false);
        }
    }

    return (
        <ModalSheet
            open
            onClose={onDone}
            title="Tune your plan"
            subtitle={`${current.name} · ${trainingDays.length} days/week`}
            footer={
                <div className="flex flex-col gap-2">
                    <button onClick={applyChanges} disabled={!dirty || regenerating} className={BTN_PRIMARY_BLOCK}>
                        {regenerating ? 'Rebuilding your plan…' : 'Apply changes'}
                    </button>
                    <button onClick={onDone} disabled={regenerating} className={BTN_SECONDARY_BLOCK}>
                        Looks good, let&apos;s train
                    </button>
                </div>
            }>
            <div className="flex flex-col gap-4 px-6">
                <p className="font-pulse text-[0.8125rem] leading-[1.5] text-pulse-dim">
                    Adjust anything below and Pulse rebuilds on the spot. Nothing is logged yet, so there is nothing to
                    lose.
                </p>

                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-pulse-surface-2 p-3">
                    {summary.map((item) => (
                        <div key={item.label} className="flex flex-col gap-0.5">
                            <dt className="font-pulse text-[0.5625rem] uppercase tracking-[0.1em] text-pulse-muted">
                                {item.label}
                            </dt>
                            <dd className="font-pulse text-[0.8125rem] text-pulse-text">{item.value}</dd>
                        </div>
                    ))}
                </dl>

                <div>
                    <p className={SECTION_LABEL}>Fine-tune</p>
                    <div className="flex flex-col gap-2">
                        <DisclosureRow
                            label="Training style"
                            value={trainingStyleValue}
                            open={openRow === 'style'}
                            onToggle={() => toggleRow('style')}
                            disabled={regenerating}>
                            {TRAINING_STYLE_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={trainingStyle === key}
                                    onClick={() => setTrainingStyle(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>

                        {styleOptions.length > 1 && (
                            <DisclosureRow
                                label="Split"
                                value={splitValue}
                                open={openRow === 'split'}
                                onToggle={() => toggleRow('split')}
                                disabled={regenerating}>
                                {orderedStyleOptions.map((s) => (
                                    <OptionRow
                                        key={s.key}
                                        label={s.name}
                                        desc={s.bestFor}
                                        active={styleKey === s.key}
                                        onClick={() => setStyleKey(s.key)}
                                        disabled={regenerating}
                                        badge={showSuggestion && s.key === suggestedKey ? 'Suggested' : undefined}
                                    />
                                ))}
                            </DisclosureRow>
                        )}

                        <DisclosureRow
                            label="Priority muscle"
                            value={PRIORITY_LABELS[priorityMuscle] ?? priorityMuscle}
                            isNew
                            open={openRow === 'priority'}
                            onToggle={() => toggleRow('priority')}
                            disabled={regenerating}>
                            {PRIORITY_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={priorityMuscle === key}
                                    onClick={() => setPriorityMuscle(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>

                        <DisclosureRow
                            label="Experience"
                            value={EXPERIENCE_LABELS[experience] ?? experience}
                            isNew
                            open={openRow === 'experience'}
                            onToggle={() => toggleRow('experience')}
                            disabled={regenerating}>
                            {EXPERIENCE_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={experience === key}
                                    onClick={() => setExperience(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>

                        <DisclosureRow
                            label="Exercise variety"
                            value={varietyValue}
                            open={openRow === 'variety'}
                            onToggle={() => toggleRow('variety')}
                            disabled={regenerating}>
                            {VARIETY_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={varietyPreference === key}
                                    onClick={() => setVarietyPreference(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>

                        {equipmentProfiles.length > 0 && (
                            <DisclosureRow
                                label="Equipment"
                                value={equipmentValue}
                                open={openRow === 'equipment'}
                                onToggle={() => toggleRow('equipment')}
                                disabled={regenerating}>
                                <div className="flex flex-wrap gap-2 px-1 pt-1">
                                    {equipmentProfiles.map((p) => {
                                        const active = equipmentKey(p.equipment) === eqKey;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                aria-pressed={active}
                                                disabled={regenerating}
                                                onClick={() => setEquipment(new Set(p.equipment))}
                                                className={`rounded-full border px-3 py-1.5 font-pulse text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    active
                                                        ? 'border-pulse-accent bg-pulse-accent/10 text-pulse-accent'
                                                        : 'border-pulse-border bg-pulse-bg text-pulse-dim'
                                                }`}>
                                                {p.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {onManageEquipment && (
                                    <button
                                        type="button"
                                        disabled={regenerating}
                                        onClick={onManageEquipment}
                                        className="px-1 pt-1 text-left font-pulse text-xs text-pulse-accent disabled:opacity-50">
                                        Manage in Profile
                                    </button>
                                )}
                            </DisclosureRow>
                        )}

                        <DisclosureRow
                            label="Equipment preference"
                            value={loadingValue}
                            open={openRow === 'loading'}
                            onToggle={() => toggleRow('loading')}
                            disabled={regenerating}>
                            <OptionRow
                                label="No preference"
                                desc="Pulse chooses freely from what you own."
                                active={loadingLean === null}
                                onClick={() => setLoadingLean(null)}
                                disabled={regenerating}
                            />
                            {LOADING_LEAN_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={loadingLean === key}
                                    onClick={() => setLoadingLean(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>

                        <DisclosureRow
                            label="Movement restrictions"
                            value={restrictionsValue}
                            open={openRow === 'restrictions'}
                            onToggle={() => toggleRow('restrictions')}
                            disabled={regenerating}>
                            {RESTRICTION_OPTIONS.map(({ key, label, desc }) => (
                                <OptionRow
                                    key={key}
                                    label={label}
                                    desc={desc}
                                    active={restrictions.includes(key)}
                                    onClick={() => toggleRestriction(key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </DisclosureRow>
                    </div>
                </div>
            </div>
        </ModalSheet>
    );
}
