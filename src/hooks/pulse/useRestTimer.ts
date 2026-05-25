import { useState } from 'react';

export function useRestTimer() {
    const [timerTrigger, setTimerTrigger] = useState(0);

    function fireTrigger() {
        setTimerTrigger((t) => t + 1);
    }

    return { timerTrigger, fireTrigger };
}
