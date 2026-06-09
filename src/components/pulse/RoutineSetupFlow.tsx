'use client';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { DAY_NAMES, SUGGESTED_DAYS, MAX_TRAINING_DAYS } from '@/lib/pulse/constants';
import { STYLES, recommendStyle, resolveStyle, buildRationale } from '@/lib/pulse/generation';
import { PROGRAM_LENGTHS } from '@/lib/pulse/data';
import {
    TRAINING_STYLE_OPTIONS,
    VARIETY_OPTIONS,
    LOADING_LEAN_OPTIONS,
    RESTRICTION_OPTIONS,
} from '@/lib/pulse/generationPreferences';
import { resolveEquipmentPrefill, matchingProfileId } from '@/lib/pulse/utils';
import { BTN_PRIMARY_BLOCK } from './ui';
import type {
    EquipmentKey,
    EquipmentProfile,
    SessionTime,
    Gender,
    TrainingStyle,
    VarietyPreference,
    LoadingPreference,
    RestrictionFlag,
} from '@/lib/pulse/types';
import type { OnboardingAnswers, DaysPerWeek, ExperienceLevel, Goal } from '@/lib/pulse/recommendation';

// Steps: 'gender' (only when collectGender, optional/skippable) · 1 equipment ·
// 2 experience · 3 goal · 4 days/week · 5 which days ·
// 6 program style (only when >1 style exists for the count) · 7 session time ·
// 'train_style' how-to-train (only when collectTrainingStyle) ·
// 'variety' how-varied (only when collectVariety) ·
// 'loading' which modality (only when collectLoadingLean) ·
// 'restrictions' joint areas to avoid (only when collectRestrictions) ·
// 'length' program length · 'start' when-to-start.
// 'length' + 'start' are the two "shape your program" choices (program_weeks +
// program_anchor), applied by the consumer after the routine is created.
//
// mode: 'quick' (fast first-generation) trims this to 6 steps -- equipment ·
// experience · goal · days/week · 7 session time · 'start' (confirm+start) --
// overriding every collect* prop to false. It auto-applies the suggested
// training days (SUGGESTED_DAYS) and the recommended program style
// (recommendStyle) when leaving the days/week step, and leaves program length
// at its 12-week default. The personalization inputs it skips move to the
// post-generation "Tune your plan" panel and the standing Profile editors,
// resolving from the stored profile (param ?? profile ?? default) when absent.
type Step =
    | 'gender'
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 'train_style'
    | 'variety'
    | 'loading'
    | 'restrictions'
    | 'length'
    | 'start';
type StartChoice = 'today' | 'tomorrow' | 'monday' | 'custom';

// Program-length options come from the single source in data.ts (8/10/12/16);
// each is a distinct hand-built periodization block, no custom lengths. 12 is the
// default and the recommendation. A short one-liner per length keeps the choice
// calm without over-claiming science.
const PROGRAM_LENGTH_DESC: Record<number, string> = {
    8: 'Short cycle',
    10: 'Medium cycle',
    12: 'Recommended',
    16: 'Long cycle',
};
const DEFAULT_PROGRAM_WEEKS = 12;

// Local YYYY-MM-DD for a date (the user's calendar day). The anchor is serialized
// at noon UTC (matching the Plan date input) so the program's day-one stays on the
// chosen date across timezones.
function toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Short, locale-aware label for the start-date options, e.g. "Tue, Jun 9".
const START_DATE_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// Resolve a non-custom start choice to its concrete calendar date. "Next Monday"
// is strictly the next one (never today, even when today is Monday) so the date
// shown by the option is unambiguous. Shared by the label and the anchor so they
// can never disagree.
function startDateFor(choice: 'today' | 'tomorrow' | 'monday'): Date {
    const d = new Date();
    if (choice === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (choice === 'monday') d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7 || 7));
    return d;
}

// Full-screen flow shell: fixed top bar + scrollable body + fixed footer, so the
// chrome never shifts between steps (the old centered card resized with content).
const SCREEN = 'fixed inset-0 z-50 flex flex-col bg-pulse-bg';
const Q = 'font-pulse text-lg font-medium text-pulse-text tracking-[-0.01em]';

function ProgressBar({ current, total }: { current: number; total: number }) {
    return (
        <div className="h-1 bg-pulse-border rounded-full overflow-hidden">
            <div
                className="h-full bg-pulse-accent rounded-full transition-all"
                style={{ width: `${Math.round(current * (100 / total))}%` }}
            />
        </div>
    );
}

