import { useState } from 'react';

export function useRestTimer() {
    const [timerTrigger, setTimerTrigger] = useState(0);
    const [timerDuration, setTimerDuration] = useState<number | null>(null);

    function fireTrigger(durationSeconds?: number) {
        setTimerDuration(durationSeconds ?? null);
        setTimerTrigger((t) => t + 1);
    }

    return { timerTrigger, timerDuration, fireTrigger };
}
