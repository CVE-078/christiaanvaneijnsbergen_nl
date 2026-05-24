'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/weight-tracker/validation';
import type { Logs, Unit, BodyweightEntry } from '@/lib/weight-tracker/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/pulse/login');
}

export async function saveLogs(logs: unknown) {
  if (!validateLogs(logs)) throw new Error('Invalid data');
  if (Object.keys(logs).length > 2000) throw new Error('Data too large');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const validLogs = logs as Logs;
  const savedEntries = Object.entries(validLogs).filter(([, v]) => v.saved);

  // Upsert all current saved entries
  if (savedEntries.length > 0) {
    const rows = savedEntries.map(([key, val]) => {
      const [week, workout_type, ex_idx, set_idx] = key.split('-');
      return {
        user_id: user.id,
        week: Number(week),
        workout_type,
        ex_idx: Number(ex_idx),
        set_idx: Number(set_idx),
        kg: val.kg,
        reps: val.reps,
        rir: val.rir,
        saved: true,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from('set_logs')
      .upsert(rows, { onConflict: 'user_id,week,workout_type,ex_idx,set_idx' });
    if (error) throw new Error('Failed to save');
  }

  // Delete rows in DB that are no longer in the current logs (e.g. user deleted a set)
  const currentKeys = new Set(savedEntries.map(([k]) => k));
  const { data: existing } = await supabase
    .from('set_logs')
    .select('week, workout_type, ex_idx, set_idx')
    .eq('user_id', user.id);

  const toDelete = (existing ?? []).filter(
    (row: { week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
      !currentKeys.has(`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`),
  );

  if (toDelete.length > 0) {
    const keysToDelete = new Set(
      toDelete.map(
        (row: { week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
          `${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`,
      ),
    );

    const { data: rowsWithIds } = await supabase
      .from('set_logs')
      .select('id, week, workout_type, ex_idx, set_idx')
      .eq('user_id', user.id);

    const idsToDelete = (rowsWithIds ?? [])
      .filter(
        (r: { id: string; week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
          keysToDelete.has(`${r.week}-${r.workout_type}-${r.ex_idx}-${r.set_idx}`),
      )
      .map((r: { id: string }) => r.id);

    if (idsToDelete.length > 0) {
      await supabase
        .from('set_logs')
        .delete()
        .in('id', idsToDelete)
        .eq('user_id', user.id);
    }
  }

  revalidatePath('/pulse');
}

export async function updateProfile(displayName: string | null, unit: Unit) {
  if (displayName !== null && displayName.trim().length > 50)
    throw new Error('Display name must be 50 characters or fewer');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase.from('profiles').upsert(
    { id: user.id, display_name: displayName, unit, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw new Error('Failed to update profile');
}

export async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
  if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg < 0.5 || weightKg > 500)
    throw new Error('Invalid weight');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('bodyweight_logs')
    .upsert(
      { user_id: user.id, logged_at: today, weight_kg: weightKg },
      { onConflict: 'user_id,logged_at' },
    )
    .select('id, logged_at, weight_kg')
    .single();

  if (error || !data) throw new Error('Failed to log body weight');
  return { id: data.id, logged_at: data.logged_at, weight_kg: Number(data.weight_kg) };
}

export async function deleteBodyWeight(id: string) {
  if (!UUID_RE.test(id)) throw new Error('Invalid id');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('bodyweight_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error('Failed to delete entry');
}
