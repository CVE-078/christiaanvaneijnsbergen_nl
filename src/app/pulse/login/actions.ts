'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { kv } from '@vercel/kv';
import { hashPassword, createSession, COOKIE_NAME, COOKIE_OPTIONS, timingSafeEqual } from '@/lib/auth';

export async function login(formData: FormData) {
  const entered = (formData.get('password') as string) ?? '';
  const envPw = process.env.TRACKER_PASSWORD;
  if (!envPw) {
    // Misconfiguration — surface clearly in server logs, not to the client
    console.error('[Pulse] TRACKER_PASSWORD environment variable is not set');
    redirect('/pulse/login?error=1');
  }

  // Atomic INCR + EXPIRE via pipeline — prevents permanent lockout if the process
  // crashes between two separate Redis commands. Extract only the first IP from
  // x-forwarded-for (Vercel adds the real client IP first; full string would vary
  // across proxy hops and could be manipulated on non-Vercel deployments).
  const rawIp = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const ip = rawIp.split(',')[0].trim();
  const rateLimitKey = `login_attempts:${ip}`;
  const p = kv.pipeline();
  p.incr(rateLimitKey);
  p.expire(rateLimitKey, 900);
  const [attempts] = await p.exec();
  if (typeof attempts !== 'number') throw new Error('Rate limit check failed');
  if (attempts > 5) redirect('/pulse/login?error=rate');

  const enteredHash = await hashPassword(entered);
  const expectedHash = await hashPassword(envPw);
  if (!timingSafeEqual(enteredHash, expectedHash)) redirect('/pulse/login?error=1');

  const token = await createSession();
  (await cookies()).set(COOKIE_NAME, token, COOKIE_OPTIONS);
  redirect('/pulse');
}
