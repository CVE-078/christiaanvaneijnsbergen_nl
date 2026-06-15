import type { Logs, LogEntry, DecisionEvent } from './types';

const DECISION_TYPES = ['ramp_back', 'deload', 'progression', 'swap'];
const DECISION_TRIGGERS = ['plateau', 'targets_hit', 'gap', 'manual'];

// Validate a DecisionEvent crossing the trust boundary into recordDecisionEvent.
// type/trigger are closed enums, week mirrors the log-key bounds (1–52), magnitude
// must be a flat record of finite numbers (it lands in a jsonb column), and
// confidence is null or a 0–1 score. affectedArea is any string ('' = program-wide).
export function validateDecisionEvent(value: unknown): value is DecisionEvent {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const { type, trigger, affectedArea, week, magnitude, confidence } = value as Record<string, unknown>;
    if (typeof type !== 'string' || !DECISION_TYPES.includes(type)) return false;
    if (typeof trigger !== 'string' || !DECISION_TRIGGERS.includes(trigger)) return false;
    if (typeof affectedArea !== 'string') return false;
    if (typeof week !== 'number' || !Number.isInteger(week) || week < 1 || week > 52) return false;
    if (typeof magnitude !== 'object' || magnitude === null || Array.isArray(magnitude)) return false;
    for (const v of Object.values(magnitude as Record<string, unknown>)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return false;
    }
    if (confidence !== null) {
        if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
            return false;
        }
    }
    return true;
}

// Format: "<week>-<routineExerciseId (UUID v4)>-<setIdx>"
// Weeks 1–52, set indices 0–9
const LOG_KEY_RE =
    /^([1-9]|[1-4][0-9]|5[0-2])-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9]$/i;

// Validate a single set-log entry (kg/reps/rir bounds + optional drops). Shared by
// the bulk `validateLogs` and the per-row `upsertLog` server action.
export function validateLogEntry(entry: unknown): entry is LogEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    const { kg, reps, rir, saved, drops, duration_s } = entry as Record<string, unknown>;
    // P1.3b: a timed hold (duration_s present) carries no weight x reps; it stores
    // duration in seconds and leaves kg/reps at 0. Validate the hold shape and relax
    // the kg>0 / reps>=1 rails accordingly (mirrors the conditional DB CHECK). A
    // normal set (no duration_s) keeps the full rails verbatim.
    const isHold = duration_s !== undefined && duration_s !== null;
    if (isHold) {
        if (typeof duration_s !== 'number' || !Number.isInteger(duration_s) || duration_s < 1 || duration_s > 3600)
            return false;
        if (typeof kg !== 'number' || kg < 0 || kg > 500) return false;
        if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 0 || reps > 100) return false;
        if (drops !== undefined && drops !== null) return false; // no drop sets on a hold in v1
    } else {
        if (typeof kg !== 'number' || kg <= 0 || kg > 500) return false;
        if (typeof reps !== 'number' || !Number.isInteger(reps) || reps < 1 || reps > 100) return false;
    }
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
    return true;
}

export function validateLogs(value: unknown): value is Logs {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (!LOG_KEY_RE.test(key)) return false;
        if (!validateLogEntry(entry)) return false;
    }
    return true;
}
