'use client';
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { STYLES } from '@/lib/pulse/generation';
import {
    TRAINING_STYLE_OPTIONS,
    VARIETY_OPTIONS,
    LOADING_LEAN_OPTIONS,
    RESTRICTION_OPTIONS,
} from '@/lib/pulse/generationPreferences';
import { equipmentKey } from '@/lib/pulse/utils';
import { BTN_PRIMARY_BLOCK } from './ui';
import type { OnboardingAnswers } from '@/lib/pulse/recommendation';
import type {
    SessionTime,
    WorkoutRoutine,
    TrainingStyle,
    VarietyPreference,
    LoadingPreference,
    RestrictionFlag,
    EquipmentKey,
} from '@/lib/pulse/types';

const WRAP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
const CARD = 'flex max-h-[88vh] w-full max-w-[420px] flex-col gap-5 overflow-y-auto rounded-2xl bg-pulse-surface p-6';
const SECTION_LABEL = 'mb-2 font-pulse text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-pulse-muted';
const BTN_SECONDARY_BLOCK =
    'font-pulse w-full py-3 rounded-xl bg-pulse-surface-2 text-pulse-text font-semibold text-sm cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed';

const GOAL_LABELS: Record<string, string> = {
    build_muscle: 'Build muscle',
    lose_fat: 'Lose fat',
    general_fitness: 'General fitness',
};
const RECAP_DATE_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function Row({
    label,
    desc,
    active,
    onClick,
    disabled,
}: {
    label: string;
    desc?: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`flex flex-col gap-0.5 rounded-xl p-3 text-left transition-colors ${
                active
                    ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                    : 'bg-pulse-surface-2 ring-0 hover:bg-pulse-surface-2/70'
            } disabled:cursor-not-allowed disabled:opacity-50`}>
            <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
            {desc && <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>}
        </button>
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
// inputs the trimmed flow skipped (split, training style, variety, loading lean,
// restrictions), seeded from the user's stored profile, and rebuilds the routine
// in place on "Apply changes" (generate fresh, carry over anchor + length, drop
// the old one). "Looks good" always works without touching anything.
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
    const [regenerating, setRegenerating] = useState(false);
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
    });

    const styleOptions = STYLES[trainingDays.length] ?? [];
    const restrictionsKey = [...restrictions].sort().join(',');
    const eqKey = equipmentKey(equipment);
    const dirty =
        styleKey !== applied.styleKey ||
        trainingStyle !== applied.trainingStyle ||
        varietyPreference !== applied.varietyPreference ||
        loadingLean !== applied.loadingLean ||
        restrictionsKey !== applied.restrictionsKey ||
        eqKey !== applied.equipmentKey;

    // Transparency: the fixed inputs this plan was built from. The four tunable
    // personalization inputs (training style / variety / loading / restrictions)
    // are intentionally NOT repeated here, they show right below as live, active
    // pickers; the recap covers the choices that aren't editable in this panel.
    const summary: { label: string; value: string }[] = [
        { label: 'Goal', value: GOAL_LABELS[answers.goal] ?? answers.goal },
        { label: 'Days / week', value: String(trainingDays.length) },
        { label: 'Session', value: sessionTime },
        { label: 'Split', value: styleOptions.find((s) => s.key === styleKey)?.name ?? styleKey },
        { label: 'Length', value: `${programWeeks} weeks` },
        { label: 'Start', value: startAnchor ? RECAP_DATE_FMT.format(new Date(startAnchor)) : 'Today' },
    ];

    function toggleRestriction(flag: RestrictionFlag) {
        setRestrictions((prev) => (prev.includes(flag) ? prev.filter((r) => r !== flag) : [...prev, flag]));
    }

    async function applyChanges() {
        setRegenerating(true);
        try {
            const next = await generateRoutine(
                { ...answers, equipment },
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
            });
        } finally {
            setRegenerating(false);
        }
    }

    return (
        <div className={WRAP}>
            <div className={CARD}>
                <div>
                    <p className="font-pulse text-lg font-medium tracking-[-0.01em] text-pulse-text">
                        Here&apos;s your plan
                    </p>
                    <p className="mt-1 font-pulse text-sm text-pulse-dim">{current.name}</p>
                    {current.rationale && (
                        <p className="mt-2 font-pulse text-[0.8125rem] leading-[1.55] text-pulse-dim">
                            {current.rationale}
                        </p>
                    )}
                </div>

                <div>
                    <p className={SECTION_LABEL}>Plan summary</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-pulse-surface-2 p-3">
                        {summary.map((item) => (
                            <div key={item.label} className="flex justify-between gap-2">
                                <dt className="font-pulse text-xs text-pulse-muted">{item.label}</dt>
                                <dd className="font-pulse text-xs text-pulse-text text-right">{item.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <p className="font-pulse text-[0.8125rem] text-pulse-dim">
                    Want to fine-tune it first? Adjust anything below and Pulse rebuilds the plan on the spot, nothing
                    is logged yet so there is nothing to lose.
                </p>

                {equipmentProfiles.length > 0 && (
                    <div>
                        <p className={SECTION_LABEL}>Equipment</p>
                        <div className="flex flex-wrap gap-2">
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
                                                : 'border-pulse-border bg-pulse-surface-2 text-pulse-dim'
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
                                className="mt-2 font-pulse text-xs text-pulse-accent disabled:opacity-50">
                                Manage in Profile
                            </button>
                        )}
                    </div>
                )}

                {styleOptions.length > 1 && (
                    <div>
                        <p className={SECTION_LABEL}>Change split</p>
                        <div className="flex flex-col gap-2">
                            {styleOptions.map((s) => (
                                <Row
                                    key={s.key}
                                    label={s.name}
                                    desc={s.bestFor}
                                    active={styleKey === s.key}
                                    onClick={() => setStyleKey(s.key)}
                                    disabled={regenerating}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <p className={SECTION_LABEL}>Training style</p>
                    <div className="flex flex-col gap-2">
                        {TRAINING_STYLE_OPTIONS.map(({ key, label, desc }) => (
                            <Row
                                key={key}
                                label={label}
                                desc={desc}
                                active={trainingStyle === key}
                                onClick={() => setTrainingStyle(key)}
                                disabled={regenerating}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <p className={SECTION_LABEL}>Exercise variety</p>
                    <div className="flex flex-col gap-2">
                        {VARIETY_OPTIONS.map(({ key, label, desc }) => (
                            <Row
                                key={key}
                                label={label}
                                desc={desc}
                                active={varietyPreference === key}
                                onClick={() => setVarietyPreference(key)}
                                disabled={regenerating}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <p className={SECTION_LABEL}>Equipment preference</p>
                    <div className="flex flex-col gap-2">
                        <Row
                            label="No preference"
                            desc="Pulse chooses freely from what you own."
                            active={loadingLean === null}
                            onClick={() => setLoadingLean(null)}
                            disabled={regenerating}
                        />
                        {LOADING_LEAN_OPTIONS.map(({ key, label, desc }) => (
                            <Row
                                key={key}
                                label={label}
                                desc={desc}
                                active={loadingLean === key}
                                onClick={() => setLoadingLean(key)}
                                disabled={regenerating}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <p className={SECTION_LABEL}>Movement restrictions</p>
                    <div className="flex flex-col gap-2">
                        {RESTRICTION_OPTIONS.map(({ key, label, desc }) => (
                            <Row
                                key={key}
                                label={label}
                                desc={desc}
                                active={restrictions.includes(key)}
                                onClick={() => toggleRestriction(key)}
                                disabled={regenerating}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button onClick={applyChanges} disabled={!dirty || regenerating} className={BTN_PRIMARY_BLOCK}>
                        {regenerating ? 'Rebuilding your plan…' : 'Apply changes'}
                    </button>
                    <button onClick={onDone} disabled={regenerating} className={BTN_SECONDARY_BLOCK}>
                        Looks good, let&apos;s train
                    </button>
                </div>
            </div>
        </div>
    );
}
