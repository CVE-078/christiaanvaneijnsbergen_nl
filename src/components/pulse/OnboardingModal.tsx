'use client';
import { usePulse } from '@/context/PulseContext';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';

// First-run onboarding: collect the answers via the shared setup flow, then
// GENERATE a tailored routine (no template-match step). Replaces the old
// recommend-a-template + clone flow.
export default function OnboardingModal() {
    const { generateRoutine, completeOnboarding, dismissOnboarding, navigate } = usePulse();
    return (
        <RoutineSetupFlow
            completeLabel="Create my routine"
            onComplete={async ({ answers, trainingDays, sessionTime, styleKey }) => {
                await generateRoutine(
                    answers,
                    trainingDays,
                    sessionTime,
                    styleKey ?? recommendStyle(trainingDays.length),
                );
                await completeOnboarding();
                navigate('train');
            }}
            onClose={dismissOnboarding}
        />
    );
}
