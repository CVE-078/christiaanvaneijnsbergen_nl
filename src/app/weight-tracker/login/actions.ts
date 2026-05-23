'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, COOKIE_NAME, COOKIE_OPTIONS } from '@/lib/auth';

export async function login(formData: FormData) {
  const entered = (formData.get('password') as string) ?? '';
  const envPw = process.env.TRACKER_PASSWORD;

  if (!envPw) redirect('/weight-tracker/login?error=1');

  const enteredHash = await hashPassword(entered);
  const expectedHash = await hashPassword(envPw);

  // Constant-time compare (both are 64-char hex strings)
  let diff = 0;
  for (let i = 0; i < 64; i++) {
    diff |= enteredHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  if (diff !== 0) redirect('/weight-tracker/login?error=1');

  (await cookies()).set(COOKIE_NAME, expectedHash, COOKIE_OPTIONS);
  redirect('/weight-tracker');
}
