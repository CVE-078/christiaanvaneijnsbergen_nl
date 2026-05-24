import type { Logs } from './types';

// Tightly bounded: weeks 1–12, exercise indices 0–5, set indices 0–3
const LOG_KEY_RE = /^([1-9]|1[0-2])-(?:push|pull|legs)-[0-5]-[0-3]$/;

export function validateLogs(value: unknown): value is Logs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!LOG_KEY_RE.test(key)) return false;
    if (typeof entry !== 'object' || entry === null) return false;
    const { kg, reps, rir, saved } = entry as Record<string, unknown>;
    if (typeof kg !== 'number' || kg <= 0 || kg > 500) return false;
    if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 100) return false;
    if (typeof rir !== 'number' || rir < 0 || rir > 10) return false;
    if (typeof saved !== 'boolean') return false;
  }
  return true;
}