// Shared full-screen chrome. Fixed top bar (back · progress · step count · close)
// and a fixed footer for the step's actions; the step content scrolls between
// them. Every step renders through this, so the close (✕) is always reachable.
function FlowFrame({
    stepNum,
    total,
    onBack,
    onClose,
    footer,
    children,
}: {
    stepNum: number;
    total: number;
    onBack?: () => void;
    onClose: () => void;
    footer: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={SCREEN} role="dialog" aria-modal="true" aria-label="Routine setup">
            <header className="flex h-14 items-center gap-3 border-b border-pulse-border px-4 shrink-0">
                {onBack ? (
                    <button
                        onClick={onBack}
                        aria-label="Back"
                        className="text-pulse-dim cursor-pointer bg-transparent border-none p-0 font-pulse text-base shrink-0">
                        ←
                    </button>
                ) : (
                    <div className="w-5 shrink-0" />
                )}
                <div className="flex-1">
                    <ProgressBar current={stepNum} total={total} />
                </div>
                <span className="font-pulse text-xs text-pulse-muted shrink-0 tabular-nums">
                    {stepNum}/{total}
                </span>
                <button
                    onClick={onClose}
                    aria-label="Close setup"
                    className="text-pulse-dim cursor-pointer bg-transparent border-none p-0 font-pulse text-base shrink-0">
                    ✕
                </button>
            </header>
            <main className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mx-auto flex w-full max-w-[480px] flex-col gap-5">{children}</div>
            </main>
            <footer className="border-t border-pulse-border px-4 py-3 shrink-0">
                <div className="mx-auto w-full max-w-[480px]">{footer}</div>
            </footer>
        </div>
    );
}

