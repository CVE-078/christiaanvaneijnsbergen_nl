export const COOKIE_NAME = 'wt_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
};

async function sessionHash(password: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('session:' + password),
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(): Promise<string> {
  return sessionHash(process.env.TRACKER_PASSWORD ?? '');
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  const envPw = process.env.TRACKER_PASSWORD;
  if (!token || !envPw) return false;
  const expected = await sessionHash(envPw);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
