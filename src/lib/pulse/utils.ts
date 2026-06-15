import { buildProgram } from './data';
import { dayIndex } from './dates';
import { secondarySets, PATTERN_MUSCLE_MAP } from './muscleMap';
import {
    BARBELL_KG,
    DUMBBELL_HANDLE_KG,
    PLATES_KG,
    WORKOUT_TYPE_ORDER,
    workoutTypeLabelLong,
    DELOAD_FACTOR,
    DELOAD_REBUILD_WEEKS,
    DELOAD_DROP_THRESHOLD,
    ENDED_NUDGE_DAYS,
} from './constants';
import type {
    Phase,
    BlockArcWeek,
    Logs,
    HistorySession,
    LogEntry,
    Unit,
    LengthUnit,
    PriorityMuscle,
    RoutineExercise,
    WorkoutType,
    WorkoutVariant,
    ScheduleEntry,
    TabKey,
    BestSet,
    WorkoutSession,
    PRMap,
    ShareStats,
    ExerciseCategory,
    MovementPattern,
    VolumeTargetRow,
    RecoveryStatus,
    RecoveryDetail,
    ExerciseItem,
    LastSession,
    Notes,
    DbExercise,
    SwapReason,
    Swaps,
    Trend,
    RecompReadout,
    BodyweightEntry,
    BodyMeasurement,
    DecisionEvent,
    DecisionEventRow,
    SessionSummary,
    EquipmentKey,
    EquipmentProfile,
    AdherenceStatus,
    ProgramPosition,
    SessionTargetRow,
    RecompTrend,
    PrescriptionUnit,
} from './types';

// UUID v4 pattern used in new log keys
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Human-readable label for a movement pattern, e.g. 'horizontal_push' →
// 'Horizontal push', 'chest_iso' → 'Chest isolation'.
function patternLabel(pattern: MovementPattern): string {
    const spaced = pattern.replace('_iso', ' isolation').replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// A plain-language "why this exercise" caption derived purely from the exercise's
// already-loaded metadata (no extra query, no stored reason): the movement pattern,
// whether it is a compound or isolation lift, and the one or two muscles it credits
// most via the PATTERN_MUSCLE_MAP bridge. Returns null when the pattern is unknown
// (e.g. a user-created exercise without metadata), so callers can omit the caption.
// Example: 'Horizontal push · compound · chest, triceps'.
export function exerciseReason(ex: {
    movement_pattern?: MovementPattern | null;
    is_compound?: boolean;
}): string | null {
    const pattern = ex.movement_pattern;
    if (!pattern || !PATTERN_MUSCLE_MAP[pattern]) return null;
    const role = ex.is_compound ? 'compound' : 'isolation';
    const muscles = (Object.entries(PATTERN_MUSCLE_MAP[pattern]) as [ExerciseCategory, number][])
        .filter(([, weight]) => weight >= 0.2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([cat]) => cat);
    return `${patternLabel(pattern)} · ${role} · ${muscles.join(', ')}`;
}

// Equipment-profile generation helpers (Branch B). The engine is unchanged;
// these only decide which saved set seeds / matches the equipment picker.

// Stable key for an equipment set: sorted, comma-joined. Two selections are the
// same kit iff their keys match (order-independent).
export function equipmentKey(equipment: Iterable<EquipmentKey>): string {
    return [...equipment].sort().join(',');
}

// The id of the saved profile whose equipment exactly matches `equipment`, or
// null when none match. Drives the "Filled from your X profile" hint + chip
// highlight, and gates the flow's "Save as profile" affordance.
export function matchingProfileId(profiles: EquipmentProfile[], equipment: Iterable<EquipmentKey>): string | null {
    const key = equipmentKey(equipment);
    return profiles.find((p) => equipmentKey(p.equipment) === key)?.id ?? null;
}

// Which saved set pre-fills the generation equipment step. Travel-aware: an
// active travel overlay wins; otherwise the legacy rule (active profile, else
// the most-recently-created since the loader returns created_at desc, so
// profiles[0], else empty). When nowIso/tz are omitted (legacy 2-arg callers
// and tests) overlay resolution is skipped, so the result is byte-identical to
// before. REGRESSION GUARD: an active overlay must win here even if generation
// later resolves equipment inline (see travel.test.ts). Pure; the
// snapshot-on-open guarantee lives at the call site (a useState initializer).
export function resolveEquipmentPrefill(
    profiles: EquipmentProfile[],
    activeId: string | null,
    nowIso?: string,
    tz?: string,
): EquipmentKey[] {
    if (nowIso && tz) {
        const overlay = activeTravelProfile(profiles, nowIso, tz);
        if (overlay) return overlay.equipment;
    }
    if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        if (active) return active.equipment;
    }
    return profiles[0]?.equipment ?? [];
}

// ── Travel mode (#322): a temporary equipment overlay that auto-reverts ──────
// Read-time expiry, no background job. A profile is "in travel" while its
// expires_at is a FUTURE calendar day in the user's tz; equality (the return
// day itself) is inactive, so you are back on your default gear that day.

export function isTravelActive(p: EquipmentProfile, nowIso: string, tz: string): boolean {
    return p.expires_at != null && dayIndex(nowIso, tz) < dayIndex(p.expires_at, tz);
}

// The active overlay. The DB partial unique index allows only one; if two ever
// coexist, prefer the latest expiry (most remaining) deterministically.
export function activeTravelProfile(profiles: EquipmentProfile[], nowIso: string, tz: string): EquipmentProfile | null {
    return (
        profiles
            .filter((p) => isTravelActive(p, nowIso, tz))
            // Descending by expiry (ISO strings sort lexicographically), so the
            // one with the most time remaining wins.
            .sort((a, b) => b.expires_at!.localeCompare(a.expires_at!))[0] ?? null
    );
}

// The revert target: the active/default profile when it is not itself the
// overlay, else the most-recent non-overlay (loader order = created_at desc, so
// the first non-overlay), else null.
export function defaultProfile(
    profiles: EquipmentProfile[],
    activeId: string | null,
    nowIso: string,
    tz: string,
): EquipmentProfile | null {
    if (activeId) {
        const active = profiles.find((p) => p.id === activeId);
        if (active && !isTravelActive(active, nowIso, tz)) return active;
    }
    return profiles.find((p) => !isTravelActive(p, nowIso, tz)) ?? null;
}

export function travelDaysLeft(p: EquipmentProfile, nowIso: string, tz: string): number {
    return p.expires_at == null ? 0 : dayIndex(p.expires_at, tz) - dayIndex(nowIso, tz);
}

