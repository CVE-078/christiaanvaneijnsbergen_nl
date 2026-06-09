'use server';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';
import { assertOwnsRoutine } from './_shared';

// Pause a routine's program: open a new pause span. The partial unique index
// (one active pause per routine) makes this idempotent at the DB, a second pause
// while one is already active is caught as a no-op (23505), no app-level pre-check
// so there is no TOCTOU window (same pattern as the equipment-profile actions).
export async function pauseProgram(routineId: string, reason?: string | null): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    const { error } = await supabase
        .from('program_pauses')
        .insert({ user_id: user.id, routine_id: routineId, reason: reason ?? null });
    if (error && error.code !== '23505') throw new Error('Failed to pause program');
}

// Resume: close the active pause (set resumed_at = now). A no-op when none is
// active (the filtered update simply matches no row).
export async function resumeProgram(routineId: string): Promise<void> {
    if (!UUID_RE.test(routineId)) throw new Error('Invalid routine id');

    const { supabase, user } = await getUserOrThrow();
    await assertOwnsRoutine(supabase, routineId, user.id);

    const { error } = await supabase
        .from('program_pauses')
        .update({ resumed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('routine_id', routineId)
        .is('resumed_at', null);
    if (error) throw new Error('Failed to resume program');
}
