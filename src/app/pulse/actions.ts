'use server';
import { kv } from '@vercel/kv';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { verifySession, COOKIE_NAME } from '@/lib/auth';
import { validateLogs } from '@/lib/weight-tracker/validation';

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