// The local calendar date (YYYY-MM-DD in tz) the overlay reverts on.
export function travelReturnDate(p: EquipmentProfile, tz: string): string {
    if (p.expires_at == null) return '';
    const fmt = (zone: string) =>
        new Intl.DateTimeFormat('en-CA', {
            timeZone: zone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date(p.expires_at!));
    try {
        return fmt(tz);
    } catch {
        return fmt('UTC');
    }
}

// True for a recently-expired overlay (drives the post-expiry "regenerate?"
// nudge): 0 means it expired today, the upper bound hides a stale nudge.
export function travelEndedRecently(p: EquipmentProfile, nowIso: string, tz: string): boolean {
    if (p.expires_at == null) return false;
    const past = dayIndex(nowIso, tz) - dayIndex(p.expires_at, tz);
    return past >= 0 && past < ENDED_NUDGE_DAYS;
}

// Noon-UTC of (today + days) in tz. Noon is offset/DST-safe (it maps to the
// same calendar date for the user's tz), so the stored instant's tz calendar
// day is exactly the intended return day. Used by both the presets and a custom
// date (a custom date passes its own day count).
export function computeTravelExpiry(nowIso: string, tz: string, days: number): string {
    return new Date((dayIndex(nowIso, tz) + days) * 86400000 + 12 * 3600000).toISOString();
}

// Strip the optional `:variant` suffix off a TabKey to get its base workout type.
export function baseWorkoutType(key: TabKey): WorkoutType {
    return (key.includes(':') ? key.split(':')[0] : key) as WorkoutType;
}

// Order TabKeys for tab rendering: by base workout_type order, then A before B
// (so 'push:A' precedes 'push:B'). Single source for WorkoutTabs and the
// provider's activeTab clamp so they never disagree on the first tab.
export function compareTabKeys(a: TabKey, b: TabKey): number {
    const orderA = WORKOUT_TYPE_ORDER.indexOf(baseWorkoutType(a));
    const orderB = WORKOUT_TYPE_ORDER.indexOf(baseWorkoutType(b));
    if (orderA !== orderB) return orderA - orderB;
    return a < b ? -1 : 1;
}

export function orderTabKeys(keys: TabKey[]): TabKey[] {
    return [...keys].sort(compareTabKeys);
}

// Roll a granular workout type up toward its broadest parent. Full-body routines
// schedule a single `full_body` session but tag their exercises push/pull/legs, so
// those must collapse to `full_body`; upper/lower and PPL splits already match the
// session they belong to. Used to group the routine editor by real sessions.
const WORKOUT_TYPE_PARENT: Partial<Record<WorkoutType, WorkoutType>> = {
    chest: 'push',
    shoulders: 'push',
    arms: 'upper',
    back: 'pull',
    push: 'upper',
    pull: 'upper',
    legs: 'lower',
    upper: 'full_body',
    lower: 'full_body',
};

// Map an exercise's workout type to the session type the routine actually uses,
// walking up the parent chain until it hits one of `sessionTypes`. Falls back to
// the exercise's own type when the routine has no schedule to anchor sessions.
export function sessionTypeFor(type: WorkoutType, sessionTypes: WorkoutType[]): WorkoutType {
    if (sessionTypes.length === 0) return type;
    let cur: WorkoutType | undefined = type;
    const seen = new Set<WorkoutType>();
    while (cur && !seen.has(cur)) {
        if (sessionTypes.includes(cur)) return cur;
        seen.add(cur);
        cur = WORKOUT_TYPE_PARENT[cur];
    }
    return sessionTypes[0];
}

// Descriptive focus label for a session, resolved from the routine schedule's
// per-session `label` (set at generation for the quad/posterior lower-day
// split). Matches by (workout_type, variant); a missing variant matches a null
// variant. Returns null when no schedule row carries a label, so callers fall
// back to the compact type+variant label. See focusLabelForEmphasis.
export function sessionFocusLabel(
    schedule: ScheduleEntry[],
    type: WorkoutType,
    variant: WorkoutVariant | null,
): string | null {
    const entry = schedule.find((s) => s.workout_type === type && (s.variant ?? null) === (variant ?? null));
    return entry?.label ?? null;
}

export const MIN_KG = 0.5;
export const MAX_KG = 500;
export const KG_TO_LBS = 2.20462;
export const CM_TO_IN = 1 / 2.54;

export function toDisplay(kg: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round(kg * KG_TO_LBS * 10) / 10;
    return kg;
}

export function toKg(value: number, unit: Unit): number {
    if (unit === 'lbs') return Math.round((value / KG_TO_LBS) * 100) / 100;
    return value;
}

// Length conversion, mirroring toDisplay/toKg for weight. Measurements are
// stored canonically in cm; these convert for display ('in') and back to cm on
// input. A 'cm' unit is the identity so existing data needs no migration.
export function toLengthDisplay(cm: number, unit: LengthUnit): number {
    if (unit === 'in') return Math.round(cm * CM_TO_IN * 10) / 10;
    return cm;
}

export function toCm(value: number, unit: LengthUnit): number {
    if (unit === 'in') return Math.round((value / CM_TO_IN) * 100) / 100;
    return value;
}

// Parse a user-entered numeric string, accepting both '.' and ',' as the decimal
// separator. European keyboards/locales produce "2,5", which bare parseFloat
// truncates to 2 and silently corrupts the logged weight; we normalize the comma
// first. Returns NaN for empty/invalid input.
export function parseDecimalInput(s: string): number {
    if (typeof s !== 'string') return NaN;
    const normalized = s.trim().replace(',', '.');
    if (normalized === '') return NaN;
    return parseFloat(normalized);
}

export function getInitials(name: string, max = 3): string {
    return name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map((w) => w[0].toUpperCase())
        .join('');
}

// Map an absolute week into its 1-based position within a repeating block of
// `weeks` length: week 13 in a 12-week block → week 1 of block 2.
export function weekInBlock(week: number, weeks: number): number {
    return ((((week - 1) % weeks) + weeks) % weeks) + 1;
}

// Phase for a week, given the block length (default 12 = legacy behavior). Weeks
// beyond the block length wrap, since the program repeats.
export function getPhase(week: number, weeks = 12): Phase {
    const { phases } = buildProgram(weeks);
    const w = weekInBlock(week, weeks);
    return phases.find((p) => p.weeks.includes(w)) ?? phases[0];
}

export function getRIR(week: number, weeks = 12): number {
    const w = weekInBlock(week, weeks);
    const phase = getPhase(week, weeks);
    const idx = phase.weeks.indexOf(w);
    return idx !== -1 ? phase.rir[idx] : phase.rir[0];
}

// Planned working-set volume for a week within a (repeating) block.
export function volumeForWeek(week: number, weeks = 12): number {
    const { volume } = buildProgram(weeks);
    const w = weekInBlock(week, weeks);
    return volume.find((v) => v.week === w)?.sets ?? volume[0]?.sets ?? 0;
}

// Assemble one full block for the Plan block-arc view: per week, the planned
// volume + target RIR + phase, and whether it is a deload (the lowest-volume
// week(s) in the block, so a mid-block deload like the 16-week's week 8 is also
// flagged). Pure; nothing persisted. The week range comes from the block's own
// volume table, so an 8/10/12/16-week block yields exactly that many entries.
export function buildBlockArc(weeks: number): BlockArcWeek[] {
    const { volume } = buildProgram(weeks);
    const minVol = Math.min(...volume.map((v) => v.sets));
    return volume.map((v) => ({
        week: v.week,
        volume: v.sets,
        rir: getRIR(v.week, weeks),
        phase: getPhase(v.week, weeks),
        isDeload: v.sets === minVol,
    }));
}

// A rep range whose lower bound is <= 5 reps is "heavy" (a strength range like
// "3-6"): it rests longer and needs warm-up ramp sets. Moderate ranges (6-10,
// 8-12, ...) do not. Used only by the duration estimate.
function isHeavyRange(reps?: string | null): boolean {
    if (!reps) return false;
    const m = reps.match(/\d+/);
    return m ? Number(m[0]) <= 5 : false;
}

// Rough estimate of how long a planned session takes, in minutes (P1.4b). Per
// working set: a fixed work estimate plus rest. Refinements over the naive model:
//   - intensity: a HEAVY compound (strength rep range) rests longer than a
//     moderate one, which rests longer than isolation.
//   - warm-ups: a heavy compound adds ramp-up time once (you build up to a heavy
//     working weight); moderate/light work is ramped quickly and absorbed by the
//     per-set estimate, so no separate warm-up is billed (this also keeps a 30-min
//     superset session inside its band).
//   - supersets: a set whose exercise is paired (supersetGroupId set) shares rest
//     with its antagonist, so its rest is halved.
// Rounded to the nearest 5 so it reads as the estimate it is ("~50 min"), never
// false precision. Constants are defensible defaults to be tuned against logged
// session durations, not researched values.
export function estimateSessionMinutes(
    rows: Array<{ sets: number; is_compound?: boolean; reps?: string | null; supersetGroupId?: string | null }>,
): number {
    const WORK_PER_SET_S = 40;
    const REST_ISO_S = 75;
    const REST_COMPOUND_S = 150;
    const REST_HEAVY_COMPOUND_S = 210;
    const WARMUP_PER_HEAVY_COMPOUND_S = 120;
    const SUPERSET_REST_FACTOR = 0.5;
    let seconds = 0;
    for (const r of rows) {
        const sets = Math.max(0, Math.floor(r.sets ?? 0));
        if (sets === 0) continue;
        const heavy = r.is_compound === true && isHeavyRange(r.reps);
        let rest = r.is_compound ? (heavy ? REST_HEAVY_COMPOUND_S : REST_COMPOUND_S) : REST_ISO_S;
        if (r.supersetGroupId) rest = Math.round(rest * SUPERSET_REST_FACTOR);
        seconds += sets * (WORK_PER_SET_S + rest);
        if (heavy) seconds += WARMUP_PER_HEAVY_COMPOUND_S;
    }
    return Math.max(0, Math.round(seconds / 60 / 5) * 5);
}

// Format a session prescription for display (P1.3). The generator stores a numeric
// rep range in routine_exercises.reps for every exercise (so the rep-based logger
// keeps working); this turns that into the right label given the exercise's
// `prescription_unit`:
//   - 'time'     -> a hold from the catalogue (`hold`, e.g. "30-60s"), so an
//                   isometric like Plank reads "30-60s hold", never a rep count.
//   - 'per_side' -> "<reps> reps/side" for unilateral work.
//   - 'reps' / unset -> "<reps> reps" (the existing behaviour).
const DEFAULT_HOLD = '30-60s';
export function formatPrescription(
    reps: string,
    unit: PrescriptionUnit | null | undefined,
    hold?: string | null,
    opts?: { compact?: boolean },
): string {
    const compact = opts?.compact ?? false;
    const h = typeof hold === 'string' && hold.trim() ? hold : DEFAULT_HOLD;
    if (unit === 'time') return compact ? h : `${h} hold`;
    if (unit === 'per_side') return compact ? `${reps}/side` : `${reps} reps/side`;
    return compact ? reps : `${reps} reps`;
}

// A lift is plateaued when its best e1RM has not improved across the last
// `recentWeeks` logged weeks (no new high vs everything before them). Takes the
// e1RM history (from computeE1RMHistory) to stay decoupled and pure. Needs more
// than `recentWeeks` of history before it can call a stall.
export function computePlateau(history: Array<{ week: number; e1rm: number }>, recentWeeks = 3): boolean {
    if (history.length < recentWeeks + 1) return false;
    const sorted = [...history].sort((a, b) => a.week - b.week);
    const recent = sorted.slice(-recentWeeks);
    const prior = sorted.slice(0, -recentWeeks);
    const priorBest = Math.max(...prior.map((h) => h.e1rm));
    const recentBest = Math.max(...recent.map((h) => h.e1rm));
    return recentBest <= priorBest;
}

// True when a recent consecutive e1RM drop indicates the lift was just deloaded
// (and is now rebuilding), so we should not deload it again yet. Looks at the
// last `withinWeeks + 1` logged points (= `withinWeeks` consecutive pairs); a
// drop of at least (1 - DELOAD_DROP_THRESHOLD) between two points counts.
export function recentDrop(
    history: Array<{ week: number; e1rm: number }>,
    withinWeeks = DELOAD_REBUILD_WEEKS,
): boolean {
    const tail = [...history].sort((a, b) => a.week - b.week).slice(-(withinWeeks + 1));
    for (let i = 1; i < tail.length; i++) {
        if (tail[i].e1rm < tail[i - 1].e1rm * DELOAD_DROP_THRESHOLD) return true;
    }
    return false;
}

// A stalled lift should auto-deload only when it has plateaued AND has not just
// deloaded (so it deloads once, then rebuilds for ~DELOAD_REBUILD_WEEKS weeks).
export function shouldDeload(history: Array<{ week: number; e1rm: number }>): boolean {
    return computePlateau(history) && !recentDrop(history);
}

// The deloaded target for a stalled lift's set: DELOAD_FACTOR of the previous
// weight (rounded to the 2.5 grid the progression uses, floored at MIN_KG), with
// reps reset to the bottom of the rep range. Null when there is no prior set.
export function deloadTarget(
    previousEntry: LogEntry | undefined,
    repsRange: string,
): { kg: number; reps: number } | null {
    if (!previousEntry) return null;
    const nums = (repsRange.match(/\d+/g) ?? []).map(Number);
    const reps = nums.length ? nums[0] : previousEntry.reps;
    const kg = Math.max(MIN_KG, Math.round((previousEntry.kg * DELOAD_FACTOR) / 2.5) * 2.5);
    return { kg, reps };
}

export type LiftTrend = 'progressing' | 'stalled' | 'deload';

// The engine's read on a lift's e1RM trajectory, for the Progress chart readout.
// Mirrors the Train card's stall/deload classification (computePlateau /
// shouldDeload) exactly, so the chart annotation matches what logging a set
// would say: a clean plateau suggests a deload, a plateau while rebuilding from
// a recent drop reads "stalled", anything climbing reads "progressing". Returns
// null when there is not enough history to call it (a new or flat-but-short
// lift). Callers gate this on !bodyweight, since a bodyweight lift's e1RM is 0
// by construction and would false-flag as stalled.
export function liftTrend(history: Array<{ week: number; e1rm: number }>): LiftTrend | null {
    if (shouldDeload(history)) return 'deload';
    if (computePlateau(history)) return 'stalled';
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.week - b.week);
    return sorted[sorted.length - 1].e1rm > sorted[0].e1rm ? 'progressing' : null;
}

