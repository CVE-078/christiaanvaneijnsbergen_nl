'use client';
import { usePulse } from '@/context/PulseContext';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';

// First-run onboarding: collect the answers via the shared setup flow, then
// GENERATE a tailored routine (no template-match step). Replaces the old
// recommend-a-template + clone flow.
export default function OnboardingModal() {
    const { profile, generateRoutine, completeOnboarding, dismissOnboarding, navigate, updateGender } = usePulse();
    // Only ask for gender when the profile doesn't have it yet; otherwise reuse
    // the saved value for the light program nudge.
    const hasGender = Boolean(profile.gender);
    return (
        <RoutineSetupFlow
            completeLabel="Create my routine"
            collectGender={!hasGender}
            onComplete={async ({ answers, trainingDays, sessionTime, styleKey, gender }) => {
                const effectiveGender = gender ?? profile.gender;
                if (gender) await updateGender(gender);
                await generateRoutine(
                    answers,
                    trainingDays,
                    sessionTime,
                    styleKey ?? recommendStyle(trainingDays.length, effectiveGender),
                );
                await completeOnboarding();
                navigate('train');
            }}
            onClose={dismissOnboarding}
        />
    );
}
