import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, createSession, verifySession, timingSafeEqual } from '../auth';

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });
  it('returns false for strings differing by one char', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });
  it('returns false for strings of different length', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });
});

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

  it('creates a 64-char hex token that verifies successfully', async () => {
    const token = await createSession();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
    await expect(verifySession(token)).resolves.toBe(true);
  });

  it('is deterministic — same password → same token', async () => {
    const a = await createSession();
    const b = await createSession();
    expect(a).toBe(b);
  });

  it('rejects undefined token', async () => {
    await expect(verifySession(undefined)).resolves.toBe(false);
  });

  it('rejects empty string', async () => {
    await expect(verifySession('')).resolves.toBe(false);
  });

  it('rejects a tampered token', async () => {
    const token = await createSession();
    const tampered = token.slice(0, -4) + 'xxxx';
    await expect(verifySession(tampered)).resolves.toBe(false);
  });

  it('rejects when TRACKER_PASSWORD is unset', async () => {
    vi.stubEnv('TRACKER_PASSWORD', '');
    const token = 'a'.repeat(64);
    await expect(verifySession(token)).resolves.toBe(false);
  });

  it('rejects token derived from a different password', async () => {
    const token = await createSession();
    vi.stubEnv('TRACKER_PASSWORD', 'other-secret');
    await expect(verifySession(token)).resolves.toBe(false);
  });
});