// The adaptive decision the engine made for one lift in one week, ready to log
// as a DecisionEvent, or null when no tracked decision applies. Pure mirror of
// what ExerciseCard/SetLogger already compute on render: a stall auto-deloads
// (deload wins, matching `deloadTgt ?? progression`), otherwise hitting the
// prescribed RIR advances the lift (double progression). A set logged *harder*
// than planned backs the weight off but is autoregulation, not a tracked
// decision, so it returns null. Inputs are passed in (e1RM history, the prior
// week's set) to keep this decoupled and unit-testable.
export function decisionForExercise(args: {
    routineExerciseId: string;
    week: number;
    e1rmHistory: Array<{ week: number; e1rm: number }>;
    previousEntry: LogEntry | undefined;
    repsRange: string;
}): DecisionEvent | null {
    const { routineExerciseId, week, e1rmHistory, previousEntry, repsRange } = args;
    if (!previousEntry || week <= 1) return null;

    if (shouldDeload(e1rmHistory)) {
        const tgt = deloadTarget(previousEntry, repsRange);
        if (tgt) {
            return {
                type: 'deload',
                trigger: 'plateau',
                affectedArea: routineExerciseId,
                week,
                magnitude: { fromKg: previousEntry.kg, toKg: tgt.kg },
                confidence: null,
            };
        }
    }

    // Progression fires only when the prior set met or beat its prescribed RIR
    // (the same condition that separates an advance from a back-off inside
    // computeProgression). Otherwise the engine is reducing load, not progressing.
    if (previousEntry.rir >= getRIR(week - 1)) {
        const prog = computeProgression(previousEntry, repsRange, week);
        if (prog) {
            return {
                type: 'progression',
                trigger: 'targets_hit',
                affectedArea: routineExerciseId,
                week,
                magnitude: {
                    fromKg: previousEntry.kg,
                    toKg: prog.kg,
                    fromReps: previousEntry.reps,
                    toReps: prog.reps,
                },
                confidence: null,
            };
        }
    }

    return null;
}

export function logKey(week: number, routineExerciseId: string, setIdx: number): string {
    return `${week}-${routineExerciseId}-${setIdx}`;
}

// Key for the per-(week, slot) exercise swap map. Mirrors the Notes keying.
export function swapKey(week: number, routineExerciseId: string): string {
    return `${week}-${routineExerciseId}`;
}

// Candidate replacements for a swap: same movement pattern, excluding the
// original and any excluded ids (hidden + already in this session). Sorted by
// equipment overlap with the original (desc), then name. Exercises with no
// movement pattern are dropped.
export function swapCandidates(
    original: DbExercise,
    exercises: DbExercise[],
    opts: { excludeIds: Set<string> },
): DbExercise[] {
    const pattern = original.movement_pattern;
    if (!pattern) return [];
    const origEquip = new Set(original.equipment ?? []);
    const overlap = (e: DbExercise) => (e.equipment ?? []).filter((x) => origEquip.has(x)).length;
    return exercises
        .filter((e) => e.id !== original.id && !opts.excludeIds.has(e.id) && e.movement_pattern === pattern)
        .sort((a, b) => {
            const d = overlap(b) - overlap(a);
            return d !== 0 ? d : a.name.localeCompare(b.name);
        });
}

// Reason-aware re-rank of swap candidates (Smart substitution v2, #8). Assumes
// `candidates` are ALREADY same-pattern-filtered (e.g. by swapCandidates); this
// only reorders, it does not filter. A tiered total order so same-stimulus always
// wins, then the reason term, then name:
//   1. same substitution_class as the original (only when the original has one) --
//      a same-stimulus candidate can never be out-ranked by a different one, so no
//      reason floats a worse substitute to the top.
//   2. reason: preference (none) = equipment overlap desc (closest like-for-like);
//      no_equipment/crowded = overlap asc (prefer gear you can skip);
//      pain = contraindication-flag count asc (the catalog's gentlest option).
//   3. name asc -- deterministic, owned here (not reliant on input order).
export function rankSubstitutes(original: DbExercise, candidates: DbExercise[], reason?: SwapReason): DbExercise[] {
    const origClass = original.substitution_class ?? null;
    const origEquip = new Set(original.equipment ?? []);
    const overlap = (e: DbExercise) => (e.equipment ?? []).filter((x) => origEquip.has(x)).length;
    const flags = (e: DbExercise) => (e.contraindications ?? []).length;
    return [...candidates].sort((a, b) => {
        if (origClass) {
            const aC = a.substitution_class === origClass ? 0 : 1;
            const bC = b.substitution_class === origClass ? 0 : 1;
            if (aC !== bC) return aC - bC;
        }
        if (reason === 'no_equipment' || reason === 'crowded') {
            if (overlap(a) !== overlap(b)) return overlap(a) - overlap(b);
        } else if (reason === 'pain') {
            if (flags(a) !== flags(b)) return flags(a) - flags(b);
        } else {
            if (overlap(a) !== overlap(b)) return overlap(b) - overlap(a);
        }
        return a.name.localeCompare(b.name);
    });
}

