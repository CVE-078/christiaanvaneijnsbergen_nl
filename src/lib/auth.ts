export const COOKIE_NAME = 'wt_session';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
};

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Token format: "<uuid>.<base64url-hmac>"
export async function createSession(): Promise<string> {
  const envPw = process.env.TRACKER_PASSWORD ?? '';
  const id = crypto.randomUUID();
  const key = await hmacKey(envPw);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id));
  return `${id}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  const envPw = process.env.TRACKER_PASSWORD;
  if (!token || !envPw) return false;

  const dot = token.lastIndexOf('.');
  if (dot === -1) return false;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await hmacKey(envPw);
  const expectedSig = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id)));

  if (sig.length !== expectedSig.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
