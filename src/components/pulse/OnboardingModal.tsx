'use client';
import { useState, useTransition } from 'react';
import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';
import { templateMatchesEquipment } from '@/lib/pulse/types';
import { recommendTemplate } from '@/lib/pulse/recommendation';
import { DAY_NAMES, SUGGESTED_DAYS, EXPERIENCE_LEVEL_COLOR } from '@/lib/pulse/constants';
import type { EquipmentKey, RoutineTemplate } from '@/lib/pulse/types';
import type { OnboardingAnswers, DaysPerWeek, ExperienceLevel, Goal } from '@/lib/pulse/recommendation';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 'result';

const WRAP = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';
const CARD = 'bg-pulse-surface rounded-2xl w-full max-w-[420px] flex flex-col gap-5 p-6';
const Q = 'font-pulse text-lg font-medium text-pulse-text tracking-[-0.01em]';
const BTN_PRIMARY =
    'font-pulse text-sm font-semibold bg-pulse-accent text-pulse-bg rounded-lg px-5 py-2.5 cursor-pointer border-none disabled:opacity-50 w-full';

function ProgressBar({ current }: { current: number }) {
    return (
        <div className="h-1 bg-pulse-border rounded-full overflow-hidden">
            <div
                className="h-full bg-pulse-accent rounded-full transition-all"
                style={{ width: `${Math.round(current * (100 / 6))}%` }}
            />
        </div>
    );
}

