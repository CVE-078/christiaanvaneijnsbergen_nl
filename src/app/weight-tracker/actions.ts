'use server';
import { kv } from '@vercel/kv';
import { cookies } from 'next/headers';
import { verifySession, COOKIE_NAME } from '@/lib/auth';
import type { Logs } from '@/lib/weight-tracker/types';

export async function saveLogs(logs: Logs) {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!await verifySession(cookie)) throw new Error('Unauthorized');
  if (typeof logs !== 'object' || Array.isArray(logs)) throw new Error('Invalid data');
  if (Object.keys(logs).length > 2000) throw new Error('Data too large');
  await kv.set('ppl-logs', logs);
}
