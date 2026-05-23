export const COOKIE_NAME = 'wt_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
};

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySession(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.TRACKER_PASSWORD;
  if (!password || !cookieValue) return false;
  const expected = await hashPassword(password);
  if (expected.length !== cookieValue.length) return false;
  // Character-by-character comparison to resist timing attacks
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ cookieValue.charCodeAt(i);
  }
  return diff === 0;
}
