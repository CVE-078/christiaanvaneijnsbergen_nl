'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { validateDecisionEvent } from '@/lib/pulse/validation';
import { assertUuid, assertOwnsRoutine } from './_shared';
import type { DecisionEvent } from '@/lib/pulse/types';

// Persist one adaptive decision to the unified decision_events log. Idempotent on
// (user, routine, type, affected_area, week): re-saving sets in the same session
// re-fires this with the same key and is a no-op upsert, so the log never doubles
// up. Best-effort by design, the caller fires it without queuing because every
// decision is re-derivable from the set logs (decisionForExercise), so a dropped
// write is recoverable, not data loss. The 'Invalid'/'not found' error strings are
// load-bearing: they classify as permanent so a poison write is never retried.
export async function recordDecisionEvent(routineId: string, event: DecisionEvent): Promise<void> {
    assertUuid(routineId);
    if (!validateDecisionEvent(event)) throw new Error('Invalid decision event');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    const { error } = await supabase.from('decision_events').upsert(
        {
            user_id: user.id,
            routine_id: routineId,
            type: event.type,
            trigger: event.trigger,
            affected_area: event.affectedArea,
            week: event.week,
            magnitude: event.magnitude,
            confidence: event.confidence,
        },
        { onConflict: 'user_id,routine_id,type,affected_area,week' },
    );
    if (error) throw new Error('Failed to save decision event');
}