// Resolve the exercise a slot displays for a given week. A week-scoped swap
// overrides the slot's default exercise; falls back to the original if no swap
// exists or the substitute is gone (deleted/hidden).
export function resolveExercise(
    re: RoutineExercise,
    week: number,
    swaps: Swaps,
    exercisesById: Map<string, DbExercise>,
): DbExercise {
    const subId = swaps[swapKey(week, re.id)];
    if (!subId) return re.exercise;
    return exercisesById.get(subId) ?? re.exercise;
}

// Parse a log key of the form "<week>-<routineExerciseId>-<setIdx>".
// week is the number before the first '-', routineExerciseId is the slice
// between the first and last '-', setIdx is the number after the last '-'.
// Returns null when the structure is wrong, the middle is not a valid UUID,
// or either numeric segment is NaN.
export function parseLogKey(key: string): { week: number; routineExerciseId: string; setIdx: number } | null {
    const firstDash = key.indexOf('-');
    const lastDash = key.lastIndexOf('-');
    if (firstDash === -1 || lastDash === firstDash) return null;
    const routineExerciseId = key.slice(firstDash + 1, lastDash);
    if (!UUID_RE.test(routineExerciseId)) return null;
    const week = Number(key.slice(0, firstDash));
    const setIdx = Number(key.slice(lastDash + 1));
    if (isNaN(week) || isNaN(setIdx)) return null;
    return { week, routineExerciseId, setIdx };
}

export function parseMaxSets(s: string): number {
    const n = parseInt(s.split(/[–-]/).pop() ?? s, 10);
    return isNaN(n) ? 3 : n;
}

export function calcE1RM(kg: number, reps: number): number {
    return kg * (1 + reps / 30);
}

// A bodyweight exercise carries no equipment (empty/absent equipment array), so
// weight is optional when logging and progression is rep-based. Single source of
// truth for the "is this bodyweight?" rule used by SetLogger and the train cards.
export function isBodyweight(equipment: string[] | null | undefined): boolean {
    return (equipment?.length ?? 0) === 0;
}

// A plate-loaded exercise takes a barbell, so the plate calculator applies. Gates
// the calc off dumbbell / cable / machine / bodyweight lifts (where it made no
// sense and leaked onto things like a dumbbell Chest Fly).
export function isPlateLoaded(equipment: string[] | null | undefined): boolean {
    return (equipment ?? []).includes('barbell');
}

// P1.3b: a logged set is a timed isometric hold (Plank etc.) rather than a
// weight x reps set. Holds carry no e1RM / tonnage / PR, so every weight-based
// aggregate skips them via this guard.
export function isTimedEntry(val: { duration_s?: number | null } | null | undefined): boolean {
    return val?.duration_s != null;
}

export function computePRMap(logs: Logs): Record<string, number> {
    const map: Record<string, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        // New format: "<week>-<uuid>-<setIdx>"
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { routineExerciseId } = parsed;
        const e = calcE1RM(val.kg, val.reps);
        if (e > (map[routineExerciseId] ?? 0)) map[routineExerciseId] = e;
    }
    return map;
}

export function computeStreak(logs: Logs): number {
    const loggedWeeks = new Set(
        Object.entries(logs)
            .filter(([, v]) => v?.saved)
            .map(([k]) => parseInt(k.split('-')[0], 10))
            .filter((w) => !isNaN(w)),
    );
    if (loggedWeeks.size === 0) return 0;
    const maxWeek = Math.max(...loggedWeeks);
    let streak = 0;
    for (let w = maxWeek; w >= 1; w--) {
        if (loggedWeeks.has(w)) streak++;
        else break;
    }
    return streak;
}

export function computeSuggestion(previousEntry: LogEntry | undefined, week: number): number | null {
    if (!previousEntry || week <= 1) return null;
    const prevTargetRIR = getRIR(week - 1);
    if (previousEntry.rir > prevTargetRIR) return previousEntry.kg + 2.5;
    if (previousEntry.rir === prevTargetRIR) return previousEntry.kg;
    return Math.max(previousEntry.kg - 2.5, MIN_KG);
}

// Double progression: climb reps inside the rep range first, then add weight and
// reset to the bottom of the range. Compares the current set to the same set's
// previous session (previousEntry). Returns the next target { kg, reps }, or null
// when there is no history to progress from (week 1 / no previous entry).
//   - Harder than planned (rir < targetRIR)      -> deload weight, reps = lo
//   - Met/beat and at the top of the range        -> +2.5 kg, reps = lo
//   - Met/beat and mid-range                       -> same kg, reps + 1 (capped at hi)
// A single-number rep target (lo === hi) reduces to linear weight progression.
export function computeProgression(
    previousEntry: LogEntry | undefined,
    repsRange: string,
    week: number,
    bodyweight = false,
): { kg: number; reps: number } | null {
    if (!previousEntry || week <= 1) return null;
    const targetRIR = getRIR(week - 1);
    const nums = (repsRange.match(/\d+/g) ?? []).map(Number);
    const lo = nums.length ? nums[0] : previousEntry.reps;
    const hi = nums.length ? nums[nums.length - 1] : previousEntry.reps;
    // Bodyweight progression is rep-based: there is no external load to add, so
    // keep whatever was used (0 for pure bodyweight, or any added load) and aim
    // for one more rep. A set harder than target eases back to the range bottom.
    if (bodyweight) {
        if (previousEntry.rir < targetRIR) return { kg: previousEntry.kg, reps: lo };
        return { kg: previousEntry.kg, reps: previousEntry.reps + 1 };
    }
    if (previousEntry.rir < targetRIR) {
        return { kg: Math.max(previousEntry.kg - 2.5, MIN_KG), reps: lo };
    }
    if (previousEntry.reps >= hi) {
        return { kg: previousEntry.kg + 2.5, reps: lo };
    }
    return { kg: previousEntry.kg, reps: Math.min(previousEntry.reps + 1, hi) };
}

// Read-only preview of the working weight the Train screen will prefill for each
// exercise in a session: computeSuggestion off the prior week's top set, falling
// back to the routine's starting weight. Mirrors ExerciseCard's workingWeightKg
// exactly, so the Plan preview never drifts from what you see when you train.
export function computeSessionTargets(exercises: RoutineExercise[], logs: Logs, week: number): SessionTargetRow[] {
    return exercises.map((re) => {
        const prevEntry = week > 1 ? logs[logKey(week - 1, re.id, 0)] : undefined;
        const weightKg =
            computeSuggestion(prevEntry?.saved ? prevEntry : undefined, week) ?? re.starting_weight_kg ?? null;
        return {
            routineExerciseId: re.id,
            name: re.exercise?.name ?? '',
            sets: re.sets,
            reps: re.reps,
            prescription: formatPrescription(re.reps, re.exercise?.prescription_unit, re.exercise?.default_reps, {
                compact: true,
            }),
            bodyweight: isBodyweight(re.exercise?.equipment),
            weightKg,
        };
    });
}

export function weekHasData(week: number, logs: Logs): boolean {
    const prefix = `${week}-`;
    return Object.keys(logs).some((k) => k.startsWith(prefix) && logs[k]?.saved);
}

// One pass over logs returning the set of weeks that have at least one saved set.
// Lets the 12-week strips do O(1) `.has(week)` lookups instead of scanning all
// logs once per week (which `weekHasData` does per call).
export function computeWeeksWithData(logs: Logs): Set<number> {
    const set = new Set<number>();
    for (const key of Object.keys(logs)) {
        if (!logs[key]?.saved) continue;
        const firstDash = key.indexOf('-');
        if (firstDash === -1) continue;
        const week = Number(key.slice(0, firstDash));
        if (!isNaN(week)) set.add(week);
    }
    return set;
}

export function buildHistory(logs: Logs): HistorySession[] {
    const sessions: Record<string, HistorySession> = {};

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        // New format: "<week>-<routineExerciseId>-<setIdx>"
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId, setIdx } = parsed;
        // Group by week only, type is no longer encoded in the key
        const sessionKey = String(week);
        if (!sessions[sessionKey]) {
            sessions[sessionKey] = { week, sets: [] };
        }
        sessions[sessionKey].sets.push({ routineExerciseId, setIdx, ...val });
    }

    return Object.values(sessions).sort((a, b) => b.week - a.week);
}