function OptionRow({
    label,
    desc,
    sub,
    active,
    onClick,
}: {
    label: string;
    desc?: string;
    /** Right-aligned secondary text, e.g. the resolved date on the start step. */
    sub?: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-left flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors w-full ${
                active
                    ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                    : 'bg-pulse-surface-2 ring-0 hover:bg-pulse-surface-2/70'
            }`}>
            <span className="font-pulse text-sm font-medium text-pulse-text flex-1">{label}</span>
            {sub && <span className="font-pulse text-xs text-pulse-dim tabular-nums">{sub}</span>}
            {desc && <span className="font-pulse text-xs text-pulse-dim">{desc}</span>}
        </button>
    );
}

const EQUIPMENT_OPTIONS: { key: EquipmentKey; label: string }[] = [
    { key: 'dumbbells', label: 'Dumbbells' },
    { key: 'barbell', label: 'Barbell & plates' },
    { key: 'bench', label: 'Weight bench' },
    { key: 'cables', label: 'Cable machine' },
    { key: 'machines', label: 'Gym machines (leg press, lat pulldown, etc.)' },
    { key: 'pull_up_bar', label: 'Pull-up bar' },
];

export interface RoutineSetupResult {
    answers: OnboardingAnswers;
    trainingDays: number[];
    sessionTime: SessionTime;
    /** Chosen program-style key. Set by the style-picker step (Part C4);
     *  undefined falls back to the recommended style for the session count. */
    styleKey?: string;
    /** Selected gender, or null if skipped / not collected. */
    gender: Gender | null;
    /** ISO timestamp for program_anchor (the program's day one). Always set by the
     *  start-date step (defaults to today); the consumer applies it after create. */
    startAnchor?: string;
    /** Chosen program length in weeks (one of PROGRAM_LENGTHS). Always set by the
     *  length step (defaults to 12); the consumer applies it after create when it
     *  differs from the DB default. */
    programWeeks: number;
    /** Chosen training style; always set (defaults to 'balanced'). Generate
     *  consumers pass it to generateRoutine; the template consumer ignores it. */
    trainingStyle: TrainingStyle;
    /** Chosen variety preference; always set (defaults to 'varied'). Generate
     *  consumers pass it to generateRoutine; the template consumer ignores it. */
    varietyPreference: VarietyPreference;
    /** Chosen loading preference; null when the step is skipped or not collected.
     *  Generate consumers pass it to generateRoutine; template consumer ignores it. */
    loadingLean: LoadingPreference | null;
    /** Joint areas to avoid in generation; [] when none chosen / step skipped. */
    movementRestrictions: RestrictionFlag[];
}

interface Props {
    initial?: Partial<{
        equipment: EquipmentKey[];
        experience: ExperienceLevel;
        goal: Goal;
        days: DaysPerWeek;
        trainingDays: number[];
        sessionTime: SessionTime;
    }>;
    onComplete: (result: RoutineSetupResult) => Promise<void>;
    onClose: () => void;
    completeLabel?: string;
    /** When true, show an optional/skippable "Gender" step before equipment.
     *  Used by first-run onboarding so the style pick can be lightly biased. */
    collectGender?: boolean;
    /** Optional one-line positioning lead shown above the very first step. Set
     *  only by first-run onboarding; later routine-creation surfaces omit it. */
    intro?: string;
    /** Show the "How do you want to train?" step. Default true; template cloning
     *  sets this false because a fixed template can't be re-biased by style. */
    collectTrainingStyle?: boolean;
    /** Show the "How varied?" step. Default true; template cloning sets this
     *  false because a fixed template can't be re-varied. */
    collectVariety?: boolean;
    /** Show the "Which loading do you prefer?" step. Default true; template
     *  cloning sets this false because a template has fixed exercise selections. */
    collectLoadingLean?: boolean;
    /** Show the "Anything we should work around?" step. Default true; template
     *  cloning sets this false because a fixed template isn't pool-filtered. */
    collectRestrictions?: boolean;
    /** 'quick' trims the flow to 6 steps for fast first-generation (equipment,
     *  experience, goal, days/week, session length, confirm+start), forcing every
     *  collect* prop off and auto-applying suggested days + recommended style.
     *  See the Steps comment above for the full rundown. Default 'full'. */
    mode?: 'quick' | 'full';
    /** Saved equipment profiles (Branch B). When non-empty, the equipment step
     *  shows a quick-pick chip row, pre-fills from the resolution rule, and (with
     *  onCreateEquipmentProfile) offers "Save as profile". Empty (default) = today's
     *  behavior, just the checkboxes; template cloning omits it so it stays unchanged. */
    equipmentProfiles?: EquipmentProfile[];
    /** Active equipment-profile id; drives the pre-fill resolution and the
     *  "active" chip marker. */
    activeEquipmentProfileId?: string | null;
    /** Create a new equipment profile from the current selection. When provided
     *  (and profiles exist), the step shows the "Save as profile" create path. It
     *  only ever creates; overwriting is a Profile-manager action. */
    onCreateEquipmentProfile?: (name: string, equipment: EquipmentKey[]) => Promise<EquipmentProfile>;
    /** User IANA timezone. When provided, the equipment pre-fill becomes travel-aware
     *  (#322): an active travel overlay seeds the step. Omitted (default) skips overlay
     *  resolution, so template cloning and existing tests stay byte-identical. */
    timezone?: string;
}

export default function RoutineSetupFlow({
    initial,
    onComplete,
    onClose,
    completeLabel = 'Create routine',
    collectGender = false,
    intro,
    collectTrainingStyle = true,
    collectVariety = true,
    collectLoadingLean = true,
    collectRestrictions = true,
    mode = 'full',
    equipmentProfiles = [],
    activeEquipmentProfileId = null,
    onCreateEquipmentProfile,
    timezone,
}: Props) {
    const quick = mode === 'quick';
    // Quick mode owns the trim outright, regardless of what the consumer passes:
    // gender and the four personalization steps never render, their inputs live
    // in the post-generation Tune panel / standing Profile editors instead.
    if (quick) {
        collectGender = false;
        collectTrainingStyle = false;
        collectVariety = false;
        collectLoadingLean = false;
        collectRestrictions = false;
    }
    const [step, setStep] = useState<Step>(collectGender ? 'gender' : 1);
    const [gender, setGender] = useState<Gender | null>(null);
    // Tracks an explicit "Prefer not to say" pick so it can highlight like the
    // other options. gender stays null in that case (and when untouched), which
    // is what the consumer treats as "no gender" (neutral strength standard).
    const [genderDeclined, setGenderDeclined] = useState(false);
    // Pre-fill the equipment step from the resolution rule (active -> most-recent
    // -> empty), snapshotted on open so deleting the active profile mid-flow can't
    // change an in-progress selection. v1 keeps the step visible but pre-filled;
    // disappearing the step entirely for returning users is the v2 upgrade.
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(
        () =>
            new Set(
                initial?.equipment ??
                    resolveEquipmentPrefill(
                        equipmentProfiles,
                        activeEquipmentProfileId,
                        timezone ? new Date().toISOString() : undefined,
                        timezone,
                    ),
            ),
    );
    // Save-as-profile inline form (Branch B). null name + closed by default.
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [savingBusy, setSavingBusy] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [experience, setExperience] = useState<ExperienceLevel | null>(initial?.experience ?? null);
    const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
    const [days, setDays] = useState<DaysPerWeek | null>(initial?.days ?? null);
    const [sessionTime, setSessionTime] = useState<SessionTime | null>(initial?.sessionTime ?? null);
    const [trainingDays, setTrainingDays] = useState<number[]>(initial?.trainingDays ?? []);
    const [styleKey, setStyleKey] = useState<string | null>(null);
    const [startChoice, setStartChoice] = useState<StartChoice>('today');
    const [customDate, setCustomDate] = useState('');
    // The date input is always mounted (visually hidden until "Pick a date") so
    // selecting that option can open the native picker immediately via showPicker().
    const dateRef = useRef<HTMLInputElement>(null);
    const [programWeeks, setProgramWeeks] = useState<number>(DEFAULT_PROGRAM_WEEKS);
    const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>('balanced');
    const [varietyPreference, setVarietyPreference] = useState<VarietyPreference>('varied');
    const [loadingLean, setLoadingLean] = useState<LoadingPreference | null>(null);
    const [restrictions, setRestrictions] = useState<Set<RestrictionFlag>>(new Set());
    const [loading, setLoading] = useState(false);

    // Closing mid-flow discards the in-progress answers, so confirm once the user
    // has moved past the first step. On the first step there is nothing to lose,
    // so the ✕ closes straight away. Escape mirrors the ✕.
    const entryStep: Step = collectGender ? 'gender' : 1;
    const dirty = step !== entryStep;
    const requestClose = () => {
        if (dirty && !window.confirm('Discard setup? Your selections will be lost.')) return;
        onClose();
    };
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (dirty && !window.confirm('Discard setup? Your selections will be lost.')) return;
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dirty, onClose]);

    // The days-per-week answer caps how many days can be picked, so the chosen
    // frequency (not the raw day selection) drives the routine's session count.
    const maxDays = days ? MAX_TRAINING_DAYS[days] : 7;
    const chooseDays = (d: DaysPerWeek) => {
        setDays(d);
        // Trim any prior over-selection to the new cap (e.g. when stepping back
        // from "5–6 days" to "4 days").
        setTrainingDays((prev) => prev.slice(0, MAX_TRAINING_DAYS[d]));
    };

    // Program styles for the chosen number of training days. The style step is
    // only shown when there is more than one to pick from.
    const styleOptions = STYLES[trainingDays.length] ?? [];
    const showStyleStep = styleOptions.length > 1;
    // The optional gender step adds one to the count and shifts the numbered steps
    // one position later in the progress display.
    const genderOffset = collectGender ? 1 : 0;
    // 8 always-on steps (equipment · experience · goal · days/week · which days ·
    // session time · length · start), plus the optional gender, program-style,
    // training-style, variety, loading, and restrictions steps when each is shown.
    // Quick mode is a fixed 6: equipment · experience · goal · days/week ·
    // session time · start (which days, style, length, and every personalization
    // step are auto-applied or defaulted, never counted).
    const total = quick
        ? 6
        : 8 +
          genderOffset +
          (showStyleStep ? 1 : 0) +
          (collectTrainingStyle ? 1 : 0) +
          (collectVariety ? 1 : 0) +
          (collectLoadingLean ? 1 : 0) +
          (collectRestrictions ? 1 : 0);
    // Tail-step display numbers: start = total, length = total - 1,
    // restrictions = total - 2, loading = total - 2 - (collectRestrictions ? 1 : 0),
    // variety = total - 2 - (collectRestrictions ? 1 : 0) - (collectLoadingLean ? 1 : 0),
    // train_style = total - 2 - (collectRestrictions ? 1 : 0) - (collectLoadingLean ? 1 : 0) - (collectVariety ? 1 : 0).

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // Equipment-profile derived state + handlers (Branch B). Re-derived each render
    // against the live profiles prop and the local equipment snapshot.
    const showProfiles = equipmentProfiles.length > 0;
    const matchedProfileId = matchingProfileId(equipmentProfiles, equipment);
    const matchedProfile = equipmentProfiles.find((p) => p.id === matchedProfileId) ?? null;
    const canSaveProfile = profileName.trim().length > 0 && equipment.size > 0 && !savingBusy;

    function pickProfile(p: EquipmentProfile) {
        setEquipment(new Set(p.equipment));
        // The selection now matches a saved set, so any open save-as form is moot.
        setSavingProfile(false);
        setSaveError(null);
    }

    async function saveProfile() {
        if (!canSaveProfile || !onCreateEquipmentProfile) return;
        setSavingBusy(true);
        setSaveError(null);
        try {
            await onCreateEquipmentProfile(profileName.trim(), [...equipment]);
            // On success the new profile arrives via props; the selection now matches
            // it, so the hint replaces the form. Collapse + reset.
            setSavingProfile(false);
            setProfileName('');
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Could not save profile');
        } finally {
            setSavingBusy(false);
        }
    }

    const toggleRestriction = (key: RestrictionFlag) =>
        setRestrictions((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    // Resolve the chosen start to an ISO anchor at noon UTC (program day one),
    // reusing startDateFor so the anchor matches the date shown on the option.
    function startAnchorISO(): string {
        if (startChoice === 'custom') return `${customDate}T12:00:00.000Z`;
        return `${toYmd(startDateFor(startChoice))}T12:00:00.000Z`;
    }

    function handleComplete() {
        if (!experience || !goal || !days || !sessionTime || trainingDays.length === 0) return;
        setLoading(true);
        void (async () => {
            try {
                await onComplete({
                    answers: { equipment, experience, goal, days, gender },
                    trainingDays,
                    sessionTime,
                    styleKey: styleKey ?? recommendStyle(trainingDays.length),
                    gender,
                    startAnchor: startAnchorISO(),
                    programWeeks,
                    trainingStyle,
                    varietyPreference,
                    loadingLean,
                    movementRestrictions: [...restrictions],
                });
            } finally {
                setLoading(false);
                onClose();
            }
        })();
    }

    // One-time positioning lead, shown above the first step only (onboarding).
    const introBlock = intro ? (
        <p className="mb-1 font-pulse-body text-[0.8125rem] leading-relaxed text-pulse-dim">{intro}</p>
    ) : null;

    if (step === 'gender')
        return (
            <FlowFrame
                stepNum={1}
                total={total}
                onClose={requestClose}
                footer={
                    // Next is always enabled: no gender is a valid choice, so the
                    // score and program fall back to their neutral defaults.
                    <button onClick={() => setStep(1)} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                {introBlock}
                <p className={Q}>What&apos;s your gender?</p>
                <p className="font-pulse text-xs text-pulse-dim -mt-3">
                    Used for strength standards and a light program nudge. Optional, you can skip it.
                </p>
                <div className="flex flex-col gap-2">
                    <OptionRow
                        label="Male"
                        active={gender === 'male'}
                        onClick={() => {
                            setGender('male');
                            setGenderDeclined(false);
                        }}
                    />
                    <OptionRow
                        label="Female"
                        active={gender === 'female'}
                        onClick={() => {
                            setGender('female');
                            setGenderDeclined(false);
                        }}
                    />
                    <OptionRow
                        label="Prefer not to say"
                        active={genderDeclined}
                        onClick={() => {
                            setGender(null);
                            setGenderDeclined(true);
                        }}
                    />
                </div>
            </FlowFrame>
        );

    if (step === 1)
        return (
            <FlowFrame
                stepNum={1 + genderOffset}
                total={total}
                onBack={collectGender ? () => setStep('gender') : undefined}
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep(2)} disabled={equipment.size === 0} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                {!collectGender && introBlock}
                <p className={Q}>What equipment do you have access to?</p>
                {showProfiles && (
                    <div className="-mt-1 flex flex-col gap-2">
                        <p className="font-pulse text-[0.6875rem] uppercase tracking-[0.12em] text-pulse-muted">
                            Your equipment profiles
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {equipmentProfiles.map((p) => {
                                const active = p.id === matchedProfileId;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => pickProfile(p)}
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-pulse text-xs font-medium transition-colors ${
                                            active
                                                ? 'border-pulse-accent bg-pulse-accent/10 text-pulse-accent'
                                                : 'border-pulse-border bg-pulse-surface-2 text-pulse-dim'
                                        }`}>
                                        {p.name}
                                        {p.id === activeEquipmentProfileId && (
                                            <span className="text-[0.5625rem] uppercase tracking-wide opacity-80">
                                                active
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {matchedProfile && (
                            <p className="font-pulse text-xs text-pulse-dim">
                                Filled from your {matchedProfile.name} profile
                            </p>
                        )}
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    {EQUIPMENT_OPTIONS.map(({ key, label }) => (
                        <label
                            key={key}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                equipment.has(key)
                                    ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                    : 'bg-pulse-surface-2 ring-0'
                            }`}>
                            <input
                                type="checkbox"
                                checked={equipment.has(key)}
                                onChange={() => toggleEquipment(key)}
                                className="sr-only"
                            />
                            <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${equipment.has(key) ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                                {equipment.has(key) && (
                                    <span className="text-pulse-bg text-[10px] font-bold leading-none">✓</span>
                                )}
                            </div>
                            <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                        </label>
                    ))}
                </div>
                {showProfiles &&
                    onCreateEquipmentProfile &&
                    equipment.size > 0 &&
                    !matchedProfileId &&
                    (savingProfile ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-pulse-border p-3.5">
                            <p className="font-pulse text-[0.8125rem] font-medium text-pulse-text">Save as a profile</p>
                            <input
                                type="text"
                                value={profileName}
                                maxLength={40}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder="Profile name"
                                className="rounded-lg bg-pulse-bg px-3 py-2 font-pulse-body text-sm text-pulse-text outline-none ring-1 ring-pulse-border focus:ring-pulse-accent"
                            />
                            <div className="flex flex-wrap gap-2">
                                {['Home', 'Gym', 'Travel'].map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setProfileName(s)}
                                        className="rounded-full bg-pulse-bg px-3 py-1 font-pulse text-xs text-pulse-dim ring-1 ring-pulse-border">
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {saveError && <p className="font-pulse text-xs text-pulse-accent">{saveError}</p>}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={!canSaveProfile}
                                    onClick={saveProfile}
                                    className={`rounded-lg px-4 py-2 font-pulse-body text-sm ${canSaveProfile ? 'bg-pulse-accent text-pulse-bg' : 'cursor-not-allowed bg-pulse-surface-2 text-pulse-muted'}`}>
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSavingProfile(false);
                                        setSaveError(null);
                                    }}
                                    className="rounded-lg px-4 py-2 font-pulse-body text-sm text-pulse-dim">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setSavingProfile(true)}
                            className="self-start font-pulse text-[0.8125rem] text-pulse-accent">
                            + Save these as a profile
                        </button>
                    ))}
            </FlowFrame>
        );

    if (step === 2)
        return (
            <FlowFrame
                stepNum={2 + genderOffset}
                total={total}
                onBack={() => setStep(1)}
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep(3)} disabled={!experience} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>What&apos;s your training experience?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow
                        label="Beginner"
                        desc="< 1 year lifting"
                        active={experience === 'beginner'}
                        onClick={() => setExperience('beginner')}
                    />
                    <OptionRow
                        label="Intermediate"
                        desc="1–3 years"
                        active={experience === 'intermediate'}
                        onClick={() => setExperience('intermediate')}
                    />
                    <OptionRow
                        label="Advanced"
                        desc="3+ years"
                        active={experience === 'advanced'}
                        onClick={() => setExperience('advanced')}
                    />
                </div>
            </FlowFrame>
        );

    if (step === 3)
        return (
            <FlowFrame
                stepNum={3 + genderOffset}
                total={total}
                onBack={() => setStep(2)}
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep(4)} disabled={!goal} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>What&apos;s your primary goal?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow
                        label="Build muscle"
                        desc="Maximise size and strength"
                        active={goal === 'build_muscle'}
                        onClick={() => setGoal('build_muscle')}
                    />
                    <OptionRow
                        label="Lose fat"
                        desc="Preserve muscle while cutting"
                        active={goal === 'lose_fat'}
                        onClick={() => setGoal('lose_fat')}
                    />
                    <OptionRow
                        label="General fitness"
                        desc="Move well and feel good"
                        active={goal === 'general_fitness'}
                        onClick={() => setGoal('general_fitness')}
                    />
                </div>
            </FlowFrame>
        );

    if (step === 4)
        return (
            <FlowFrame
                stepNum={4 + genderOffset}
                total={total}
                onBack={() => setStep(3)}
                onClose={requestClose}
                footer={
                    <button
                        onClick={() => {
                            if (quick) {
                                // Skip "which days" and "program style" outright: seed the
                                // suggested days for this frequency and auto-pick the
                                // recommended split for that count ("Change split" lives
                                // in the post-generation Tune panel).
                                const suggested = days ? (SUGGESTED_DAYS[days] ?? []) : [];
                                setTrainingDays(suggested);
                                setStyleKey(recommendStyle(suggested.length));
                                setStep(7);
                                return;
                            }
                            if (trainingDays.length === 0) setTrainingDays(days ? (SUGGESTED_DAYS[days] ?? []) : []);
                            setStep(5);
                        }}
                        disabled={!days}
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>How many days per week can you train?</p>
                <div className="flex flex-col gap-2">
                    <OptionRow label="2–3 days" active={days === '2-3'} onClick={() => chooseDays('2-3')} />
                    <OptionRow label="4 days" active={days === '4'} onClick={() => chooseDays('4')} />
                    <OptionRow label="5–6 days" active={days === '5-6'} onClick={() => chooseDays('5-6')} />
                </div>
            </FlowFrame>
        );

    if (step === 5)
        return (
            <FlowFrame
                stepNum={5 + genderOffset}
                total={total}
                onBack={() => setStep(4)}
                onClose={requestClose}
                footer={
                    <button
                        onClick={() => {
                            // Pre-select the recommended style for this count so the
                            // style step opens with a sensible default already chosen.
                            if (showStyleStep && !styleKey) setStyleKey(recommendStyle(trainingDays.length));
                            setStep(showStyleStep ? 6 : 7);
                        }}
                        disabled={trainingDays.length === 0}
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>Which days will you train?</p>
                <p className="font-pulse text-[0.8125rem] text-pulse-dim -mt-3">
                    Pick up to {maxDays} day{maxDays === 1 ? '' : 's'}.
                </p>
                <div className="flex gap-2 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                        const selected = trainingDays.includes(d);
                        const atCap = !selected && trainingDays.length >= maxDays;
                        return (
                            <button
                                key={d}
                                disabled={atCap}
                                onClick={() =>
                                    setTrainingDays((prev) =>
                                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                                    )
                                }
                                className={`font-pulse text-xs font-semibold rounded-full w-12 h-12 border-none transition-colors ${
                                    selected
                                        ? 'bg-pulse-accent text-pulse-bg cursor-pointer'
                                        : atCap
                                          ? 'bg-pulse-surface-2 text-pulse-muted opacity-40 cursor-not-allowed'
                                          : 'bg-pulse-surface-2 text-pulse-dim cursor-pointer'
                                }`}>
                                {DAY_NAMES[d]}
                            </button>
                        );
                    })}
                </div>
            </FlowFrame>
        );

    if (step === 6 && showStyleStep)
        return (
            <FlowFrame
                stepNum={6 + genderOffset}
                total={total}
                onBack={() => setStep(5)}
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep(7)} disabled={!styleKey} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>Which program style?</p>
                <div className="flex flex-col gap-2">
                    {styleOptions.map((s) => (
                        <button
                            key={s.key}
                            onClick={() => setStyleKey(s.key)}
                            className={`flex flex-col gap-1 p-3 text-left rounded-xl cursor-pointer transition-colors w-full ${
                                styleKey === s.key
                                    ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                    : 'bg-pulse-surface-2 ring-0 hover:bg-pulse-surface-2/70'
                            }`}>
                            <span className="font-pulse text-sm font-medium text-pulse-text">{s.name}</span>
                            <span className="font-pulse text-xs text-pulse-dim">{s.bestFor}</span>
                        </button>
                    ))}
                </div>
            </FlowFrame>
        );

    if (step === 'train_style')
        return (
            <FlowFrame
                stepNum={
                    total - 2 - (collectRestrictions ? 1 : 0) - (collectVariety ? 1 : 0) - (collectLoadingLean ? 1 : 0)
                }
                total={total}
                onBack={() => setStep(7)}
                onClose={requestClose}
                footer={
                    <button
                        onClick={() =>
                            setStep(
                                collectVariety
                                    ? 'variety'
                                    : collectLoadingLean
                                      ? 'loading'
                                      : collectRestrictions
                                        ? 'restrictions'
                                        : 'length',
                            )
                        }
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>How do you want to train?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    Same plan, tuned to your style. You can change this anytime you regenerate.
                </p>
                <div className="flex flex-col gap-2">
                    {TRAINING_STYLE_OPTIONS.map((o) => (
                        <OptionRow
                            key={o.key}
                            label={o.label}
                            desc={o.desc}
                            active={trainingStyle === o.key}
                            onClick={() => setTrainingStyle(o.key)}
                        />
                    ))}
                </div>
            </FlowFrame>
        );

    if (step === 'variety')
        return (
            <FlowFrame
                stepNum={total - 2 - (collectRestrictions ? 1 : 0) - (collectLoadingLean ? 1 : 0)}
                total={total}
                onBack={() => setStep(collectTrainingStyle ? 'train_style' : 7)}
                onClose={requestClose}
                footer={
                    <button
                        onClick={() =>
                            setStep(collectLoadingLean ? 'loading' : collectRestrictions ? 'restrictions' : 'length')
                        }
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>How varied should it be?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    Consistency builds your main lifts; variety keeps training fresh. You can change this anytime you
                    regenerate.
                </p>
                <div className="flex flex-col gap-2">
                    {VARIETY_OPTIONS.map((o) => (
                        <OptionRow
                            key={o.key}
                            label={o.label}
                            desc={o.desc}
                            active={varietyPreference === o.key}
                            onClick={() => setVarietyPreference(o.key)}
                        />
                    ))}
                </div>
            </FlowFrame>
        );

    if (step === 'loading')
        return (
            <FlowFrame
                stepNum={total - 2 - (collectRestrictions ? 1 : 0)}
                total={total}
                onBack={() => setStep(collectVariety ? 'variety' : collectTrainingStyle ? 'train_style' : 7)}
                onClose={requestClose}
                footer={
                    <button
                        onClick={() => setStep(collectRestrictions ? 'restrictions' : 'length')}
                        className={BTN_PRIMARY_BLOCK}>
                        {loadingLean ? 'Next' : 'Skip'}
                    </button>
                }>
                <p className={Q}>Which equipment do you prefer to use?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    Pulse will lean toward that type when filling each slot. Only applies to what you actually own. Skip
                    to let it choose freely.
                </p>
                <div className="flex flex-col gap-2">
                    {LOADING_LEAN_OPTIONS.map((o) => (
                        <OptionRow
                            key={o.key}
                            label={o.label}
                            desc={o.desc}
                            active={loadingLean === o.key}
                            onClick={() => setLoadingLean((prev) => (prev === o.key ? null : o.key))}
                        />
                    ))}
                </div>
            </FlowFrame>
        );

    if (step === 'restrictions')
        return (
            <FlowFrame
                stepNum={total - 2}
                total={total}
                onBack={() =>
                    setStep(
                        collectLoadingLean
                            ? 'loading'
                            : collectVariety
                              ? 'variety'
                              : collectTrainingStyle
                                ? 'train_style'
                                : 7,
                    )
                }
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep('length')} className={BTN_PRIMARY_BLOCK}>
                        {restrictions.size > 0 ? 'Next' : 'Skip'}
                    </button>
                }>
                <p className={Q}>Anything we should work around?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    Pick any joints that bother you and Pulse will avoid the movements that commonly stress them,
                    choosing safer alternatives. This is not medical advice. Skip if none apply.
                </p>
                <div className="flex flex-col gap-2">
                    {RESTRICTION_OPTIONS.map(({ key, label, desc }) => (
                        <label
                            key={key}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                                restrictions.has(key)
                                    ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                    : 'bg-pulse-surface-2 ring-0'
                            }`}>
                            <input
                                type="checkbox"
                                checked={restrictions.has(key)}
                                onChange={() => toggleRestriction(key)}
                                className="sr-only"
                            />
                            <div
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${restrictions.has(key) ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                                {restrictions.has(key) && (
                                    <span className="text-pulse-bg text-[10px] font-bold leading-none">✓</span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                <span className="font-pulse text-[0.75rem] text-pulse-dim">{desc}</span>
                            </div>
                        </label>
                    ))}
                </div>
                <p className="font-pulse text-[0.75rem] text-pulse-dim">
                    Takes effect the next time you generate a plan. To swap exercises in your current routine, use the
                    Swap option on any exercise.
                </p>
            </FlowFrame>
        );

    if (step === 'length')
        return (
            <FlowFrame
                stepNum={total - 1}
                total={total}
                onBack={() =>
                    setStep(
                        collectRestrictions
                            ? 'restrictions'
                            : collectLoadingLean
                              ? 'loading'
                              : collectVariety
                                ? 'variety'
                                : collectTrainingStyle
                                  ? 'train_style'
                                  : 7,
                    )
                }
                onClose={requestClose}
                footer={
                    <button onClick={() => setStep('start')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                }>
                <p className={Q}>How long should your program be?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    How long a training block runs before it repeats with a deload. You can change it later in Plan.
                </p>
                <div className="flex flex-col gap-2">
                    {PROGRAM_LENGTHS.map((n) => (
                        <OptionRow
                            key={n}
                            label={`${n} weeks`}
                            desc={PROGRAM_LENGTH_DESC[n]}
                            active={programWeeks === n}
                            onClick={() => setProgramWeeks(n)}
                        />
                    ))}
                </div>
            </FlowFrame>
        );

    if (step === 'start')
        return (
            <FlowFrame
                stepNum={total}
                total={total}
                onBack={() => setStep(quick ? 7 : 'length')}
                onClose={requestClose}
                footer={
                    <button
                        onClick={handleComplete}
                        disabled={loading || (startChoice === 'custom' && !customDate)}
                        className={BTN_PRIMARY_BLOCK}>
                        {loading ? 'Building your routine…' : completeLabel}
                    </button>
                }>
                <p className={Q}>When do you want to start?</p>
                <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                    Sets your program&apos;s first day. You can change it later in Plan.
                </p>
                <div className="flex flex-col gap-2">
                    <OptionRow
                        label="Today"
                        sub={START_DATE_FMT.format(startDateFor('today'))}
                        active={startChoice === 'today'}
                        onClick={() => setStartChoice('today')}
                    />
                    <OptionRow
                        label="Tomorrow"
                        sub={START_DATE_FMT.format(startDateFor('tomorrow'))}
                        active={startChoice === 'tomorrow'}
                        onClick={() => setStartChoice('tomorrow')}
                    />
                    <OptionRow
                        label="Next Monday"
                        sub={START_DATE_FMT.format(startDateFor('monday'))}
                        active={startChoice === 'monday'}
                        onClick={() => setStartChoice('monday')}
                    />
                    <OptionRow
                        label="Pick a date"
                        sub={customDate ? START_DATE_FMT.format(new Date(`${customDate}T12:00:00`)) : 'Choose…'}
                        active={startChoice === 'custom'}
                        onClick={() => {
                            setStartChoice('custom');
                            // Open the native calendar straight away (kept in the same
                            // user gesture so showPicker keeps its activation). The
                            // input is already mounted (sr-only), so the ref is ready.
                            dateRef.current?.showPicker?.();
                        }}
                    />
                </div>
                <input
                    ref={dateRef}
                    type="date"
                    aria-label="Start date"
                    value={customDate}
                    min={toYmd(new Date())}
                    onChange={(e) => {
                        setStartChoice('custom');
                        setCustomDate(e.target.value);
                    }}
                    className={
                        startChoice === 'custom'
                            ? 'w-full rounded-xl border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-sm text-pulse-text outline-none [color-scheme:dark] focus:border-pulse-accent/50'
                            : 'sr-only'
                    }
                />
            </FlowFrame>
        );

    // Session-time step + a live rationale preview built from the chosen inputs,
    // mirroring what buildRationale persists. Followed by the two "shape your
    // program" steps (length, then start date).
    const previewStyle = resolveStyle(styleKey ?? recommendStyle(trainingDays.length), trainingDays.length);
    const rationalePreview =
        experience && goal && days && sessionTime && trainingDays.length > 0
            ? buildRationale({ equipment, experience, goal, days }, sessionTime, previewStyle, null, trainingStyle)
            : null;

    return (
        <FlowFrame
            stepNum={
                quick
                    ? 5
                    : total -
                      2 -
                      (collectRestrictions ? 1 : 0) -
                      (collectTrainingStyle ? 1 : 0) -
                      (collectVariety ? 1 : 0) -
                      (collectLoadingLean ? 1 : 0)
            }
            total={total}
            onBack={() => setStep(quick ? 4 : showStyleStep ? 6 : 5)}
            onClose={requestClose}
            footer={
                <button
                    onClick={() =>
                        setStep(
                            quick
                                ? 'start'
                                : collectTrainingStyle
                                  ? 'train_style'
                                  : collectVariety
                                    ? 'variety'
                                    : collectLoadingLean
                                      ? 'loading'
                                      : collectRestrictions
                                        ? 'restrictions'
                                        : 'length',
                        )
                    }
                    disabled={!sessionTime}
                    className={BTN_PRIMARY_BLOCK}>
                    Next
                </button>
            }>
            <p className={Q}>How long are your sessions?</p>
            <div className="flex flex-col gap-2">
                <OptionRow
                    label="~30 min"
                    desc="Short and focused"
                    active={sessionTime === '~30 min'}
                    onClick={() => setSessionTime('~30 min')}
                />
                <OptionRow
                    label="45–60 min"
                    desc="A solid training session"
                    active={sessionTime === '45–60 min'}
                    onClick={() => setSessionTime('45–60 min')}
                />
                <OptionRow
                    label="90+ min"
                    desc="Full volume, no rush"
                    active={sessionTime === '90+ min'}
                    onClick={() => setSessionTime('90+ min')}
                />
            </div>
            {rationalePreview && (
                <div className="rounded-xl bg-pulse-surface px-4 py-3">
                    <div className="font-pulse text-[0.6875rem] tracking-[0.12em] uppercase text-pulse-muted mb-1">
                        Why this plan
                    </div>
                    <p className="font-pulse text-sm text-pulse-dim leading-[1.55]">{rationalePreview}</p>
                </div>
            )}
        </FlowFrame>
    );
}
