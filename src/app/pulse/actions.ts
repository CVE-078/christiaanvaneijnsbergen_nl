'use server';
import { kv } from '@vercel/kv';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { verifySession, COOKIE_NAME } from '@/lib/auth';
import type { Logs } from '@/lib/weight-tracker/types';

const LOG_KEY_RE = /^\d+-(?:push|pull|legs)-\d+-\d+$/;

function validateLogs(value: unknown): value is Logs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!LOG_KEY_RE.test(key)) return false;
    if (typeof entry !== 'object' || entry === null) return false;
    const { kg, reps, rir, saved } = entry as Record<string, unknown>;
    if (typeof kg !== 'number' || kg <= 0 || kg > 500) return false;
    if (typeof reps !== 'number' || reps < 1 || reps > 100) return false;
    if (typeof rir !== 'number' || rir < 0 || rir > 10) return false;
    if (typeof saved !== 'boolean') return false;
  }
  return true;
}

export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
  redirect('/pulse/login');
}

export async function saveLogs(logs: unknown) {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!await verifySession(cookie)) throw new Error('Unauthorized');
  if (!validateLogs(logs)) throw new Error('Invalid data');
  if (Object.keys(logs).length > 2000) throw new Error('Data too large');
  await kv.set('ppl-logs', logs);
  revalidatePath('/pulse');
}