export function computeVolumeByTypeAndWeek(
    logs: Logs,
    routineExercises: RoutineExercise[],
): Record<number, Partial<Record<WorkoutType, number>>> {
    const typeMap = new Map<string, WorkoutType>(routineExercises.map((re) => [re.id, re.workout_type]));
    const result: Record<number, Partial<Record<WorkoutType, number>>> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId } = parsed;
        const wt = typeMap.get(routineExerciseId);
        if (!wt) continue;
        if (!result[week]) result[week] = {};
        result[week][wt] = (result[week][wt] ?? 0) + 1;
    }
    return result;
}

export function computeE1RMHistory(logs: Logs, routineExerciseId: string): Array<{ week: number; e1rm: number }> {
    const weekBest: Record<number, number> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        if (parsed.routineExerciseId !== routineExerciseId) continue;
        const { week } = parsed;
        const e1rm = calcE1RM(val.kg, val.reps);
        if (e1rm > (weekBest[week] ?? 0)) weekBest[week] = e1rm;
    }
    return Object.entries(weekBest)
        .map(([w, e1rm]) => ({ week: Number(w), e1rm }))
        .sort((a, b) => a.week - b.week);
}

export function computeBestSets(logs: Logs): Record<string, BestSet> {
    const best: Record<string, BestSet> = {};
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId } = parsed;
        const e1rm = calcE1RM(val.kg, val.reps);
        if (!best[routineExerciseId] || e1rm > best[routineExerciseId].e1rm) {
            best[routineExerciseId] = {
                routineExerciseId,
                week,
                kg: val.kg,
                reps: val.reps,
                e1rm,
            };
        }
    }
    return best;
}

export function computeWarmupSets(
    workingWeightKg: number,
    unit: Unit,
): Array<{ percent: number; displayWeight: number; reps: number }> {
    if (workingWeightKg < 40) return [];
    return [
        { percent: 50, reps: 5 },
        { percent: 65, reps: 3 },
        { percent: 80, reps: 1 },
    ].map(({ percent, reps }) => {
        const roundedKg = Math.round((workingWeightKg * percent) / 100 / 2.5) * 2.5;
        const display = toDisplay(roundedKg, unit);
        const displayWeight = unit === 'lbs' ? Math.round(display / 5) * 5 : display;
        return { percent, displayWeight, reps };
    });
}

export function computeLastSession(
    logs: Logs,
    routineExerciseId: string,
    currentWeek: number,
): { kg: number; reps: number; setCount: number } | null {
    const byWeek = new Map<number, Array<{ kg: number; reps: number }>>();

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId: rid } = parsed;
        if (week >= currentWeek) continue;
        if (rid !== routineExerciseId) continue;
        if (!byWeek.has(week)) byWeek.set(week, []);
        byWeek.get(week)!.push({ kg: val.kg, reps: val.reps });
    }

    if (byWeek.size === 0) return null;
    const latestWeek = Math.max(...byWeek.keys());
    const sets = byWeek.get(latestWeek)!;
    return { kg: sets[0].kg, reps: sets[0].reps, setCount: sets.length };
}

// Last-session lookup for every exercise in a single pass, so a screen with N
// exercise cards builds them all in O(logs) instead of each card scanning the
// whole log set (O(logs) per card). Mirrors computeLastSession per exercise.
export function computeLastSessionMap(logs: Logs, currentWeek: number): Map<string, LastSession> {
    const byRidWeek = new Map<string, Map<number, Array<{ kg: number; reps: number }>>>();
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week, routineExerciseId: rid } = parsed;
        if (week >= currentWeek) continue;
        let weeks = byRidWeek.get(rid);
        if (!weeks) {
            weeks = new Map();
            byRidWeek.set(rid, weeks);
        }
        if (!weeks.has(week)) weeks.set(week, []);
        weeks.get(week)!.push({ kg: val.kg, reps: val.reps });
    }

    const result = new Map<string, LastSession>();
    for (const [rid, weeks] of byRidWeek) {
        const latestWeek = Math.max(...weeks.keys());
        const sets = weeks.get(latestWeek)!;
        result.set(rid, { kg: sets[0].kg, reps: sets[0].reps, setCount: sets.length });
    }
    return result;
}

// ── Exercise history at logging time (#13) ───────────────────────────────────
// A consolidated "what did I do here last time" read for one exercise, composing
// the existing pure functions (computeLastSession / computeBestSets /
// computeE1RMHistory) plus the previous note. Pure; surfaced at the point of
// logging (ExerciseCard / guided mode). All kg are storage units; the UI converts
// via toDisplay. (Per-card cost is O(logs), the same order the card already pays
// for computeE1RMHistory; a batched variant can follow if a screen needs many.)
export interface ExerciseHistory {
    /** Most recent prior session: top set + how many sets. Null if never logged before. */
    lastSession: LastSession | null;
    /** All-time best set for this exercise by estimated 1RM. Null if never logged. */
    best: { kg: number; reps: number; e1rm: number } | null;
    /** Direction of the last two logged weeks' best e1RM. 'none' below two weeks. */
    trend: Trend;
    /** Percent change in best e1RM between the last two logged weeks, or null. */
    e1rmDeltaPct: number | null;
    /** The most recent prior week's note for this exercise, or null. */
    previousNote: string | null;
}

export function computeExerciseHistory(
    logs: Logs,
    routineExerciseId: string,
    currentWeek: number,
    notes: Notes = {},
): ExerciseHistory {
    const lastSession = computeLastSession(logs, routineExerciseId, currentWeek);
    const bestSet = computeBestSets(logs)[routineExerciseId] ?? null;
    const best = bestSet ? { kg: bestSet.kg, reps: bestSet.reps, e1rm: bestSet.e1rm } : null;

    // Retrospective trend: prior weeks only, so it reads "how the last two sessions
    // before now moved", consistent with lastSession / previousNote and never pulled
    // by the current week's in-progress sets.
    const history = computeE1RMHistory(logs, routineExerciseId).filter((h) => h.week < currentWeek);
    let trend: Trend = 'none';
    let e1rmDeltaPct: number | null = null;
    if (history.length >= 2) {
        const prev = history[history.length - 2].e1rm;
        const last = history[history.length - 1].e1rm;
        if (prev > 0) e1rmDeltaPct = ((last - prev) / prev) * 100;
        trend = last > prev ? 'up' : last < prev ? 'down' : 'flat';
    }

    // Most recent prior week's note for this exercise. Notes are keyed
    // `${week}-${routineExerciseId}` where the id is a UUID (contains dashes), so
    // split on the FIRST dash only (week is a plain number).
    let previousNote: string | null = null;
    let bestNoteWeek = -1;
    for (const [key, text] of Object.entries(notes)) {
        if (!text) continue;
        const dash = key.indexOf('-');
        if (dash < 0) continue;
        const week = Number(key.slice(0, dash));
        if (!Number.isFinite(week) || week >= currentWeek || week <= bestNoteWeek) continue;
        if (key.slice(dash + 1) !== routineExerciseId) continue;
        bestNoteWeek = week;
        previousNote = text;
    }

    return { lastSession, best, trend, e1rmDeltaPct, previousNote };
}

export function computeShareStats(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
): ShareStats {
    const startMs = new Date(session.started_at).getTime();
    const endMs = new Date(completedAt).getTime();
    const diff = endMs - startMs;
    const durationMin = isNaN(diff) || diff < 0 ? 0 : Math.floor(diff / 60000);

    const baseLabel = workoutTypeLabelLong(session.workout_type as WorkoutType);
    const workoutLabel = session.variant ? `${baseLabel} · Variant ${session.variant}` : baseLabel;

    const date = new Date(completedAt).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    const exerciseIds = new Set(exercises.map((e) => e.id));
    const nameMap = new Map(exercises.map((e) => [e.id, e.exercise.name]));
    const bestByExercise = new Map<string, { kg: number; reps: number; e1rm: number }>();
    let totalSets = 0;

    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const { week: w, routineExerciseId: rid } = parsed;
        if (w !== week) continue;
        if (!exerciseIds.has(rid)) continue;
        totalSets++;
        const e1rm = calcE1RM(val.kg, val.reps);
        const existing = bestByExercise.get(rid);
        if (!existing || e1rm > existing.e1rm) {
            bestByExercise.set(rid, { kg: val.kg, reps: val.reps, e1rm });
        }
    }

    const allLifts = [...bestByExercise.entries()]
        .sort(([, a], [, b]) => b.e1rm - a.e1rm)
        .map(([rid, { kg, reps, e1rm }]) => {
            const isPR = (prMap[rid] ?? 0) > 0 && e1rm >= prMap[rid];
            return {
                name: nameMap.get(rid) ?? rid,
                displayWeight: toDisplay(kg, unit),
                reps,
                isPR,
            };
        });

    return {
        workoutLabel,
        date,
        durationMin,
        totalSets,
        topLifts: allLifts.slice(0, 3),
        prCount: allLifts.filter((l) => l.isPR).length,
    };
}

