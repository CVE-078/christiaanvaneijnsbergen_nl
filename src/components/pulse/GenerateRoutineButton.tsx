'use client';
import { useState } from 'react';
import { usePulse } from '@/context/PulseContext';
import { BTN_PRIMARY } from '@/components/pulse/ui';
import { recommendStyle } from '@/lib/pulse/generation';
import RoutineSetupFlow from './RoutineSetupFlow';

// Reusable entry point: a button that opens the shared RoutineSetupFlow and
// generates a routine from the answers, then jumps to Train. Used wherever
// creating a routine should be one obvious tap (Routines tab, Plan, empty state).
export default function GenerateRoutineButton({
    className,
    label = 'Generate routine',
}: {
    className?: string;
    label?: string;
}) {
    const { generateRoutine, navigate } = usePulse();
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)} className={className ?? BTN_PRIMARY}>
                {label}
            </button>
            {open && (
                <RoutineSetupFlow
                    onComplete={async ({ answers, trainingDays, sessionTime, styleKey, gender }) => {
                        await generateRoutine(
                            answers,
                            trainingDays,
                            sessionTime,
                            styleKey ?? recommendStyle(trainingDays.length, gender),
                        );
                        navigate('train');
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
