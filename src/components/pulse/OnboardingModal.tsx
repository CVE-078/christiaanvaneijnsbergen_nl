'use client';
import { useRef, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';
import TuneYourPlanPanel, { type TuneYourPlanState } from './TuneYourPlanPanel';

// First-run onboarding: collect the answers via the shared setup flow, GENERATE
// a tailored routine (no template-match step), then hand off to the "Tune your
// plan" panel so the personalization the quick flow skipped stays one tap away.
// Replaces the old recommend-a-template + clone flow.
export default function OnboardingModal() {
    const {
        generateRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        completeOnboarding,
        dismissOnboarding,
        triggerOnboarding,
        navigate,
        profile,
        equipmentProfiles,
        createEquipmentProfile,
    } = usePulse();
    const [tuning, setTuning] = useState<TuneYourPlanState | null>(null);
    // RoutineSetupFlow always calls onClose once onComplete settles (success or
    // not), but dismissing onboarding here would unmount us mid-handoff and lose
    // the freshly created routine before the Tune panel can render. Set this
    // synchronously inside onComplete so the guarded onClose below can tell a
    // successful handoff apart from a cancel / failure.
    const handingOffRef = useRef(false);

    async function finish() {
        await completeOnboarding();
        dismissOnboarding();
        navigate('train');
    }

    if (tuning)
        return (
            <TuneYourPlanPanel
                {...tuning}
                onDone={finish}
                onManageEquipment={async () => {
                    // The routine is already created; treat "Manage in Profile" as
                    // finishing onboarding and landing on the Profile screen.
                    await completeOnboarding();
                    dismissOnboarding();
                    navigate('profile');
                }}
            />
        );

    return (
        <RoutineSetupFlow
            completeLabel="Create my routine"
            mode="quick"
            equipmentProfiles={equipmentProfiles}
            activeEquipmentProfileId={profile.active_equipment_profile_id}
            onCreateEquipmentProfile={createEquipmentProfile}
            intro="Pulse adapts as you train: miss a week, hit a plateau, or train somewhere new, and your plan adjusts so you keep moving forward."
            onComplete={async ({ answers, trainingDays, sessionTime, styleKey, startAnchor, programWeeks }) => {
                // Pin the modal open through generation: creating the first routine
                // flips `routines.length` from 0, which would otherwise compute
                // showOnboarding false and unmount us before we can hand off.
                triggerOnboarding();
                // Quick mode skips gender + the personalization steps; pass undefined
                // so generateRoutine defers to the user's stored profile values (the
                // Tune panel offers to adjust them with a free in-place rebuild).
                const resolvedStyleKey = styleKey ?? recommendStyle(trainingDays.length);
                const routine = await generateRoutine(
                    answers,
                    trainingDays,
                    sessionTime,
                    resolvedStyleKey,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    startAnchor,
                );
                if (startAnchor) await setProgramAnchor(routine.id, startAnchor);
                // New routines default to 12 weeks in the DB; only write when it differs.
                if (programWeeks !== 12) await updateRoutineProgramWeeks(routine.id, programWeeks);
                handingOffRef.current = true;
                setTuning({
                    routine,
                    answers,
                    trainingDays,
                    sessionTime,
                    styleKey: resolvedStyleKey,
                    programWeeks,
                    startAnchor,
                });
            }}
            onClose={() => {
                if (!handingOffRef.current) dismissOnboarding();
            }}
        />
    );
}
