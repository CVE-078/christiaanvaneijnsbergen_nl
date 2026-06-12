'use client';
import { useTransition, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { useToast } from '@/lib/pulse/toast';
import type { Gender, PriorityMuscle } from '@/lib/pulse/types';
import { genderDefault } from '@/lib/pulse/generation';
import { ACCENT_PRESETS, DEFAULT_ACCENT_KEY } from '@/lib/pulse/constants';
import {
    TRAINING_STYLE_OPTIONS,
    VARIETY_OPTIONS,
    LOADING_LEAN_OPTIONS,
    RESTRICTION_OPTIONS,
} from '@/lib/pulse/generationPreferences';
import EquipmentProfilesEditor from '../EquipmentProfilesEditor';
import AccountSecuritySection from '../AccountSecuritySection';
import PageTitle from '../PageTitle';
import PageSkeleton, { ErrorState } from '../PageSkeleton';
import SegmentedTabs from '../SegmentedTabs';
import { INPUT } from '../ui';

type ProfileTab = 'you' | 'training';

const PROFILE_TABS = [
    { id: 'you', label: 'You' },
    { id: 'training', label: 'Training' },
];

// Small section label matching the mockup's .lbl style
function Lbl({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
    return (
        <div
            className={`text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted font-semibold ${first ? 'mt-[6px] mb-[9px]' : 'mt-[18px] mb-[9px]'}`}>
            {children}
        </div>
    );
}

// A single info/action row matching .row style
function Row({
    label,
    right,
    onClick,
    labelClass = '',
}: {
    label: React.ReactNode;
    right?: React.ReactNode;
    onClick?: () => void;
    labelClass?: string;
}) {
    const inner = (
        <>
            <span className={`font-pulse font-semibold text-[0.92rem] ${labelClass || 'text-pulse-text'}`}>
                {label}
            </span>
            {right !== undefined && (
                <span className="font-pulse text-[0.85rem] text-pulse-dim flex items-center gap-1">{right}</span>
            )}
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px] w-full border-none cursor-pointer text-left">
                {inner}
            </button>
        );
    }
    return (
        <div className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
            {inner}
        </div>
    );
}

// Chevron glyph
function Chev() {
    return <span className="text-pulse-muted">›</span>;
}

// Pill button: filled accent when active, surface-2 when not
function Pill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-[13px] py-[7px] rounded-full text-[0.78rem] font-semibold border-none cursor-pointer ${
                active ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'
            }`}>
            {children}
        </button>
    );
}

// Toggle pill: faint accent tint + accent text + border when active
function TogPill({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-[13px] py-[7px] rounded-full text-[0.78rem] font-semibold cursor-pointer border ${
                active
                    ? 'bg-pulse-accent/16 text-pulse-accent border-pulse-accent/50'
                    : 'bg-pulse-surface-2 text-pulse-dim border-transparent'
            }`}>
            {children}
        </button>
    );
}

