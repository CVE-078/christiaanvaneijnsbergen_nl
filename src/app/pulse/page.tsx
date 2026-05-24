import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { kv } from '@vercel/kv';
import { verifySession, COOKIE_NAME } from '@/lib/auth';
import { validateLogs } from '@/lib/weight-tracker/validation';
import TrackerClient from '@/components/weight-tracker/TrackerClient';
import type { Logs } from '@/lib/weight-tracker/types';

// Always fetch fresh — private page, no caching
export const revalidate = 0;

export default async function PulsePage() {
  // Re-validate in the RSC; middleware is a first line of defence, not the only one
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!await verifySession(cookie)) redirect('/pulse/login');

  let logs: Logs = {};
  try {
    const raw = await kv.get('ppl-logs');
    // validateLogs returns false for null (no data yet) as well as malformed data
    if (validateLogs(raw)) logs = raw;
  } catch {
    throw new Error('Failed to load training data. Please try again.');
  }

  return <TrackerClient initialLogs={logs} />;
}
