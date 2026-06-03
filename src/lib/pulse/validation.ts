import type { Logs } from './types';

// Format: "<week>-<routineExerciseId (UUID v4)>-<setIdx>"
// Weeks 1–52, set indices 0–9
const LOG_KEY_RE =
    /^([1-9]|[1-4][0-9]|5[0-2])-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9]$/i;

export function validateLogs(value: unknown): value is Logs {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (!LOG_KEY_RE.test(key)) return false;
        if (typeof entry !== 'object' || entry === null) return false;
        const { kg, reps, rir, saved, drops } = entry as Record<string, unknown>;
        if (typeof kg !== 'number' || kg <= 0 || kg > 500) return false;
        if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 100) return false;
        if (typeof rir !== 'number' || !Number.isInteger(rir) || rir < 0 || rir > 10) return false;
        if (typeof saved !== 'boolean') return false;
        if (drops !== undefined && drops !== null) {
            if (!Array.isArray(drops) || drops.length > 6) return false;
            for (const d of drops) {
                if (typeof d !== 'object' || d === null) return false;
                const { kg: dkg, reps: dreps } = d as Record<string, unknown>;
                if (typeof dkg !== 'number' || dkg <= 0 || dkg > 500) return false;
                if (typeof dreps !== 'number' || !Number.isInteger(dreps) || dreps < 1 || dreps > 100) return false;
            }
        }
    }
    return true;
}
