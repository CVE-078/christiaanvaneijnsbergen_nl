export const COOKIE_NAME = 'wt_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30,
  // Scoped to the tracker only — no need to send on portfolio routes
  path: '/pulse',
};

// Runs the full XOR loop regardless of length to avoid an early-exit timing oracle.
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // non-zero when lengths differ
  for (let i = 0; i < len; i++) {
    // charCodeAt returns NaN for out-of-range indices; NaN | 0 === 0 in JS bitwise ops
    diff |= (a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0);
  }
  return diff === 0;
}

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
  return timingSafeEqual(token, expected);
}

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
