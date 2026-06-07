'use client';
import { usePulse } from '@/context/PulseContext';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';

// First-run onboarding: collect the answers via the shared setup flow, then
// GENERATE a tailored routine (no template-match step). Replaces the old
// recommend-a-template + clone flow.
export default function OnboardingModal() {
    const {
        profile,
        generateRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        completeOnboarding,
        dismissOnboarding,
        navigate,
        updateGender,
    } = usePulse();
    // Only ask for gender when the profile doesn't have it yet; otherwise reuse
    // the saved value for the light program nudge.
    const hasGender = Boolean(profile.gender);
    return (
        <RoutineSetupFlow
            completeLabel="Create my routine"
            collectGender={!hasGender}
            intro="Pulse adapts as you train: miss a week, hit a plateau, or train somewhere new, and your plan adjusts so you keep moving forward."
            onComplete={async ({ answers, trainingDays, sessionTime, styleKey, gender, startAnchor, programWeeks, trainingStyle, varietyPreference }) => {
                if (gender) await updateGender(gender);
                const routine = await generateRoutine(
                    answers,
                    trainingDays,
                    sessionTime,
                    styleKey ?? recommendStyle(trainingDays.length),
                    undefined,
                    trainingStyle,
                    varietyPreference,
                );
                if (startAnchor) await setProgramAnchor(routine.id, startAnchor);
                // New routines default to 12 weeks in the DB; only write when it differs.
                if (programWeeks !== 12) await updateRoutineProgramWeeks(routine.id, programWeeks);
                await completeOnboarding();
                navigate('train');
            }}
            onClose={dismissOnboarding}
        />
    );
}
