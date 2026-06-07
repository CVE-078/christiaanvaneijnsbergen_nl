'use client';
import { useState } from 'react';
import { DAY_NAMES, SUGGESTED_DAYS, MAX_TRAINING_DAYS } from '@/lib/pulse/constants';
import { STYLES, recommendStyle, resolveStyle, buildRationale } from '@/lib/pulse/generation';
import { PROGRAM_LENGTHS } from '@/lib/pulse/data';
import { BTN_PRIMARY_BLOCK } from './ui';
import type { EquipmentKey, SessionTime, Gender, TrainingStyle, VarietyPreference, LoadingPreference } from '@/lib/pulse/types';
import type { OnboardingAnswers, DaysPerWeek, ExperienceLevel, Goal } from '@/lib/pulse/recommendation';

// Steps: 'gender' (only when collectGender, optional/skippable) · 1 equipment ·
// 2 experience · 3 goal · 4 days/week · 5 which days ·
// 6 program style (only when >1 style exists for the count) · 7 session time ·
// 'train_style' how-to-train (only when collectTrainingStyle) ·
// 'variety' how-varied (only when collectVariety) ·
// 'loading' which modality (only when collectLoadingLean) ·
// 'length' program length · 'start' when-to-start.
// 'length' + 'start' are the two "shape your program" choices (program_weeks +
// program_anchor), applied by the consumer after the routine is created.
type Step = 'gender' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'train_style' | 'variety' | 'loading' | 'length' | 'start';
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

const WRAP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
const CARD = 'bg-pulse-surface rounded-2xl w-full max-w-[420px] flex flex-col gap-5 p-6';
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

function Header({ stepNum, total, onBack }: { stepNum: number; total: number; onBack?: () => void }) {
    return (
        <div className="flex items-center gap-3">
            {onBack ? (
                <button
                    onClick={onBack}
                    className="text-pulse-dim cursor-pointer bg-transparent border-none p-0 font-pulse text-sm">
                    ←
                </button>
            ) : (
                <div className="w-5" />
            )}
            <div className="flex-1">
                <ProgressBar current={stepNum} total={total} />
            </div>
            <span className="font-pulse text-xs text-pulse-muted shrink-0">
                {stepNum}/{total}
            </span>
        </div>
    );
}

function OptionRow({
    label,
    desc,
    active,
    onClick,
}: {
    label: string;
    desc?: string;
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
            {desc && <span className="font-pulse text-xs text-pulse-dim">{desc}</span>}
        </button>
    );
}

const TRAINING_STYLE_OPTIONS: { key: TrainingStyle; label: string; desc: string }[] = [
    { key: 'balanced', label: 'Balanced', desc: 'A bit of everything. Heavy days, hypertrophy days, and a pump day.' },
    { key: 'strength', label: 'Strength', desc: 'Lower reps and heavier loads on the big lifts. Still keeps one lighter day each week.' },
    { key: 'bodybuilding', label: 'Bodybuilding', desc: 'Moderate-to-high reps for size, across every session.' },
    { key: 'powerbuilding', label: 'Powerbuilding', desc: 'A blend: heavy, low-rep work on the main lifts, higher-rep work on the accessories.' },
];

const VARIETY_OPTIONS: { key: VarietyPreference; label: string; desc: string }[] = [
    { key: 'varied', label: 'Varied', desc: 'Rotate exercises across sessions for fresh stimulus.' },
    { key: 'consistent', label: 'Consistent', desc: 'Keep your main lifts the same each week, rotate the accessories.' },
];

