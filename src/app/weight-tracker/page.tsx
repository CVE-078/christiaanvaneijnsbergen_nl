import { kv } from '@vercel/kv';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs } from '@/lib/weight-tracker/types';

export const revalidate = 0;

export default async function WeightTrackerPage() {
  const logs = await kv.get<Logs>('ppl-logs') ?? {};
  return <TrackerClient initialLogs={logs} />;
}
