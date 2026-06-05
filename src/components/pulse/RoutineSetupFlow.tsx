'use client';
import { useState } from 'react';
import { DAY_NAMES, SUGGESTED_DAYS } from '@/lib/pulse/constants';
import { STYLES, recommendStyle, resolveStyle, buildRationale } from '@/lib/pulse/generation';
import { BTN_PRIMARY_BLOCK } from './ui';
import type { EquipmentKey, SessionTime, Gender } from '@/lib/pulse/types';
import type { OnboardingAnswers, DaysPerWeek, ExperienceLevel, Goal } from '@/lib/pulse/recommendation';

// Steps: 'gender' (only when collectGender, optional/skippable) · 1 equipment ·
// 2 experience · 3 goal · 4 days/week · 5 which days ·
// 6 program style (only when >1 style exists for the count) · 7 session time.
type Step = 'gender' | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
}

export default function RoutineSetupFlow({
    initial,
    onComplete,
    onClose,
    completeLabel = 'Create routine',
    collectGender = false,
}: Props) {
    const [step, setStep] = useState<Step>(collectGender ? 'gender' : 1);
    const [gender, setGender] = useState<Gender | null>(null);
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set(initial?.equipment ?? []));
    const [experience, setExperience] = useState<ExperienceLevel | null>(initial?.experience ?? null);
    const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
    const [days, setDays] = useState<DaysPerWeek | null>(initial?.days ?? null);
    const [sessionTime, setSessionTime] = useState<SessionTime | null>(initial?.sessionTime ?? null);
    const [trainingDays, setTrainingDays] = useState<number[]>(initial?.trainingDays ?? []);
    const [styleKey, setStyleKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Program styles for the chosen number of training days. The style step is
    // only shown when there is more than one to pick from.
    const styleOptions = STYLES[trainingDays.length] ?? [];
    const showStyleStep = styleOptions.length > 1;
    // The optional gender step adds one to the count and shifts the numbered steps
    // one position later in the progress display.
    const genderOffset = collectGender ? 1 : 0;
    const total = (showStyleStep ? 7 : 6) + genderOffset;

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
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
                });
            } finally {
                setLoading(false);
                onClose();
            }
        })();
    }

    if (step === 'gender')
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={1} total={total} />
                    <p className={Q}>What&apos;s your gender?</p>
                    <p className="font-pulse text-xs text-pulse-dim -mt-3">
                        Used for strength standards and a light program nudge. Optional.
                    </p>
                    <div className="flex flex-col gap-2">
                        <OptionRow label="Male" active={gender === 'male'} onClick={() => setGender('male')} />
                        <OptionRow label="Female" active={gender === 'female'} onClick={() => setGender('female')} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => setStep(1)} disabled={!gender} className={BTN_PRIMARY_BLOCK}>
                            Next
                        </button>
                        <button
                            onClick={() => {
                                setGender(null);
                                setStep(1);
                            }}
                            className="font-pulse text-xs text-pulse-dim text-center bg-transparent border-none cursor-pointer">
                            Skip
                        </button>
                    </div>
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
                        <OptionRow label="2–3 days" active={days === '2-3'} onClick={() => setDays('2-3')} />
                        <OptionRow label="4 days" active={days === '4'} onClick={() => setDays('4')} />
                        <OptionRow label="5–6 days" active={days === '5-6'} onClick={() => setDays('5-6')} />
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
                    <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                            <button
                                key={d}
                                onClick={() =>
                                    setTrainingDays((prev) =>
                                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                                    )
                                }
                                className={`font-pulse text-xs font-semibold rounded-full w-12 h-12 border-none cursor-pointer transition-colors ${
                                    trainingDays.includes(d)
                                        ? 'bg-pulse-accent text-pulse-bg'
                                        : 'bg-pulse-surface-2 text-pulse-dim'
                                }`}>
                                {DAY_NAMES[d]}
                            </button>
                        ))}
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

    // Final step: live rationale preview built from the chosen inputs, mirroring
    // what buildRationale persists on the routine after generation.
    const previewStyle = resolveStyle(styleKey ?? recommendStyle(trainingDays.length), trainingDays.length);
    const rationalePreview =
        experience && goal && days && sessionTime && trainingDays.length > 0
            ? buildRationale({ equipment, experience, goal, days }, sessionTime, previewStyle)
            : null;

    return (
        <div className={WRAP}>
            <div className={CARD}>
                <Header stepNum={total} total={total} onBack={() => setStep(showStyleStep ? 6 : 5)} />
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
                <button onClick={handleComplete} disabled={!sessionTime || loading} className={BTN_PRIMARY_BLOCK}>
                    {loading ? 'Building your routine…' : completeLabel}
                </button>
            </div>
        </div>
    );
}