// Option card: .opt / .opt.sel style
function OptCard({
    active,
    label,
    desc,
    onClick,
    disabled,
}: {
    active: boolean;
    label: string;
    desc?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={`w-full text-left rounded-xl px-[13px] py-[11px] mb-[7px] border-[1.5px] cursor-pointer transition-colors ${
                active
                    ? 'border-pulse-accent bg-pulse-accent/8 text-pulse-accent'
                    : 'border-transparent bg-pulse-surface text-pulse-text'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className={`font-pulse font-semibold text-[0.9rem] ${active ? 'text-pulse-accent' : 'text-pulse-text'}`}>
                {label}
            </div>
            {active && desc && (
                <div className="font-pulse text-[0.76rem] text-pulse-dim leading-[1.4] mt-[3px]">{desc}</div>
            )}
        </button>
    );
}

export default function ProfileView() {
    const {
        email,
        profile,
        updateProfile,
        updateGender,
        autoAdvance,
        setAutoAdvance,
        updatePriorityMuscle,
        updateAccentColor,
        updateMovementRestrictions,
        updateTrainingStyle,
        updateVarietyPreference,
        updateLoadingLean,
        triggerOnboarding,
        handleExport,
        routines,
        loading,
        errors,
        retry,
    } = usePulse();
    const toast = useToast();

    const { display_name: displayName, unit, gender } = profile;
    const priorityValue: PriorityMuscle | 'balanced' = profile.priority_muscle ?? genderDefault(gender);
    const PRIORITY_OPTIONS: (PriorityMuscle | 'balanced')[] = [
        'balanced',
        'glutes',
        'legs',
        'chest',
        'back',
        'shoulders',
        'arms',
    ];

    const [tab, setTab] = useState<ProfileTab>('you');
    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName ?? '');

    // Find active routine name for the "Routine & data" row
    const activeRoutine = routines?.find((r) => r.id === profile.active_routine_id) ?? null;
    const activeRoutineName = activeRoutine?.name ?? null;

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
            toast.show('Unit updated', 'success');
        });
    }

    function handlePriorityChange(value: PriorityMuscle | 'balanced') {
        if (value === priorityValue || isPending) return;
        startTransition(async () => {
            await updatePriorityMuscle(value);
            toast.show('Training priority updated', 'success');
        });
    }

    function handleGenderChange(newGender: Gender | null) {
        if (newGender === gender || isPending) return;
        startTransition(async () => {
            await updateGender(newGender);
            toast.show('Gender updated', 'success');
        });
    }

    function handleNameSave() {
        const trimmed = nameInput.trim() || null;
        setEditingName(false);
        if (trimmed === displayName) return;
        startTransition(async () => {
            await updateProfile(trimmed, unit);
            toast.show('Name saved', 'success');
        });
    }

    function handleNameKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setNameInput(displayName ?? '');
            setEditingName(false);
        }
    }

    if (errors?.profile) return <ErrorState onRetry={retry} />;
    if (loading?.profile) return <PageSkeleton rows={3} />;

    return (
        <div className="pt-5 px-4 pb-12 max-w-[480px] mx-auto lg:max-w-[1000px] lg:pt-6 lg:px-6 lg:pb-12">
            <PageTitle>Profile</PageTitle>

            <div className="mt-4 mb-6">
                <SegmentedTabs
                    tabs={PROFILE_TABS}
                    active={tab}
                    onChange={(id) => setTab(id as ProfileTab)}
                    ariaLabel="Profile sections"
                    variant="solid"
                />
            </div>

            {/* You panel. Both panels stay mounted so form state survives a tab
                switch. Visibility uses two mechanisms on purpose: the `hidden`
                attribute hides it for the a11y tree and for jsdom tests (which load
                no CSS), while the `hidden` class handles real-browser display, since
                the active flex class would otherwise override the attribute. */}
            <div
                id="panel-you"
                role="tabpanel"
                aria-labelledby="tab-you"
                hidden={tab !== 'you'}
                className={tab === 'you' ? 'grid2-you' : 'hidden'}>

                {/* Wrapping grid: single column on mobile, two-column on lg */}
                <div className={`${tab === 'you' ? 'grid gap-0 lg:grid-cols-2 lg:gap-[14px] lg:items-start' : ''}`}>
                    {/* Left column: Identity, Gender, App */}
                    <div>
                        {/* Identity */}
                        <Lbl first>Identity</Lbl>

                        {/* Display name row (mockup: plain row, no avatar) + email subline */}
                        <div className="bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
                            {editingName ? (
                                <input
                                    autoFocus
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onBlur={handleNameSave}
                                    onKeyDown={handleNameKeyDown}
                                    placeholder="Display name"
                                    className="font-pulse text-[0.92rem] font-semibold text-pulse-text bg-transparent border-none border-b border-pulse-accent outline-none w-full pb-0.5"
                                />
                            ) : (
                                <button
                                    onClick={() => {
                                        setNameInput(displayName ?? '');
                                        setEditingName(true);
                                    }}
                                    className="w-full flex items-center justify-between gap-3 bg-transparent border-none p-0 cursor-text text-left">
                                    <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">
                                        Display name
                                    </span>
                                    <span className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            className={`font-pulse text-[0.85rem] truncate ${displayName ? 'text-pulse-dim' : 'text-pulse-muted'}`}>
                                            {displayName ?? 'Add display name'}
                                        </span>
                                        <Chev />
                                    </span>
                                </button>
                            )}
                            <div className="font-pulse text-[0.76rem] text-pulse-muted mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {email}
                            </div>
                        </div>

                        {/* Gender */}
                        <Lbl>Gender</Lbl>
                        <div className="flex gap-[6px] flex-wrap mb-[7px]">
                            <Pill active={gender === 'male'} onClick={() => handleGenderChange('male')}>
                                Male
                            </Pill>
                            <Pill active={gender === 'female'} onClick={() => handleGenderChange('female')}>
                                Female
                            </Pill>
                            <Pill active={gender == null} onClick={() => handleGenderChange(null)}>
                                Prefer not to say
                            </Pill>
                        </div>

                        {/* App */}
                        <Lbl>App</Lbl>

                        {/* Weight unit row */}
                        <div className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
                            <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">
                                Weight unit
                            </span>
                            <div className="flex gap-[6px]">
                                {(['kg', 'lbs'] as const).map((u) => (
                                    <Pill key={u} active={unit === u} onClick={() => handleUnitChange(u)}>
                                        {u}
                                    </Pill>
                                ))}
                            </div>
                        </div>

                        {/* Accent colour row */}
                        <div className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
                            <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">
                                Accent colour
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {ACCENT_PRESETS.map((p) => {
                                    const active = (profile.accent_color ?? DEFAULT_ACCENT_KEY) === p.key;
                                    return (
                                        <button
                                            key={p.key}
                                            type="button"
                                            aria-label={p.label}
                                            aria-pressed={active}
                                            title={p.label}
                                            onClick={() => updateAccentColor(p.key)}
                                            className={`h-7 w-7 cursor-pointer rounded-full border-none transition-transform shrink-0 ${active ? 'scale-110' : 'hover:scale-105'}`}
                                            style={{
                                                backgroundColor: p.accent,
                                                boxShadow: active
                                                    ? `0 0 0 2px var(--color-pulse-bg), 0 0 0 4px ${p.accent}`
                                                    : 'none',
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Auto-advance rest timer row */}
                        <div className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
                            <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">
                                Auto-advance rest timer
                            </span>
                            <button
                                role="switch"
                                aria-checked={autoAdvance}
                                aria-label="Auto-advance rest timer"
                                onClick={() => setAutoAdvance(!autoAdvance)}
                                className={`relative w-[42px] h-6 rounded-full shrink-0 cursor-pointer border-none transition-colors ${autoAdvance ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}>
                                <span
                                    className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-pulse-bg transition-transform ${autoAdvance ? 'right-[3px]' : 'left-[3px]'}`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Right column: Routine & data, Account & security */}
                    <div>
                        {/* Routine & data */}
                        <Lbl first>Routine &amp; data</Lbl>

                        <Row
                            label="Active routine"
                            right={
                                <>
                                    <span>{activeRoutineName ?? 'No routine'}</span>
                                    <Chev />
                                </>
                            }
                            onClick={triggerOnboarding}
                        />

                        <Row
                            label="Export history (CSV)"
                            right={<span className="text-pulse-muted">↓</span>}
                            onClick={handleExport}
                        />

                        {/* Account & security */}
                        <Lbl>Account &amp; security</Lbl>

                        <AccountSecuritySection />
                    </div>
                </div>
            </div>

            {/* Training panel */}
            <div
                id="panel-training"
                role="tabpanel"
                aria-labelledby="tab-training"
                hidden={tab !== 'training'}
                className={tab === 'training' ? 'flex flex-col gap-0' : 'hidden'}>

                <p className="font-pulse text-[0.78rem] text-pulse-muted mt-[8px] mb-[6px]">
                    Shape how Pulse builds your routines. Applies to plans you generate from now on.
                </p>

                <div
                    data-testid="training-preferences-section"
                    className="grid gap-0 lg:grid-cols-2 lg:gap-[14px] lg:items-start">
                    {/* Left column: Training style + Exercise variety */}
                    <div>
                        {/* Training style */}
                        <Lbl first>Training style</Lbl>
                        {TRAINING_STYLE_OPTIONS.map(({ key, label, desc }) => {
                            const active = (profile.training_style ?? 'balanced') === key;
                            return (
                                <OptCard
                                    key={key}
                                    active={active}
                                    label={label}
                                    desc={desc}
                                    disabled={isPending}
                                    onClick={() => {
                                        if (isPending || active) return;
                                        startTransition(async () => {
                                            await updateTrainingStyle(key);
                                        });
                                    }}
                                />
                            );
                        })}

                        {/* Exercise variety */}
                        <Lbl>Exercise variety</Lbl>
                        {VARIETY_OPTIONS.map(({ key, label, desc }) => {
                            const active = (profile.variety_preference ?? 'varied') === key;
                            return (
                                <OptCard
                                    key={key}
                                    active={active}
                                    label={label}
                                    desc={desc}
                                    disabled={isPending}
                                    onClick={() => {
                                        if (isPending || active) return;
                                        startTransition(async () => {
                                            await updateVarietyPreference(key);
                                        });
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Right column: Equipment preference + Movement restrictions + Training priority */}
                    <div>
                        {/* Equipment preference */}
                        <Lbl first>Equipment preference</Lbl>

                        {/* No preference option */}
                        <OptCard
                            active={profile.loading_lean == null}
                            label="No preference"
                            desc="Pulse chooses freely from what you own."
                            disabled={isPending}
                            onClick={() => {
                                if (isPending || profile.loading_lean == null) return;
                                startTransition(async () => {
                                    await updateLoadingLean(null);
                                });
                            }}
                        />
                        {LOADING_LEAN_OPTIONS.map(({ key, label, desc }) => {
                            const active = profile.loading_lean === key;
                            return (
                                <OptCard
                                    key={key}
                                    active={active}
                                    label={label}
                                    desc={desc}
                                    disabled={isPending}
                                    onClick={() => {
                                        if (isPending || active) return;
                                        startTransition(async () => {
                                            await updateLoadingLean(key);
                                        });
                                    }}
                                />
                            );
                        })}

                        {/* Movement restrictions */}
                        <Lbl>Movement restrictions</Lbl>
                        <p className="font-pulse text-[0.8125rem] text-pulse-dim mb-[9px]">
                            Joints to work around. Applies to routines you generate from now on. To change your
                            current plan, use the Swap option on any exercise.
                        </p>
                        <div className="flex gap-[6px] flex-wrap mb-[7px]">
                            {RESTRICTION_OPTIONS.map(({ key, label }) => {
                                const active = (profile.movement_restrictions ?? []).includes(key);
                                return (
                                    <TogPill
                                        key={key}
                                        active={active}
                                        onClick={() => {
                                            if (isPending) return;
                                            const current = profile.movement_restrictions ?? [];
                                            const next = active
                                                ? current.filter((r) => r !== key)
                                                : [...current, key];
                                            startTransition(async () => {
                                                await updateMovementRestrictions(next);
                                            });
                                        }}>
                                        {label}
                                    </TogPill>
                                );
                            })}
                        </div>

                        {/* Training priority */}
                        <Lbl>Training priority</Lbl>
                        <div className="flex items-center justify-between bg-pulse-surface rounded-xl px-[13px] py-[13px] mb-[7px]">
                            <span className="font-pulse font-semibold text-[0.92rem] text-pulse-text">
                                Lean toward
                            </span>
                            <div className="flex items-center gap-1 text-pulse-dim font-pulse text-[0.85rem]">
                                <select
                                    aria-label="Training priority"
                                    value={priorityValue}
                                    onChange={(e) =>
                                        handlePriorityChange(e.target.value as PriorityMuscle | 'balanced')
                                    }
                                    disabled={isPending}
                                    className={`${INPUT} capitalize bg-transparent border-none text-pulse-dim font-pulse text-[0.85rem] p-0 cursor-pointer appearance-none`}>
                                    {PRIORITY_OPTIONS.map((p) => (
                                        <option key={p} value={p}>
                                            {p === 'balanced' ? 'Balanced' : p[0].toUpperCase() + p.slice(1)}
                                        </option>
                                    ))}
                                </select>
                                <Chev />
                            </div>
                        </div>

                        {/* Equipment profiles */}
                        <Lbl>Equipment profiles</Lbl>
                        <EquipmentProfilesEditor />
                    </div>
                </div>
            </div>
        </div>
    );
}
