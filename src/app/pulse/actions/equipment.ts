'use server';
import { revalidatePath } from 'next/cache';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { assertUuid } from './_shared';
import { EQUIPMENT_KEYS } from '@/lib/pulse/types';
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
