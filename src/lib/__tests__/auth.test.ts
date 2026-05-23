import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, createSession, verifySession } from '../auth';

describe('hashPassword', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await hashPassword('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic for the same input', async () => {
    const a = await hashPassword('my-password');
    const b = await hashPassword('my-password');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', async () => {
    const a = await hashPassword('password1');
    const b = await hashPassword('password2');
    expect(a).not.toBe(b);
  });
});

describe('createSession + verifySession', () => {
  beforeEach(() => {
    vi.stubEnv('TRACKER_PASSWORD', 'test-secret');
  });

  it('creates a token that verifies successfully', async () => {
    const token = await createSession();
    expect(typeof token).toBe('string');
    expect(token).toContain('.');
    await expect(verifySession(token)).resolves.toBe(true);
  });

  it('rejects undefined token', async () => {
    await expect(verifySession(undefined)).resolves.toBe(false);
  });

  it('rejects empty string', async () => {
    await expect(verifySession('')).resolves.toBe(false);
  });

  it('rejects a tampered token', async () => {
    const token = await createSession();
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(verifySession(tampered)).resolves.toBe(false);
  });

  it('rejects token with no dot separator', async () => {
    await expect(verifySession('notavalidtoken')).resolves.toBe(false);
  });

  it('rejects when TRACKER_PASSWORD is unset', async () => {
    vi.stubEnv('TRACKER_PASSWORD', '');
    const token = 'some.token';
    await expect(verifySession(token)).resolves.toBe(false);
  });
});
