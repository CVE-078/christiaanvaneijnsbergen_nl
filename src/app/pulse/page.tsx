import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/weight-tracker/validation';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs, Profile, BodyweightEntry } from '@/lib/weight-tracker/types';

export const revalidate = 0;

export default async function PulsePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/pulse/login');

  let logs: Logs = {};
  try {
    const { data, error } = await supabase
      .from('set_logs')
      .select('week, workout_type, ex_idx, set_idx, kg, reps, rir, saved')
      .eq('user_id', user.id);

    if (error) throw error;

    const raw: Record<string, unknown> = {};
    for (const row of data ?? []) {
      raw[`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`] = {
        kg: Number(row.kg),
        reps: row.reps,
        rir: row.rir,
        saved: row.saved,
      };
    }

    if (validateLogs(raw)) logs = raw;
  } catch {
    throw new Error('Failed to load training data. Please try again.');
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('display_name, unit')
    .eq('id', user.id)
    .single();

  const profile: Profile = {
    display_name: profileRow?.display_name ?? null,
    unit: (profileRow?.unit === 'lbs' ? 'lbs' : 'kg'),
  };

  const { data: bwRows } = await supabase
    .from('bodyweight_logs')
    .select('id, logged_at, weight_kg')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(90);

  const bodyweightLogs: BodyweightEntry[] = (bwRows ?? []).map(r => ({
    id: r.id,
    logged_at: r.logged_at,
    weight_kg: Number(r.weight_kg),
  }));

  return (
    <TrackerClient
      initialLogs={logs}
      initialProfile={profile}
      initialBodyweightLogs={bodyweightLogs}
      email={user.email ?? ''}
    />
  );
}