const LOADING_LEAN_OPTIONS: { key: LoadingPreference; label: string; desc: string }[] = [
    { key: 'barbell', label: 'Barbell', desc: 'Prioritise barbell work: squats, bench, rows, deadlifts.' },
    { key: 'dumbbell', label: 'Dumbbells', desc: 'Prioritise dumbbell exercises across all movement patterns.' },
    { key: 'machine', label: 'Machines', desc: 'Prioritise machine exercises for each slot.' },
    { key: 'cable', label: 'Cables', desc: 'Prioritise cable exercises where available.' },
];

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
}: Props) {
    const [step, setStep] = useState<Step>(collectGender ? 'gender' : 1);
    const [gender, setGender] = useState<Gender | null>(null);
    // Tracks an explicit "Prefer not to say" pick so it can highlight like the
    // other options. gender stays null in that case (and when untouched), which
    // is what the consumer treats as "no gender" (neutral strength standard).
    const [genderDeclined, setGenderDeclined] = useState(false);
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set(initial?.equipment ?? []));
    const [experience, setExperience] = useState<ExperienceLevel | null>(initial?.experience ?? null);
    const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
    const [days, setDays] = useState<DaysPerWeek | null>(initial?.days ?? null);
    const [sessionTime, setSessionTime] = useState<SessionTime | null>(initial?.sessionTime ?? null);
    const [trainingDays, setTrainingDays] = useState<number[]>(initial?.trainingDays ?? []);
    const [styleKey, setStyleKey] = useState<string | null>(null);
    const [startChoice, setStartChoice] = useState<StartChoice>('today');
    const [customDate, setCustomDate] = useState('');
    const [programWeeks, setProgramWeeks] = useState<number>(DEFAULT_PROGRAM_WEEKS);
    const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>('balanced');
    const [varietyPreference, setVarietyPreference] = useState<VarietyPreference>('varied');
    const [loadingLean, setLoadingLean] = useState<LoadingPreference | null>(null);
    const [loading, setLoading] = useState(false);

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
    // training-style, variety, and loading steps when each is shown.
    const total =
        8 +
        genderOffset +
        (showStyleStep ? 1 : 0) +
        (collectTrainingStyle ? 1 : 0) +
        (collectVariety ? 1 : 0) +
        (collectLoadingLean ? 1 : 0);
    // Tail-step display numbers: start = total, length = total - 1,
    // loading = total - 2, variety = total - 2 - (collectLoadingLean ? 1 : 0),
    // train_style = total - 2 - (collectLoadingLean ? 1 : 0) - (collectVariety ? 1 : 0).

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // Resolve the chosen start to an ISO anchor at noon UTC (program day one).
    // "Next Monday" lands on today when today is already Monday.
    function startAnchorISO(): string {
        if (startChoice === 'custom') return `${customDate}T12:00:00.000Z`;
        const d = new Date();
        if (startChoice === 'tomorrow') d.setDate(d.getDate() + 1);
        else if (startChoice === 'monday') d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7));
        return `${toYmd(d)}T12:00:00.000Z`;
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
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={1} total={total} />
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
                    {/* Next is always enabled: no gender is a valid choice, so the
                        score and program fall back to their neutral defaults. */}
                    <button onClick={() => setStep(1)} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 1)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={1 + genderOffset}
                        total={total}
                        onBack={collectGender ? () => setStep('gender') : undefined}
                    />
                    {!collectGender && introBlock}
                    <p className={Q}>What equipment do you have access to?</p>
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
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setStep(2)}
                            disabled={equipment.size === 0}
                            className={BTN_PRIMARY_BLOCK}>
                            Next
                        </button>
                        <button
                            onClick={onClose}
                            className="font-pulse text-xs text-pulse-dim text-center bg-transparent border-none cursor-pointer">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );

    if (step === 2)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={2 + genderOffset} total={total} onBack={() => setStep(1)} />
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
                    <button onClick={() => setStep(3)} disabled={!experience} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 3)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={3 + genderOffset} total={total} onBack={() => setStep(2)} />
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
                    <button onClick={() => setStep(4)} disabled={!goal} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 4)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={4 + genderOffset} total={total} onBack={() => setStep(3)} />
                    <p className={Q}>How many days per week can you train?</p>
                    <div className="flex flex-col gap-2">
                        <OptionRow label="2–3 days" active={days === '2-3'} onClick={() => chooseDays('2-3')} />
                        <OptionRow label="4 days" active={days === '4'} onClick={() => chooseDays('4')} />
                        <OptionRow label="5–6 days" active={days === '5-6'} onClick={() => chooseDays('5-6')} />
                    </div>
                    <button
                        onClick={() => {
                            if (trainingDays.length === 0) setTrainingDays(days ? (SUGGESTED_DAYS[days] ?? []) : []);
                            setStep(5);
                        }}
                        disabled={!days}
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 5)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={5 + genderOffset} total={total} onBack={() => setStep(4)} />
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
                </div>
            </div>
        );

    if (step === 6 && showStyleStep)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={6 + genderOffset} total={total} onBack={() => setStep(5)} />
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
                    <button onClick={() => setStep(7)} disabled={!styleKey} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 'train_style')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 2 - (collectVariety ? 1 : 0) - (collectLoadingLean ? 1 : 0)}
                        total={total}
                        onBack={() => setStep(7)}
                    />
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
                    <button
                        onClick={() => setStep(collectVariety ? 'variety' : collectLoadingLean ? 'loading' : 'length')}
                        className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 'variety')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 2 - (collectLoadingLean ? 1 : 0)}
                        total={total}
                        onBack={() => setStep(collectTrainingStyle ? 'train_style' : 7)}
                    />
                    <p className={Q}>How varied should it be?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Consistency builds your main lifts; variety keeps training fresh. You can change this anytime you regenerate.
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
                    <button onClick={() => setStep(collectLoadingLean ? 'loading' : 'length')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 'loading')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 2}
                        total={total}
                        onBack={() => setStep(collectVariety ? 'variety' : collectTrainingStyle ? 'train_style' : 7)}
                    />
                    <p className={Q}>Which equipment do you prefer to use?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Pulse will lean toward that type when filling each slot. Only applies to what you actually own. Skip to let it choose freely.
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
                    <button onClick={() => setStep('length')} className={BTN_PRIMARY_BLOCK}>
                        {loadingLean ? 'Next' : 'Skip'}
                    </button>
                </div>
            </div>
        );

    if (step === 'length')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header
                        stepNum={total - 1}
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
                    />
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
                    <button onClick={() => setStep('start')} className={BTN_PRIMARY_BLOCK}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 'start')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={total} total={total} onBack={() => setStep('length')} />
                    <p className={Q}>When do you want to start?</p>
                    <p className="-mt-3 font-pulse text-[0.8125rem] text-pulse-dim">
                        Sets your program&apos;s first day. You can change it later in Plan.
                    </p>
                    <div className="flex flex-col gap-2">
                        <OptionRow
                            label="Today"
                            active={startChoice === 'today'}
                            onClick={() => setStartChoice('today')}
                        />
                        <OptionRow
                            label="Tomorrow"
                            active={startChoice === 'tomorrow'}
                            onClick={() => setStartChoice('tomorrow')}
                        />
                        <OptionRow
                            label="Next Monday"
                            active={startChoice === 'monday'}
                            onClick={() => setStartChoice('monday')}
                        />
                        <OptionRow
                            label="Pick a date"
                            active={startChoice === 'custom'}
                            onClick={() => setStartChoice('custom')}
                        />
                    </div>
                    {startChoice === 'custom' && (
                        <input
                            type="date"
                            aria-label="Start date"
                            value={customDate}
                            min={toYmd(new Date())}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full rounded-xl border border-pulse-border bg-pulse-surface-2 px-3 py-2.5 font-pulse text-sm text-pulse-text outline-none [color-scheme:dark] focus:border-pulse-accent/50"
                        />
                    )}
                    <button
                        onClick={handleComplete}
                        disabled={loading || (startChoice === 'custom' && !customDate)}
                        className={BTN_PRIMARY_BLOCK}>
                        {loading ? 'Building your routine…' : completeLabel}
                    </button>
                </div>
            </div>
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
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={total - 2 - (collectTrainingStyle ? 1 : 0) - (collectVariety ? 1 : 0) - (collectLoadingLean ? 1 : 0)} total={total} onBack={() => setStep(showStyleStep ? 6 : 5)} />
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
                <button onClick={() => setStep(collectTrainingStyle ? 'train_style' : collectVariety ? 'variety' : collectLoadingLean ? 'loading' : 'length')} disabled={!sessionTime} className={BTN_PRIMARY_BLOCK}>
                    Next
                </button>
            </div>
        </div>
    );
}
