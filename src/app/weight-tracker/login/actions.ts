'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { kv } from '@vercel/kv';
import { hashPassword, createSession, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth';

export async function login(formData: FormData) {
  const entered = (formData.get('password') as string) ?? '';
  const envPw = process.env.TRACKER_PASSWORD;

  if (!envPw) redirect('/weight-tracker/login?error=1');

  // Rate limiting: 5 attempts per IP per 15 minutes
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown';
  const rateLimitKey = `login_attempts:${ip}`;
  const attempts = await kv.incr(rateLimitKey);
  if (attempts === 1) await kv.expire(rateLimitKey, 900);
  if (attempts > 5) redirect('/weight-tracker/login?error=rate');

  const enteredHash = await hashPassword(entered);
  const expectedHash = await hashPassword(envPw);

  // Constant-time compare (both are 64-char hex strings)
  let diff = 0;
  for (let i = 0; i < 64; i++) {
    diff |= enteredHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  if (diff !== 0) redirect('/weight-tracker/login?error=1');

  const token = await createSession();
  (await cookies()).set(COOKIE_NAME, token, COOKIE_OPTIONS);
  redirect('/weight-tracker');
}
