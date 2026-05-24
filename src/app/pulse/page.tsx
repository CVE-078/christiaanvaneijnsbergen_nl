import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/weight-tracker/validation';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs } from '@/lib/weight-tracker/types';

// Always fetch fresh — private page, no caching
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

    // Reconstruct flat Logs shape from relational rows
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

  return <TrackerClient initialLogs={logs} />;
}
