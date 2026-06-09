'use server';
import { revalidatePath } from 'next/cache';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { assertUuid } from './_shared';
import { EQUIPMENT_KEYS } from '@/lib/pulse/types';
import { MAX_TRAVEL_DAYS } from '@/lib/pulse/constants';
import { dayIndex } from '@/lib/pulse/dates';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';

function validName(name: string): string {
    if (typeof name !== 'string') throw new Error('Invalid data');
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 40) throw new Error('Name must be 1 to 40 characters');
    return trimmed;
}

function validEquipment(equipment: EquipmentKey[]): EquipmentKey[] {
    if (!Array.isArray(equipment) || equipment.length === 0) throw new Error('Pick at least one equipment item');
    const unique = [...new Set(equipment)];
    if (!unique.every((e) => (EQUIPMENT_KEYS as readonly string[]).includes(e))) throw new Error('Invalid equipment');
    return unique;
}

// Postgres unique-violation. The case-insensitive name index raises this when a
// name collides; convert it to the friendly message. Race-proof (no TOCTOU) and
// one fewer round trip than a pre-check.
function isUniqueViolation(error: { code?: string } | null): boolean {
    return error?.code === '23505';
}

export async function createEquipmentProfile(name: string, equipment: EquipmentKey[]): Promise<EquipmentProfile> {
    const cleanName = validName(name);
    const cleanEquipment = validEquipment(equipment);
    const { supabase, user } = await getUserOrThrow();
    const { data, error } = await supabase
        .from('equipment_profiles')
        .insert({ user_id: user.id, name: cleanName, equipment: cleanEquipment })
        .select('id, name, equipment, created_at, expires_at')
        .single();
    if (isUniqueViolation(error)) throw new Error(`You already have a profile called ${cleanName}`);
    if (error || !data) throw new Error('Failed to create equipment profile');
    revalidatePath('/pulse');
    return {
        id: data.id,
        name: data.name,
        equipment: (data.equipment ?? []) as EquipmentKey[],
        created_at: data.created_at,
        expires_at: data.expires_at ?? null,
    };
}

export async function updateEquipmentProfile(id: string, name: string, equipment: EquipmentKey[]): Promise<void> {
    assertUuid(id);
    const cleanName = validName(name);
    const cleanEquipment = validEquipment(equipment);
    const { supabase, user } = await getUserOrThrow();
    const { error } = await supabase
        .from('equipment_profiles')
        .update({ name: cleanName, equipment: cleanEquipment })
        .eq('id', id)
        .eq('user_id', user.id);
    if (isUniqueViolation(error)) throw new Error(`You already have a profile called ${cleanName}`);
    if (error) throw new Error('Failed to update equipment profile');
    revalidatePath('/pulse');
}

export async function deleteEquipmentProfile(id: string): Promise<void> {
    assertUuid(id);
    const { supabase, user } = await getUserOrThrow();
    const { error } = await supabase.from('equipment_profiles').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete equipment profile');
    revalidatePath('/pulse');
}

export async function setActiveEquipmentProfile(id: string | null): Promise<void> {
    if (id !== null) assertUuid(id);
    const { supabase, user } = await getUserOrThrow();
    // Verify ownership when setting (null clears the pointer).
    if (id !== null) {
        const { data } = await supabase
            .from('equipment_profiles')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
        if (!data) throw new Error('Equipment profile not found');
    }
    // upsert (not update) to match every sibling profile setter in this file
    // (updateTrainingStyle / updateLoadingLean / ...): the authed user always has
    // a profiles row, and onConflict keeps the call idempotent.
    const { error } = await supabase
        .from('profiles')
        .upsert(
            { id: user.id, active_equipment_profile_id: id, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
        );
    if (error) throw new Error('Failed to set active equipment profile');
    revalidatePath('/pulse');
}

// ── Travel mode (#322) ───────────────────────────────────────────────────────

// Start a temporary travel overlay on `profileId`, reverting on `expiresAt`
// (noon-UTC of the return day; see computeTravelExpiry). The default pointer
// (active_equipment_profile_id) is NOT touched, so it stays the revert target.
//
// One-overlay invariant: ideally a single per-row CASE update, but the Supabase
// JS client cannot express that, so this clears every other profile's expiry
// first and then sets the target's. The partial unique index
// (equipment_profiles_one_overlay_per_user) still guarantees only one non-null
// overlay, and at this scale concurrent starts are not a real risk. If a SQL RPC
// is added later, collapse to one CASE statement.
export async function startTravel(profileId: string, expiresAt: string): Promise<void> {
    assertUuid(profileId);
    if (typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) {
        throw new Error('Invalid travel date');
    }
    const { supabase, user } = await getUserOrThrow();
    // Validate the horizon in the user's tz calendar days.
    const { data: prof } = await supabase.from('profiles').select('timezone').eq('id', user.id).single();
    const tz = prof?.timezone ?? 'UTC';
    const today = dayIndex(new Date().toISOString(), tz);
    const target = dayIndex(expiresAt, tz);
    if (target <= today || target - today > MAX_TRAVEL_DAYS) {
        throw new Error(`Pick a return date within the next ${MAX_TRAVEL_DAYS} days`);
    }
    // Travel needs a distinct set to revert to, else it is meaningless.
    const { data: others } = await supabase
        .from('equipment_profiles')
        .select('id')
        .eq('user_id', user.id)
        .neq('id', profileId);
    if (!others || others.length === 0) {
        throw new Error('Create a home set first so travel mode can switch back');
    }
    // Clear any other overlay, then set this one (one-overlay invariant).
    const { error: clearErr } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: null })
        .eq('user_id', user.id)
        .neq('id', profileId);
    if (clearErr) throw new Error('Failed to start travel mode');
    const { data: set, error: setErr } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: expiresAt })
        .eq('id', profileId)
        .eq('user_id', user.id)
        .select('id')
        .single();
    if (setErr || !set) throw new Error('Failed to start travel mode');
    revalidatePath('/pulse');
}

// End travel now (also the post-expiry nudge dismiss). Clears the overlay to
// null on every profile the user owns; the effective set reverts to the default.
export async function endTravel(): Promise<void> {
    const { supabase, user } = await getUserOrThrow();
    const { error } = await supabase
        .from('equipment_profiles')
        .update({ expires_at: null })
        .eq('user_id', user.id)
        .not('expires_at', 'is', null);
    if (error) throw new Error('Failed to end travel mode');
    revalidatePath('/pulse');
}