function Header({ stepNum, onBack }: { stepNum: number; onBack?: () => void }) {
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
                <ProgressBar current={stepNum} />
            </div>
            <span className="font-pulse text-xs text-pulse-muted shrink-0">{stepNum}/6</span>
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

export default function OnboardingModal() {
    const { cloneTemplate, completeOnboarding, dismissOnboarding, navigate } = usePulse();
    const [, startTransition] = useTransition();
    const [step, setStep] = useState<Step>(1);
    const [equipment, setEquipment] = useState<Set<EquipmentKey>>(new Set());
    const [experience, setExperience] = useState<ExperienceLevel | null>(null);
    const [goal, setGoal] = useState<Goal | null>(null);
    const [days, setDays] = useState<DaysPerWeek | null>(null);
    const [sessionTime, setSessionTime] = useState<string | null>(null);
    const [recommendedSlug, setRecommendedSlug] = useState<string | null | undefined>(undefined);
    const [pickedSlug, setPickedSlug] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [trainingDays, setTrainingDays] = useState<number[]>([]);

    const { data: templates = [] } = useSWR<RoutineTemplate[]>('/api/pulse/templates', (url: string) =>
        fetch(url).then((r) => r.json()),
    );

    function toggleEquipment(key: EquipmentKey) {
        setEquipment((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function goToResult() {
        const slug = recommendTemplate({
            equipment,
            experience: experience!,
            goal: goal!,
            days: days!,
        } as OnboardingAnswers);
        setRecommendedSlug(slug);
        setStep('result');
    }

    function handleStart(slug: string) {
        setLoading(true);
        void startTransition(() => {
            void (async () => {
                await cloneTemplate(slug, trainingDays.length > 0 ? trainingDays : undefined, sessionTime ?? undefined);
                await completeOnboarding();
                dismissOnboarding();
                navigate('train');
                setLoading(false);
            })();
        });
    }

    const EQUIPMENT_OPTIONS: { key: EquipmentKey; label: string }[] = [
        { key: 'dumbbells', label: 'Dumbbells' },
        { key: 'barbell', label: 'Barbell & plates' },
        { key: 'bench', label: 'Weight bench' },
        { key: 'cables', label: 'Cable machine' },
        { key: 'machines', label: 'Gym machines (leg press, lat pulldown, etc.)' },
    ];

    if (step === 1)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={1} />
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
                        <button onClick={() => setStep(2)} disabled={equipment.size === 0} className={BTN_PRIMARY}>
                            Next
                        </button>
                        <button
                            onClick={dismissOnboarding}
                            className="font-pulse text-xs text-pulse-dim text-center bg-transparent border-none cursor-pointer">
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        );

    if (step === 2)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={2} onBack={() => setStep(1)} />
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
                    <button onClick={() => setStep(3)} disabled={!experience} className={BTN_PRIMARY}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 3)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={3} onBack={() => setStep(2)} />
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
                    <button onClick={() => setStep(4)} disabled={!goal} className={BTN_PRIMARY}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 4)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={4} onBack={() => setStep(3)} />
                    <p className={Q}>How many days per week can you train?</p>
                    <div className="flex flex-col gap-2">
                        <OptionRow label="2–3 days" active={days === '2-3'} onClick={() => setDays('2-3')} />
                        <OptionRow label="4 days" active={days === '4'} onClick={() => setDays('4')} />
                        <OptionRow label="5–6 days" active={days === '5-6'} onClick={() => setDays('5-6')} />
                    </div>
                    <button
                        onClick={() => {
                            setTrainingDays(days ? (SUGGESTED_DAYS[days] ?? []) : []);
                            setStep(5);
                        }}
                        disabled={!days}
                        className={BTN_PRIMARY}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 5)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={5} onBack={() => setStep(4)} />
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
                    <button onClick={() => setStep(6)} disabled={trainingDays.length === 0} className={BTN_PRIMARY}>
                        Next
                    </button>
                </div>
            </div>
        );

    if (step === 6)
        return (
            <div className={WRAP}>
                <div className={CARD}>
                    <Header stepNum={6} onBack={() => setStep(5)} />
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
                    <button onClick={goToResult} disabled={!sessionTime} className={BTN_PRIMARY}>
                        See my recommendation
                    </button>
                </div>
            </div>
        );

    // Result screen
    if (step === 'result') {
        // Single recommendation (build_muscle or lose_fat)
        if (recommendedSlug !== null) {
            const tpl = templates.find((t) => t.slug === recommendedSlug);
            return (
                <div className={WRAP}>
                    <div className={CARD}>
                        <div className="font-pulse text-[0.625rem] tracking-[0.16em] uppercase text-pulse-muted">
                            Recommended for you
                        </div>
                        <div>
                            <div className="font-pulse text-lg font-medium text-pulse-text tracking-[-0.01em]">
                                {tpl?.name ?? recommendedSlug}
                            </div>
                            <div className="font-pulse text-xs text-pulse-dim mt-1">
                                Based on your answers: {experience}, {goal?.replace('_', ' ')}, {days} days,{' '}
                                {sessionTime}
                            </div>
                            {tpl && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    <span className="font-pulse text-[0.625rem] text-pulse-dim">
                                        {tpl.days_per_week}×/week · {tpl.session_time}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleStart(recommendedSlug!)}
                                disabled={loading}
                                className={BTN_PRIMARY}>
                                {loading ? 'Setting up…' : 'Start with this routine'}
                            </button>
                            <button
                                onClick={() => {
                                    navigate('explore');
                                    dismissOnboarding();
                                }}
                                className="font-pulse text-xs text-pulse-accent text-center bg-transparent border-none cursor-pointer">
                                Not quite right? Browse all templates
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // General fitness — show filtered template picker
        const filteredTemplates = templates.filter((t) => templateMatchesEquipment(t, equipment));
        return (
            <div className={WRAP}>
                <div className={`${CARD} max-h-[80vh] overflow-y-auto`}>
                    <p className={Q}>Choose a routine that fits you</p>
                    <div className="flex flex-col gap-3">
                        {filteredTemplates.map((t) => (
                            <button
                                key={t.slug}
                                onClick={() => setPickedSlug(t.slug)}
                                className={`text-left p-3 rounded-xl cursor-pointer transition-colors ${
                                    pickedSlug === t.slug
                                        ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                        : 'bg-pulse-surface-2 ring-0'
                                }`}>
                                <div className="font-pulse text-sm font-medium text-pulse-text">{t.name}</div>
                                <div className="flex gap-2 mt-1">
                                    <span
                                        className={`font-pulse text-[0.625rem] tracking-[0.08em] uppercase ${EXPERIENCE_LEVEL_COLOR[t.experience_level]}`}>
                                        {t.experience_level}
                                    </span>
                                    <span className="font-pulse text-[0.625rem] text-pulse-dim">
                                        {t.days_per_week}×/week · {t.session_time}
                                    </span>
                                </div>
                                <p className="font-pulse text-xs text-pulse-muted mt-1">{t.description}</p>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => pickedSlug && handleStart(pickedSlug)}
                        disabled={!pickedSlug || loading}
                        className={BTN_PRIMARY}>
                        {loading ? 'Setting up…' : 'Start with this routine'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