// Total external load for a session: kg*reps over every saved set (incl. drop
// sets) of the session's exercises in the given week, returned in the display
// unit. Pure-bodyweight sets (kg 0) contribute their added load only.
export function computeSessionTonnage(exercises: RoutineExercise[], logs: Logs, week: number, unit: Unit): number {
    const ids = new Set(exercises.map((e) => e.id));
    let kg = 0;
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        if (isTimedEntry(val)) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        if (!ids.has(parsed.routineExerciseId)) continue;
        kg += val.kg * val.reps;
        if (val.drops) for (const d of val.drops) kg += d.kg * d.reps;
    }
    return toDisplay(kg, unit);
}

// Mirrors the PR check inside computeShareStats: a set is a PR when its
// estimated 1RM meets or beats the recorded best for the exercise.
export function isSetPR(kg: number, reps: number, routineExerciseId: string, prMap: PRMap): boolean {
    if (kg <= 0 || reps <= 0) return false;
    const best = prMap[routineExerciseId] ?? 0;
    if (best <= 0) return false;
    return calcE1RM(kg, reps) >= best;
}

// Fractional-set per-muscle accumulation for one week, shared by the volume and
// recovery readouts so they apply the SAME attribution. Each saved set credits its
// exercise's category 1.0 (the primary), then, when the exercise has a movement
// pattern, the pattern's bucketed secondaries (muscleMap.secondarySets) on top, so
// a bench press also credits triceps/shoulders. RIR is credited at full weight to
// every touched category with a per-category count, so avgRir stays a true RIR
// average rather than a fractional one. Exercises with no movement_pattern (user-
// created, or an unseeded row) fall back to primary-only.
export function accumulatePerMuscle(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): {
    volume: Partial<Record<ExerciseCategory, number>>;
    rirSum: Partial<Record<ExerciseCategory, number>>;
    rirCount: Partial<Record<ExerciseCategory, number>>;
} {
    const catById = new Map<string, ExerciseCategory>();
    const patternById = new Map<string, MovementPattern>();
    for (const re of routineExercises) {
        if (re.exercise?.category) catById.set(re.id, re.exercise.category);
        if (re.exercise?.movement_pattern) patternById.set(re.id, re.exercise.movement_pattern);
    }
    const volume: Partial<Record<ExerciseCategory, number>> = {};
    const rirSum: Partial<Record<ExerciseCategory, number>> = {};
    const rirCount: Partial<Record<ExerciseCategory, number>> = {};
    const credit = (cat: ExerciseCategory, sets: number, rir: number) => {
        volume[cat] = (volume[cat] ?? 0) + sets;
        rirSum[cat] = (rirSum[cat] ?? 0) + rir;
        rirCount[cat] = (rirCount[cat] ?? 0) + 1;
    };
    for (const [key, val] of Object.entries(logs)) {
        if (!val.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed || parsed.week !== week) continue;
        const cat = catById.get(parsed.routineExerciseId);
        if (!cat) continue;
        credit(cat, 1, val.rir);
        const pattern = patternById.get(parsed.routineExerciseId);
        if (pattern) {
            for (const [secCat, frac] of Object.entries(secondarySets(pattern, cat)) as [ExerciseCategory, number][]) {
                credit(secCat, frac, val.rir);
            }
        }
    }
    return { volume, rirSum, rirCount };
}

// Fractional working sets per exercise category for a single week (primary 1.0 plus
// bucketed pattern secondaries). Values are non-integer.
export function computePerMuscleVolume(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
): Partial<Record<ExerciseCategory, number>> {
    return accumulatePerMuscle(logs, routineExercises, week).volume;
}

// Display rounding for fractional set counts: nearest 0.5. Shared by the volume
// bars and recovery chips so the same muscle never reads two different values.
export function roundSets(n: number): number {
    return Math.round(n * 2) / 2;
}

// The exercise categories a muscle priority bumps. 'arms' covers biceps + triceps.
const PRIORITY_TARGET_CATEGORIES: Record<PriorityMuscle, ExerciseCategory[]> = {
    glutes: ['glutes'],
    legs: ['legs'],
    chest: ['chest'],
    back: ['back'],
    shoulders: ['shoulders'],
    arms: ['biceps', 'triceps'],
};

const PRIORITY_TARGET_BUMP = 2;

// Raise the weekly set target band for the prioritized muscle so the Progress
// recovery/volume nudges stay coherent with a routine generated under that
// priority. Identity for a null priority; only bumps categories already in the
// base targets.
export function priorityAdjustedTargets(
    base: Partial<Record<ExerciseCategory, [number, number]>>,
    priority: PriorityMuscle | null,
): Partial<Record<ExerciseCategory, [number, number]>> {
    if (!priority) return base;
    const out: Partial<Record<ExerciseCategory, [number, number]>> = { ...base };
    for (const cat of PRIORITY_TARGET_CATEGORIES[priority]) {
        const range = base[cat];
        if (range) out[cat] = [range[0] + PRIORITY_TARGET_BUMP, range[1] + PRIORITY_TARGET_BUMP];
    }
    return out;
}

// One-line plain-language explanation of the priority-muscle volume tilt, shown
// next to the per-muscle volume bars. Null when there is no tilt (no priority /
// balanced), so the caller renders nothing. Takes the already-resolved priority
// (use resolvePriority on the raw profile value first).
export function priorityFocusLine(priority: PriorityMuscle | null): string | null {
    if (!priority) return null;
    const label = priority.charAt(0).toUpperCase() + priority.slice(1);
    return `${label} volume raised, your training priority.`;
}

// Per-muscle progress toward weekly set targets. Rows cover every targeted
// muscle (even at 0 sets); toGo is the sets still needed to reach the floor.
// Sorted lagging-first (highest toGo), then alphabetically for stability.
export function computeVolumeProgress(
    volume: Partial<Record<ExerciseCategory, number>>,
    targets: Partial<Record<ExerciseCategory, [number, number]>>,
): VolumeTargetRow[] {
    const rows: VolumeTargetRow[] = [];
    for (const [category, range] of Object.entries(targets) as Array<[ExerciseCategory, [number, number]]>) {
        const [min, max] = range;
        const actual = volume[category] ?? 0;
        rows.push({ category, actual, min, max, toGo: Math.max(0, min - actual) });
    }
    rows.sort((a, b) => b.toGo - a.toGo || a.category.localeCompare(b.category));
    return rows;
}

// Pairs weekly per-muscle volume with RIR to flag recovery status per targeted
// muscle. Resolves each set's category exactly like computePerMuscleVolume
// (re.exercise.category keyed by re.id), in one pass over the week's saved sets.
// Returns a status for every category present in `targets`, so it aligns 1:1
// with the rows computeVolumeProgress renders. Pure and deterministic.
export function computeRecoveryFlags(
    logs: Logs,
    routineExercises: RoutineExercise[],
    week: number,
    targets: Partial<Record<ExerciseCategory, [number, number]>>,
): Partial<Record<ExerciseCategory, RecoveryDetail>> {
    const { volume, rirSum, rirCount } = accumulatePerMuscle(logs, routineExercises, week);
    const out: Partial<Record<ExerciseCategory, RecoveryDetail>> = {};
    for (const [category, range] of Object.entries(targets) as Array<[ExerciseCategory, [number, number]]>) {
        const [min, max] = range;
        const count = volume[category] ?? 0;
        const rc = rirCount[category] ?? 0;
        const avgRir = rc > 0 ? (rirSum[category] ?? 0) / rc : null;
        let status: RecoveryStatus;
        if (count < min) {
            status = 'under';
        } else if (count > max) {
            status = 'overreaching';
        } else {
            status = avgRir !== null && avgRir <= 0.5 ? 'high_fatigue' : 'optimal';
        }
        out[category] = { status, sets: count, avgRir, min, max, toGo: Math.max(0, min - count) };
    }
    return out;
}

export type PlateEquipment = 'barbell' | 'dumbbell';
export interface PlateResult {
    perSide: number[];
    achievable: boolean;
    remainderKg: number;
}

