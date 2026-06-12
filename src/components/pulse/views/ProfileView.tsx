'use client';
import { useTransition, useState } from 'react';
import { getInitials } from '@/lib/pulse/utils';
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
import SectionLabel from '../SectionLabel';
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
        loading,
        errors,
        retry,
    } = usePulse();
    const toast = useToast();

    const { display_name: displayName, unit, gender } = profile;
    // What the priority control shows: the explicit choice, or the gender default
    // when never set. 'balanced' renders as the "Balanced" option.
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

    const initials = displayName ? getInitials(displayName, 2) : (email[0]?.toUpperCase() ?? '?');

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
        <div className="pt-5 px-4 pb-12 max-w-[480px] mx-auto lg:max-w-[860px] lg:pt-6 lg:px-6 lg:pb-12">
            <PageTitle>Profile</PageTitle>

            <div className="mt-4 mb-6">
                <SegmentedTabs
                    tabs={PROFILE_TABS}
                    active={tab}
                    onChange={(id) => setTab(id as ProfileTab)}
                    ariaLabel="Profile sections"
                />
            </div>

            {/* You panel. Both panels stay mounted so form state survives a tab
                switch. Visibility uses two mechanisms on purpose: the `hidden`
                attribute hides it for the a11y tree and for jsdom tests (which load
                no CSS), while the `hidden` class handles real-browser display, since
                the active `flex` class would otherwise override the attribute. */}
            <div
                id="panel-you"
                role="tabpanel"
                aria-labelledby="tab-you"
                hidden={tab !== 'you'}
                className={tab === 'you' ? 'flex flex-col gap-7 lg:flex-row lg:gap-10' : 'hidden'}>
                <div className="flex flex-col gap-7 lg:w-[280px] lg:shrink-0">
                    {/* Identity */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl shrink-0 bg-pulse-accent flex items-center justify-center font-pulse text-xl font-semibold text-pulse-bg tracking-[-0.02em]">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            {editingName ? (
                                <input
                                    autoFocus
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onBlur={handleNameSave}
                                    onKeyDown={handleNameKeyDown}
                                    placeholder="Display name"
                                    className="font-pulse text-base font-semibold text-pulse-text bg-transparent border-none border-b border-pulse-accent outline-none w-full pb-0.5"
                                />
                            ) : (
                                <button
                                    onClick={() => {
                                        setNameInput(displayName ?? '');
                                        setEditingName(true);
                                    }}
                                    className={`font-pulse text-base font-semibold bg-transparent border-none p-0 cursor-text text-left block w-full ${displayName ? 'text-pulse-text' : 'text-pulse-dim'}`}>
                                    {displayName ?? 'Add display name'}
                                </button>
                            )}
                            <div className="font-pulse text-[0.8125rem] text-pulse-dim mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {email}
                            </div>
                        </div>
                    </div>

                    {/* Gender */}
                    <div>
                        <SectionLabel className="mb-2">Gender</SectionLabel>
                        <div className="flex gap-2 flex-wrap">
                            {(['male', 'female'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleGenderChange(s)}
                                    className={`font-pulse text-sm font-semibold tracking-[0.06em] uppercase py-2 px-4 rounded-lg cursor-pointer border-none ${gender === s ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                                    {s === 'male' ? 'Male' : 'Female'}
                                </button>
                            ))}
                            <button
                                onClick={() => handleGenderChange(null)}
                                className={`font-pulse text-sm font-semibold tracking-[0.06em] py-2 px-4 rounded-lg cursor-pointer border-none ${gender == null ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                                Prefer not to say
                            </button>
                        </div>
                    </div>

                    {/* Unit toggle */}
                    <div>
                        <SectionLabel className="mb-2">Weight Unit</SectionLabel>
                        <div className="flex gap-2">
                            {(['kg', 'lbs'] as const).map((u) => (
                                <button
                                    key={u}
                                    onClick={() => handleUnitChange(u)}
                                    className={`font-pulse text-sm font-semibold tracking-[0.06em] uppercase py-2 px-4 rounded-lg cursor-pointer border-none ${unit === u ? 'bg-pulse-accent text-pulse-bg' : 'bg-pulse-surface-2 text-pulse-dim'}`}>
                                    {u}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Accent colour */}
                    <div>
                        <SectionLabel className="mb-2">Accent colour</SectionLabel>
                        <div className="flex flex-wrap gap-2.5">
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
                                        className={`h-9 w-9 cursor-pointer rounded-full border-none transition-transform ${active ? 'scale-110' : 'hover:scale-105'}`}
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

                    {/* Auto-advance rest timer */}
                    <div>
                        <SectionLabel className="mb-2">Auto-advance rest timer</SectionLabel>
                        <div className="flex items-center gap-3">
                            <button
                                role="switch"
                                aria-checked={autoAdvance}
                                aria-label="Auto-advance rest timer"
                                onClick={() => setAutoAdvance(!autoAdvance)}
                                className={`relative w-11 h-6 rounded-full shrink-0 cursor-pointer border-none transition-colors ${autoAdvance ? 'bg-pulse-accent' : 'bg-pulse-surface-2'}`}>
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-pulse-bg transition-transform ${autoAdvance ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                            <span className="font-pulse text-[0.8125rem] text-pulse-dim">
                                In guided mode, jump to the next exercise when rest ends.
                            </span>
                        </div>
                    </div>

                    {/* Routine quiz */}
                    <div>
                        <SectionLabel className="mb-2">Routine</SectionLabel>
                        <button
                            onClick={triggerOnboarding}
                            className="font-pulse text-xs text-pulse-accent bg-transparent border-none cursor-pointer underline">
                            Retake quiz
                        </button>
                    </div>

                    {/* Data, export full history as CSV */}
                    <div>
                        <SectionLabel className="mb-2">Data</SectionLabel>
                        <button
                            onClick={handleExport}
                            className="font-pulse text-sm font-medium text-pulse-dim bg-pulse-surface-2 rounded-lg py-2 px-4 cursor-pointer border-none inline-flex items-center gap-2">
                            <svg
                                className="w-4 h-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden>
                                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                            </svg>
                            Export CSV
                        </button>
                        <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-1.5">
                            Download your full logged history as a spreadsheet.
                        </p>
                    </div>
                </div>

                <div className="lg:flex-1 lg:min-w-0 rounded-2xl bg-pulse-surface p-5 flex flex-col gap-6">
                    {/* Account & security */}
                    <AccountSecuritySection />
                </div>
            </div>

            {/* Training panel */}
            <div
                id="panel-training"
                role="tabpanel"
                aria-labelledby="tab-training"
                hidden={tab !== 'training'}
                className={tab === 'training' ? 'flex flex-col gap-7' : 'hidden'}>
                <div data-testid="training-preferences-section" className="flex flex-col gap-5">
                    <div>
                        <SectionLabel className="mb-1">Training preferences</SectionLabel>
                        <p className="font-pulse text-[0.8125rem] text-pulse-dim">
                            Shape how Pulse builds your routines. Applies to plans you generate from now on.
                        </p>
                    </div>

                    {/* Training style */}
                    <div>
                        <SectionLabel className="mb-2">Training style</SectionLabel>
                        <div className="flex flex-col gap-1.5">
                            {TRAINING_STYLE_OPTIONS.map(({ key, label, desc }) => {
                                const active = (profile.training_style ?? 'balanced') === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={active}
                                        disabled={isPending}
                                        onClick={() => {
                                            if (isPending || active) return;
                                            startTransition(async () => {
                                                await updateTrainingStyle(key);
                                            });
                                        }}
                                        className={`flex items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                                            active
                                                ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent py-3'
                                                : 'bg-pulse-surface-2 ring-0 py-2.5'
                                        } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                                        <div className="flex flex-col">
                                            <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                            {active && (
                                                <span className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">{desc}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Variety */}
                    <div>
                        <SectionLabel className="mb-2">Exercise variety</SectionLabel>
                        <div className="flex flex-col gap-1.5">
                            {VARIETY_OPTIONS.map(({ key, label, desc }) => {
                                const active = (profile.variety_preference ?? 'varied') === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={active}
                                        disabled={isPending}
                                        onClick={() => {
                                            if (isPending || active) return;
                                            startTransition(async () => {
                                                await updateVarietyPreference(key);
                                            });
                                        }}
                                        className={`flex items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                                            active
                                                ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent py-3'
                                                : 'bg-pulse-surface-2 ring-0 py-2.5'
                                        } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                                        <div className="flex flex-col">
                                            <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                            {active && (
                                                <span className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">{desc}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Loading lean */}
                    <div>
                        <SectionLabel className="mb-2">Equipment preference</SectionLabel>
                        <div className="flex flex-col gap-1.5">
                            <button
                                type="button"
                                aria-pressed={profile.loading_lean == null}
                                disabled={isPending}
                                onClick={() => {
                                    if (isPending || profile.loading_lean == null) return;
                                    startTransition(async () => {
                                        await updateLoadingLean(null);
                                    });
                                }}
                                className={`flex items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                                    profile.loading_lean == null
                                        ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent py-3'
                                        : 'bg-pulse-surface-2 ring-0 py-2.5'
                                } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                                <div className="flex flex-col">
                                    <span className="font-pulse-body text-sm text-pulse-text">No preference</span>
                                    {profile.loading_lean == null && (
                                        <span className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">
                                            Pulse chooses freely from what you own.
                                        </span>
                                    )}
                                </div>
                            </button>
                            {LOADING_LEAN_OPTIONS.map(({ key, label, desc }) => {
                                const active = profile.loading_lean === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={active}
                                        disabled={isPending}
                                        onClick={() => {
                                            if (isPending || active) return;
                                            startTransition(async () => {
                                                await updateLoadingLean(key);
                                            });
                                        }}
                                        className={`flex items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                                            active
                                                ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent py-3'
                                                : 'bg-pulse-surface-2 ring-0 py-2.5'
                                        } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                                        <div className="flex flex-col">
                                            <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                            {active && (
                                                <span className="font-pulse text-[0.75rem] text-pulse-dim mt-0.5">{desc}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Equipment profiles */}
                    <div>
                        <SectionLabel className="mb-2">Equipment profiles</SectionLabel>
                        <EquipmentProfilesEditor />
                    </div>

                    {/* Movement restrictions */}
                    <div>
                        <SectionLabel className="mb-2">Movement restrictions</SectionLabel>
                        <p className="mb-3 font-pulse text-[0.8125rem] text-pulse-dim">
                            Joints to work around. Applies to routines you generate from now on. To change your
                            current plan, use the Swap option on any exercise.
                        </p>
                        <div className="flex flex-col gap-2">
                            {RESTRICTION_OPTIONS.map(({ key, label }) => {
                                const active = (profile.movement_restrictions ?? []).includes(key);
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        aria-pressed={active}
                                        disabled={isPending}
                                        onClick={() => {
                                            if (isPending) return;
                                            const current = profile.movement_restrictions ?? [];
                                            const next = active
                                                ? current.filter((r) => r !== key)
                                                : [...current, key];
                                            startTransition(async () => {
                                                await updateMovementRestrictions(next);
                                            });
                                        }}
                                        className={`flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                                            active
                                                ? 'bg-pulse-accent/10 ring-1 ring-pulse-accent'
                                                : 'bg-pulse-surface-2 ring-0'
                                        } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}>
                                        <div
                                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? 'border-pulse-accent bg-pulse-accent' : 'border-pulse-muted'}`}>
                                            {active && (
                                                <span className="text-[10px] font-bold leading-none text-pulse-bg">
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-pulse-body text-sm text-pulse-text">{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Training priority */}
                    <div>
                        <SectionLabel className="mb-2">Training priority</SectionLabel>
                        <select
                            aria-label="Training priority"
                            value={priorityValue}
                            onChange={(e) => handlePriorityChange(e.target.value as PriorityMuscle | 'balanced')}
                            disabled={isPending}
                            className={`${INPUT} capitalize`}>
                            {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>
                                    {p === 'balanced' ? 'Balanced' : p[0].toUpperCase() + p.slice(1)}
                                </option>
                            ))}
                        </select>
                        <p className="font-pulse text-[0.6875rem] text-pulse-muted mt-1.5">
                            New generated routines lean toward this muscle.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
