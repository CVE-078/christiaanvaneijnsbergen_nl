'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/pulse/utils';
import { getUserOrThrow } from '@/lib/pulse/auth';
import { assertUuid } from './_shared';
import type { Unit, LengthUnit, BodyweightEntry, Gender, PriorityMuscle } from '@/lib/pulse/types';

const PRIORITY_MUSCLE_VALUES = ['glutes', 'legs', 'chest', 'back', 'shoulders', 'arms', 'balanced'] as const;

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/pulse/login');
}

export async function updateProfile(displayName: string | null, unit: Unit, activeRoutineId?: string | null) {
    if (unit !== 'kg' && unit !== 'lbs') throw new Error('Invalid unit');
    if (displayName !== null && displayName.trim().length > 50)
        throw new Error('Display name must be 50 characters or fewer');
    if (activeRoutineId !== undefined && activeRoutineId !== null && !UUID_RE.test(activeRoutineId))
        throw new Error('Invalid routine id');

    const { supabase, user } = await getUserOrThrow();

    if (activeRoutineId !== undefined && activeRoutineId !== null) {
        const { data: routine } = await supabase
            .from('workout_routines')
            .select('id')
            .eq('id', activeRoutineId)
            .eq('user_id', user.id)
            .single();
        if (!routine) throw new Error('Routine not found');
    }

    const { error } = await supabase.from('profiles').upsert(
        {
            id: user.id,
            display_name: displayName,
            unit,
            ...(activeRoutineId !== undefined ? { active_routine_id: activeRoutineId } : {}),
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
    );
    if (error) throw new Error('Failed to update profile');
}

export async function logBodyWeight(weightKg: number, date?: string): Promise<BodyweightEntry> {
    if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg < 0.5 || weightKg > 500)
        throw new Error('Invalid weight');
    if (date !== undefined && (typeof date !== 'string' || isNaN(new Date(date).getTime())))
        throw new Error('Invalid date');

    const { supabase, user } = await getUserOrThrow();

    const logged_at = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('bodyweight_logs')
        .upsert({ user_id: user.id, logged_at, weight_kg: weightKg }, { onConflict: 'user_id,logged_at' })
        .select('id, logged_at, weight_kg')
        .single();

    if (error || !data) throw new Error('Failed to log body weight');
    return { id: data.id, logged_at: data.logged_at, weight_kg: Number(data.weight_kg) };
}

export async function updateGoalWeight(goalWeightKg: number | null): Promise<void> {
    if (goalWeightKg !== null && (!Number.isFinite(goalWeightKg) || goalWeightKg < 0.5 || goalWeightKg > 500))
        throw new Error('Invalid goal weight');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('profiles').update({ goal_weight_kg: goalWeightKg }).eq('id', user.id);
    if (error) throw new Error('Failed to update goal weight');
    revalidatePath('/pulse');
}

export async function updateLengthUnit(lengthUnit: LengthUnit): Promise<void> {
    if (lengthUnit !== 'cm' && lengthUnit !== 'in') throw new Error('Invalid length unit');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, length_unit: lengthUnit, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update length unit');
    revalidatePath('/pulse');
}

export async function updateTimezone(timezone: string): Promise<void> {
    if (typeof timezone !== 'string' || timezone.length === 0 || timezone.length > 64)
        throw new Error('Invalid timezone');
    try {
        // Throws RangeError for an unknown IANA zone.
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
        throw new Error('Invalid timezone');
    }

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, timezone, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update timezone');
}

export async function updateGender(gender: Gender | null): Promise<void> {
    if (gender !== null && gender !== 'male' && gender !== 'female') throw new Error('Invalid gender');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, gender, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update gender');
    revalidatePath('/pulse');
}

export async function updatePriorityMuscle(priority: PriorityMuscle | 'balanced' | null): Promise<void> {
    if (priority !== null && !PRIORITY_MUSCLE_VALUES.includes(priority)) throw new Error('Invalid priority muscle');

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, priority_muscle: priority, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw new Error('Failed to update priority muscle');
    revalidatePath('/pulse');
}

export async function logBodyMeasurement(data: {
    measured_at?: string;
    waist_cm?: number;
    hips_cm?: number;
    chest_cm?: number;
    arms_cm?: number;
}): Promise<void> {
    // Validate each provided measurement is a finite number in a sane range (cm).
    const measurementFields = ['waist_cm', 'hips_cm', 'chest_cm', 'arms_cm'] as const;
    for (const field of measurementFields) {
        const value = data[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 500)
            throw new Error('Invalid measurement');
    }

    if (data.measured_at !== undefined) {
        if (typeof data.measured_at !== 'string' || isNaN(new Date(data.measured_at).getTime()))
            throw new Error('Invalid date');
    }

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('body_measurements').insert({
        user_id: user.id,
        measured_at: data.measured_at ?? new Date().toISOString().split('T')[0],
        waist_cm: data.waist_cm ?? null,
        hips_cm: data.hips_cm ?? null,
        chest_cm: data.chest_cm ?? null,
        arms_cm: data.arms_cm ?? null,
    });
    if (error) throw new Error('Failed to log measurements');
    revalidatePath('/pulse');
}

export async function deleteBodyWeight(id: string) {
    assertUuid(id);

    const { supabase, user } = await getUserOrThrow();

    const { error } = await supabase.from('bodyweight_logs').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw new Error('Failed to delete entry');
}

export async function completeOnboarding(): Promise<void> {
    const { supabase, user } = await getUserOrThrow();
    await supabase.from('profiles').upsert({ id: user.id, onboarding_completed: true }, { onConflict: 'id' });
    revalidatePath('/pulse');
}