// Greedy per-side plate breakdown for a target weight on a barbell or a single
// dumbbell handle. achievable is false when the target sits below the empty
// bar/handle or leaves a remainder the available plates cannot fill.
export function computePlates(targetKg: number, equipment: PlateEquipment): PlateResult {
    const base = equipment === 'barbell' ? BARBELL_KG : DUMBBELL_HANDLE_KG;
    if (targetKg < base) return { perSide: [], achievable: false, remainderKg: 0 };
    let perSideKg = (targetKg - base) / 2;
    const perSide: number[] = [];
    for (const plate of PLATES_KG) {
        while (perSideKg >= plate - 1e-9) {
            perSide.push(plate);
            perSideKg = Math.round((perSideKg - plate) * 100) / 100;
        }
    }
    const remainderKg = Math.round(perSideKg * 100) / 100;
    return { perSide, achievable: remainderKg === 0, remainderKg };
}

// Overall strength proxy per week = sum of best E1RM across all slots that week.
export function computeStrengthByWeek(logs: Logs): Array<{ week: number; total: number }> {
    const bestPerSlotPerWeek = new Map<string, number>(); // `${week}|${reId}` -> best e1rm
    for (const [key, val] of Object.entries(logs)) {
        if (!val?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        const k = `${parsed.week}|${parsed.routineExerciseId}`;
        const e = calcE1RM(val.kg, val.reps);
        if (e > (bestPerSlotPerWeek.get(k) ?? 0)) bestPerSlotPerWeek.set(k, e);
    }
    const totals = new Map<number, number>();
    for (const [k, e] of bestPerSlotPerWeek) {
        const week = Number(k.split('|')[0]);
        totals.set(week, (totals.get(week) ?? 0) + e);
    }
    return [...totals.entries()].map(([week, total]) => ({ week, total })).sort((a, b) => a.week - b.week);
}

function trendOf(delta: number, band: number): Trend {
    if (delta < -band) return 'down';
    if (delta > band) return 'up';
    return 'flat';
}

// Combine bodyweight, waist, and overall-strength trends into a recomp readout.
// Compares the latest value to the earliest in each series (chronological).
export function computeRecompSignal(args: {
    bodyweight: BodyweightEntry[];
    measurements: BodyMeasurement[];
    strengthByWeek: Array<{ week: number; total: number }>;
}): RecompReadout {
    const bw = [...args.bodyweight].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
    const waistPts = args.measurements
        .filter((m) => m.waist_cm != null)
        .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    const str = [...args.strengthByWeek].filter((s) => s.total > 0).sort((a, b) => a.week - b.week);

    let weight: Trend = 'none',
        weightDeltaKg: number | null = null;
    if (bw.length >= 2) {
        weightDeltaKg = bw[bw.length - 1].weight_kg - bw[0].weight_kg;
        weight = trendOf(weightDeltaKg, 0.5);
    }

    let waist: Trend = 'none',
        waistDeltaCm: number | null = null;
    if (waistPts.length >= 2) {
        waistDeltaCm = (waistPts[waistPts.length - 1].waist_cm as number) - (waistPts[0].waist_cm as number);
        waist = trendOf(waistDeltaCm, 0.5);
    }

    let strength: Trend = 'none',
        strengthDeltaPct: number | null = null;
    if (str.length >= 2 && str[0].total > 0) {
        strengthDeltaPct = ((str[str.length - 1].total - str[0].total) / str[0].total) * 100;
        strength = trendOf(strengthDeltaPct, 2);
    }

    const weightOk = weight === 'flat' || weight === 'down';
    const isRecomping = strength === 'up' && weightOk && waist === 'down';

    let verdict: string;
    if (weight === 'none' && strength === 'none' && waist === 'none') {
        verdict = 'Keep logging to see your recomp trend.';
    } else if (isRecomping) {
        verdict = "You're recomping, gaining strength while losing fat.";
    } else if (strength === 'up' && weightOk && waist === 'none') {
        verdict = 'Likely recomping, strength up and weight steady. Log your waist to confirm.';
    } else if (strength === 'up' && weight === 'up') {
        verdict = 'Gaining: strength up but weight up too. Tighten nutrition if fat loss is the goal.';
    } else if ((strength === 'flat' || strength === 'down') && weight === 'down') {
        verdict = 'Cutting: weight down but strength flat. Keep the weights heavy to hold strength.';
    } else if (strength === 'down' && weight === 'up') {
        verdict = 'Strength dipping while weight rises. Check recovery before adding load.';
    } else {
        verdict = 'Keep logging to see your recomp trend.';
    }

    return { weight, strength, waist, isRecomping, verdict, weightDeltaKg, strengthDeltaPct, waistDeltaCm };
}

export type RecompStatusTone = 'good' | 'neutral' | 'warn';

// A short status word + tone for the recomp verdict pill, derived from the same
// trend signals computeRecompSignal reads for its verdict sentence (kept in step
// with those branches). Null when there is not enough data to call it, so the
// pill simply does not render. `Recomping` covers the confirmed and the
// likely-recomping (no waist yet) cases, matching the verdict copy.
export function recompStatus(readout: RecompReadout): { word: string; tone: RecompStatusTone } | null {
    const { weight, strength, waist, isRecomping } = readout;
    if (weight === 'none' && strength === 'none' && waist === 'none') return null;
    const weightOk = weight === 'flat' || weight === 'down';
    if (isRecomping || (strength === 'up' && weightOk)) return { word: 'Recomping', tone: 'good' };
    if (strength === 'up' && weight === 'up') return { word: 'Gaining', tone: 'neutral' };
    if ((strength === 'flat' || strength === 'down') && weight === 'down') return { word: 'Cutting', tone: 'neutral' };
    if (strength === 'down' && weight === 'up') return { word: 'Watch', tone: 'warn' };
    return null;
}

// The verdict sentence with its leading clause stripped when that clause merely
// restates the status pill word (so "Recomping" pill + "You're recomping, gaining
// strength..." reads just "Gaining strength..."). Left untouched when the lead
// carries real information the pill does not (e.g. the Watch verdict opens with
// "Strength dipping...", which must stay). Display-only, pairs with recompStatus.
export function recompDetail(verdict: string, statusWord: string | null | undefined): string {
    if (!statusWord) return verdict;
    const m = verdict.match(/^(.*?)[,:]\s+(.*)$/);
    if (m && m[1].toLowerCase().includes(statusWord.toLowerCase())) {
        return m[2].charAt(0).toUpperCase() + m[2].slice(1);
    }
    return verdict;
}

// Splits the (pill-trimmed) recomp verdict into a headline, the interpretation,
// and a secondary description, the coaching next-step. Most verdicts already
// carry both as two sentences; the clean recomping verdict is a single sentence,
// so a next-step is supplied for it. Display-only, pairs with recompStatus.
export function recompLines(readout: RecompReadout): { headline: string; description: string | null } {
    const status = recompStatus(readout);
    const detail = recompDetail(readout.verdict, status?.word);
    const idx = detail.indexOf('. ');
    if (idx !== -1) return { headline: detail.slice(0, idx + 1), description: detail.slice(idx + 2) };
    if (status?.word === 'Recomping') {
        // Best-case state: an affirmation, not a next-step (the engine deliberately
        // hands no instruction when everything is on track). User-authored copy.
        return { headline: detail, description: "This is the hardest result to get, and you're getting it." };
    }
    return { headline: detail, description: null };
}

// Two aligned trend series for the Body-tab recomp chart: bodyweight and strength
// score over the window, each chronological and on its own scale, plus their
// first->last deltas. Pure shaping of already-computed inputs; the recomp verdict
// stays in computeRecompSignal. Bodyweight arrives newest-first (queries.ts orders
// logged_at desc), so it is sorted ascending here.
export function computeRecompTrend(args: {
    bodyweight: BodyweightEntry[];
    strengthSeries: Array<{ week: number; score: number }>;
}): RecompTrend {
    const weight = [...args.bodyweight].sort((a, b) => a.logged_at.localeCompare(b.logged_at)).map((e) => e.weight_kg);
    const strength = [...args.strengthSeries].sort((a, b) => a.week - b.week).map((p) => p.score);
    const delta = (xs: number[]) => (xs.length >= 2 ? xs[xs.length - 1] - xs[0] : null);
    return { weight, strength, weightDeltaKg: delta(weight), strengthDelta: delta(strength) };
}

// Adaptive-engine events attributable to this session: same program week, and
// either targeting one of the session's exercises or program-wide (ramp-back,
// affectedArea ''). Decisions are stored per routine+week+exercise, not by
// session id, so week + exercise membership is the correct attribution.
export function sessionDecisions(
    decisions: DecisionEventRow[],
    week: number,
    exerciseIds: Set<string>,
): { progressions: DecisionEventRow[]; deloads: DecisionEventRow[]; rampBack: DecisionEventRow[] } {
    const inScope = decisions.filter(
        (dec) => dec.week === week && (dec.affectedArea === '' || exerciseIds.has(dec.affectedArea)),
    );
    return {
        progressions: inScope.filter((dec) => dec.type === 'progression'),
        deloads: inScope.filter((dec) => dec.type === 'deload'),
        rampBack: inScope.filter((dec) => dec.type === 'ramp_back'),
    };
}

// Deterministic, rule-based coach read for the debrief (no LLM). Ordered rules:
// ramp-back > wins (PRs/progressions, with a deload clause) > deload-only > steady.
export function composeCoachRead(input: {
    prCount: number;
    progressionCount: number;
    deloadCount: number;
    rampBack: boolean;
}): string {
    const { prCount, progressionCount, deloadCount, rampBack } = input;
    if (rampBack) {
        return 'Easier ramp-back session by design, welcome back. Keep it controlled and rebuild from here.';
    }
    const wins: string[] = [];
    if (prCount > 0) wins.push(prCount === 1 ? 'set a new PR' : `set ${prCount} new PRs`);
    if (progressionCount > 0) {
        wins.push(`progressed ${progressionCount} ${progressionCount === 1 ? 'lift' : 'lifts'}`);
    }
    const deloadClause =
        deloadCount > 0
            ? `, ${deloadCount === 1 ? 'one lift' : `${deloadCount} lifts`} backed off on purpose to reset`
            : '';
    if (wins.length > 0) {
        return `Strong session. You ${wins.join(' and ')}${deloadClause}.`;
    }
    if (deloadCount > 0) {
        return `Smart session. ${deloadCount === 1 ? 'One lift' : `${deloadCount} lifts`} backed off on purpose to break a stall, exactly the right call.`;
    }
    return 'Steady session, right on plan. Nothing needed adjusting, hold the line and keep showing up.';
}

// One composite the debrief screen consumes: the share stats plus session
// tonnage, top muscles worked, bucketed adaptive decisions, and a coach read.
export function computeSessionSummary(
    session: WorkoutSession,
    completedAt: string,
    exercises: RoutineExercise[],
    logs: Logs,
    prMap: PRMap,
    week: number,
    unit: Unit,
    decisions: DecisionEventRow[],
): SessionSummary {
    const stats = computeShareStats(session, completedAt, exercises, logs, prMap, week, unit);
    const tonnage = computeSessionTonnage(exercises, logs, week, unit);
    const volume = computePerMuscleVolume(logs, exercises, week);
    const muscles = (Object.entries(volume) as [ExerciseCategory, number][])
        .map(([category, sets]) => ({ category, sets: roundSets(sets) }))
        .filter((m) => m.sets > 0)
        .sort((a, b) => b.sets - a.sets)
        .slice(0, 4);
    const ids = new Set(exercises.map((e) => e.id));
    const decisionBuckets = sessionDecisions(decisions, week, ids);
    const coachRead = composeCoachRead({
        prCount: stats.prCount,
        progressionCount: decisionBuckets.progressions.length,
        deloadCount: decisionBuckets.deloads.length,
        rampBack: decisionBuckets.rampBack.length > 0,
    });
    return { ...stats, tonnage, muscles, decisions: decisionBuckets, coachRead };
}

export function groupExercises(exercises: RoutineExercise[]): ExerciseItem[] {
    const items: ExerciseItem[] = [];
    let i = 0;
    while (i < exercises.length) {
        const re = exercises[i];
        if (
            re.superset_group_id !== null &&
            i + 1 < exercises.length &&
            exercises[i + 1].superset_group_id === re.superset_group_id
        ) {
            items.push([re, exercises[i + 1]]);
            i += 2;
        } else {
            items.push(re);
            i++;
        }
    }
    return items;
}

// A single-word (or short phrase) summary of the recovery state for the metric
// strip. Counts muscles whose status is not 'optimal'; 0 => 'Fresh'.
export function recoverySummaryWord(
    recovery: Partial<Record<ExerciseCategory, Pick<RecoveryDetail, 'status'>>>,
): string {
    const n = Object.values(recovery).filter((d) => d && d.status !== 'optimal').length;
    if (n === 0) return 'Fresh';
    return `${n} flag${n > 1 ? 's' : ''}`;
}

export type RecoveryTone = 'fresh' | 'ready' | 'watch' | 'easeoff' | 'none';

export interface RecoveryReadout {
    tone: RecoveryTone;
    word: string;
    detail: string; // render-ready sub-line (muscles already capped)
    muscles: ExerciseCategory[]; // raw categories driving an amber/red state
}

// Compact recovery readout for the Overview tile. Worst meaningful state wins:
// overreaching (ease off) > high_fatigue (watch) > all optimal (fresh) >
// otherwise (some under, none fatigued = ready, room to train). The dot color
// (chosen in the component) only goes amber/red on real fatigue, so an
// early-week "under volume" no longer reads as an alarm.
export function recoveryReadout(
    recovery: Partial<Record<ExerciseCategory, Pick<RecoveryDetail, 'status'>>>,
): RecoveryReadout {
    const entries = Object.entries(recovery) as Array<[ExerciseCategory, Pick<RecoveryDetail, 'status'>]>;
    if (entries.length === 0) {
        return { tone: 'none', word: 'No data', detail: 'log a session', muscles: [] };
    }
    const at = (s: RecoveryDetail['status']) => entries.filter(([, d]) => d.status === s).map(([cat]) => cat);
    const catLine = (cats: ExerciseCategory[], prefix = ''): string => {
        const shown = cats.slice(0, 2);
        const extra = cats.length - shown.length;
        const list = extra > 0 ? `${shown.join(' · ')} +${extra}` : shown.join(' · ');
        return prefix ? `${prefix} · ${list}` : list;
    };

    const over = at('overreaching');
    if (over.length > 0)
        return { tone: 'easeoff', word: 'Ease off', detail: catLine(over, 'high fatigue'), muscles: over };

    const fatigued = at('high_fatigue');
    if (fatigued.length > 0) return { tone: 'watch', word: 'Watch', detail: catLine(fatigued), muscles: fatigued };

    if (entries.every(([, d]) => d.status === 'optimal')) {
        return { tone: 'fresh', word: 'Fresh', detail: 'all muscles optimal', muscles: [] };
    }
    return { tone: 'ready', word: 'Ready', detail: 'room to build', muscles: [] };
}

// Formats a ProgramPosition + program length into display values for
// ProgramStatusCard. Pure; all decision logic lives in adherence.ts.
export interface FormattedProgramStatus {
    statusLabel: string;
    // 'success' for on_track, 'warn' for behind, 'muted' for lapsed/paused.
    statusTone: 'success' | 'warn' | 'muted';
    weekLabel: string;
    // 0-1 fraction of the program block completed.
    progress: number;
    // The next deload week >= weekInteger, or programWeeks when none exists.
    nextDeloadWeek: number;
}

const STATUS_LABEL: Record<AdherenceStatus, string> = {
    on_track: 'On track',
    behind: 'Behind',
    lapsed: 'Lapsed',
    paused: 'Paused',
};

const STATUS_TONE: Record<AdherenceStatus, FormattedProgramStatus['statusTone']> = {
    on_track: 'success',
    behind: 'warn',
    lapsed: 'muted',
    paused: 'muted',
};

export function formatProgramStatus(pos: ProgramPosition, programWeeks: number): FormattedProgramStatus {
    const statusLabel = STATUS_LABEL[pos.status] ?? 'On track';
    const statusTone = STATUS_TONE[pos.status] ?? 'success';
    // weekInteger is monotonic and keeps counting past programWeeks once the
    // block repeats, so report position relative to the current block (matching
    // getPhase / getRIR, which wrap). Cycle 2 reads "Week 1 of 12", not "Week 13".
    const weekOfBlock = weekInBlock(pos.weekInteger, programWeeks);
    const weekLabel = `Week ${weekOfBlock} of ${programWeeks}`;
    const progress = Math.min(1, weekOfBlock / programWeeks);

    // Find the next deload week at or after the current block week. A deload week
    // is identified by its phase subtitle containing 'Deload' and being the
    // highest-RIR week in that phase (the recovery week).
    let nextDeloadWeek = programWeeks;
    for (let w = weekOfBlock; w <= programWeeks; w++) {
        const phase = getPhase(w, programWeeks);
        if (phase.subtitle.toLowerCase().includes('deload')) {
            // Take the last week of this deload phase (the actual recovery week).
            const lastInPhase = Math.max(...phase.weeks);
            nextDeloadWeek = lastInPhase;
            break;
        }
    }

    return { statusLabel, statusTone, weekLabel, progress, nextDeloadWeek };
}
