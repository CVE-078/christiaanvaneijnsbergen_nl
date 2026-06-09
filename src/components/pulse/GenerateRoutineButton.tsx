'use client';
import { useRef, useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { BTN_PRIMARY } from '@/components/pulse/ui';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';
import TuneYourPlanPanel, { type TuneYourPlanState } from './TuneYourPlanPanel';

// Reusable entry point: a button that opens the shared RoutineSetupFlow,
// generates a routine from the answers, then hands off to the "Tune your plan"
// panel so the personalization the quick flow skipped stays one tap away.
// Used wherever creating a routine should be one obvious tap (Routines tab,
// Plan, empty state).
export default function GenerateRoutineButton({
    className,
    label = 'Generate routine',
}: {
    className?: string;
    label?: string;
}) {
    const {
        generateRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        navigate,
        profile,
        equipmentProfiles,
        createEquipmentProfile,
    } = usePulse();
    const [open, setOpen] = useState(false);
    const [tuning, setTuning] = useState<TuneYourPlanState | null>(null);
    // RoutineSetupFlow always calls onClose once onComplete settles, which would
    // otherwise close us (open = false) right as the Tune panel is handed off.
    // Set this synchronously inside onComplete so the guarded onClose below can
    // tell a successful handoff apart from a cancel / failure.
    const handingOffRef = useRef(false);

    function finish() {
        setOpen(false);
        setTuning(null);
        handingOffRef.current = false;
        navigate('train');
    }

    return (
        <>
            <button onClick={() => setOpen(true)} className={className ?? BTN_PRIMARY}>
                {label}
            </button>
            {open && tuning && <TuneYourPlanPanel {...tuning} onDone={finish} />}
            {open && !tuning && (
                <RoutineSetupFlow
                    mode="quick"
                    equipmentProfiles={equipmentProfiles}
                    activeEquipmentProfileId={profile.active_equipment_profile_id}
                    onCreateEquipmentProfile={createEquipmentProfile}
                    onComplete={async ({ answers, trainingDays, sessionTime, styleKey, startAnchor, programWeeks }) => {
                        // Quick mode skips the personalization steps; pass undefined so
                        // generateRoutine defers to the user's stored profile values.
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
                        if (!handingOffRef.current) setOpen(false);
                    }}
                />
            )}
        </>
    );
}
