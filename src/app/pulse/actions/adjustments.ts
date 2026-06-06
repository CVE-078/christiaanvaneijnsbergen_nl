'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { RAMPBACK_VOLUME_FACTOR, RAMPBACK_RIR_BONUS } from '@/lib/pulse/constants';
import { assertOwnsRoutine } from './_shared';
import type { AdjustmentKind } from '@/lib/pulse/types';

// One ramp-back decision per (routine, week). A single upsert on the
// (user_id, routine_id, effective_week) unique constraint keeps this atomic and
// idempotent — re-accepting is a no-op, and a dismissal can flip to an
// acceptance — with no delete-then-insert race or duplicate rows.
async function recordDecision(
    routineId: string,
    weekInteger: number,
    kind: AdjustmentKind,
    daysAway?: number,
): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');
    if (!Number.isInteger(weekInteger) || weekInteger < 1) throw new Error('Invalid week');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    // Both deload kinds carry the same ease prescription; only a gap-driven
    // re-entry also records how long the user was away. A dismissal carries none.
    const isDeload = kind === 'reentry_deload' || kind === 'manual_deload';
    const payload = isDeload
        ? {
              volumeFactor: RAMPBACK_VOLUME_FACTOR,
              rirBonus: RAMPBACK_RIR_BONUS,
              ...(kind === 'reentry_deload' && typeof daysAway === 'number' && Number.isFinite(daysAway)
                  ? { daysAway }
                  : {}),
          }
        : {};

    const { error } = await supabase.from('program_adjustments').upsert(
        {
            user_id: user.id,
            routine_id: routineId,
            kind,
            effective_week: weekInteger,
            payload,
        },
        { onConflict: 'user_id,routine_id,effective_week' },
    );
    if (error) throw new Error('Failed to save adjustment');

    // Mirror an applied ease into the unified decision_events log so the Coach
    // Decision Timeline reads one table. program_adjustments stays the operational
    // prescription state; this is the canonical log. Best-effort and idempotent
    // (same per-week key). A dismissal records nothing: it is the user declining
    // an action, not an engine action. Trigger distinguishes a gap-driven re-entry
    // from a user-initiated manual lighten.
    if (isDeload) {
        await supabase.from('decision_events').upsert(
            {
                user_id: user.id,
                routine_id: routineId,
                type: 'ramp_back',
                trigger: kind === 'manual_deload' ? 'manual' : 'gap',
                affected_area: '',
                week: weekInteger,
                magnitude: payload,
                confidence: null,
            },
            { onConflict: 'user_id,routine_id,type,affected_area,week' },
        );
    }
}

// Accept a ramp-back: week `weekInteger` becomes a reduced-volume re-entry week.
export async function acceptReentryDeload(routineId: string, weekInteger: number, daysAway?: number): Promise<void> {
    await recordDecision(routineId, weekInteger, 'reentry_deload', daysAway);
}

// Decline the ramp-back: resume normally, and stop suggesting it for this week.
export async function dismissReentry(routineId: string, weekInteger: number): Promise<void> {
    await recordDecision(routineId, weekInteger, 'reentry_dismissed');
}

// User-initiated "go easier this week": apply the ramp-back ease to the current
// week on demand. Unlike a re-entry it does not insert/offset the program (see
// progressionInfo) — it just lightens this one week.
export async function lightenThisWeek(routineId: string, weekInteger: number): Promise<void> {
    await recordDecision(routineId, weekInteger, 'manual_deload');
}
