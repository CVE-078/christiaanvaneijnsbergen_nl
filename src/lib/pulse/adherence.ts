// Adaptive missed-workout regeneration, the pure engine.
//
// No DOM, no ambient clock: callers pass `now` (ISO) so every function is
// deterministic and unit-testable, and the same code can run server-side later
// (e.g. a cron that sends adherence push nudges). Two concerns live here:
//   - Program progression , completion-paced (advances when you finish a
//     scheduled microcycle), with ramp-back weeks inserted, not replacing.
//   - Calendar adherence   , date-based (are you keeping up), from the real
//     `completed_at` timestamps on workout sessions.
//
// `workout_sessions` is the date spine; set logs carry no timestamp.

import { getRIR, volumeForWeek } from './utils';
import { GAP_DAYS, RAMPBACK_VOLUME_FACTOR, RAMPBACK_RIR_BONUS } from './constants';
// dayIndex lives in dates.ts (cycle-free); re-exported here so existing
// importers of `from './adherence'` keep working.
export { dayIndex } from './dates';
import { dayIndex } from './dates';
import type {
    ScheduleEntry,
    WorkoutSession,
    ProgramAdjustment,
    ProgramPause,
    ProgramPosition,
    WeekAdherence,
    RegenSuggestion,
    AdherenceStatus,
} from './types';

// ── Date helpers (timezone-aware, DST-safe) ─────────────────────────────────
// dayIndex is imported from ./dates (re-exported above for back-compat).

// Weekday of a day number, 0=Sun..6=Sat (matching ScheduleEntry.day_of_week).
// Epoch day 0 (1970-01-01) was a Thursday (= 4).
export function weekdayOf(idx: number): number {
    return (((idx + 4) % 7) + 7) % 7;
}

// Count of dates in [start, end] (inclusive day numbers) whose weekday is `wd`.
function countWeekdayInRange(start: number, end: number, wd: number): number {
    if (end < start) return 0;
    const total = end - start + 1;
    const startWd = weekdayOf(start);
    let extra = 0;
    for (let i = 0; i < total % 7; i++) {
        if ((startWd + i) % 7 === wd) extra++;
    }
    return Math.floor(total / 7) + extra;
}

// ── Pause spans ─────────────────────────────────────────────────────────────
// A pause is a date span, not a per-week ease. While a pause is active the
// program calendar is frozen (no behind/lapsed penalty, no missed-week hit), but
// detraining time keeps ticking, so a long pause still hands off to ramp-back on
// resume (daysSinceLastSession is left as the real gap, never pause-adjusted).

// The active (unresolved) pause for this set, or null. At most one by DB design.
export function activePause(pauses: ProgramPause[]): ProgramPause | null {
    return pauses.find((p) => p.resumed_at === null) ?? null;
}

// A pause as an inclusive day-number interval clipped to "not after today". An
// open pause runs to today; a resumed pause ends the day before resume (the
// resume day is active again). Returns null if it hasn't started by `now`.
function pauseInterval(p: ProgramPause, tz: string, now: string): [number, number] | null {
    const startDay = dayIndex(p.paused_at, tz);
    const today = dayIndex(now, tz);
    if (startDay > today) return null;
    const endDay = p.resumed_at === null ? today : dayIndex(p.resumed_at, tz) - 1;
    return [startDay, Math.min(endDay, today)];
}

// Union of all pause intervals clipped to [rangeStart, rangeEnd], as disjoint,
// sorted [a,b] day-number intervals. Merging avoids double-counting overlaps.
function pausedIntervals(
    pauses: ProgramPause[],
    rangeStart: number,
    rangeEnd: number,
    tz: string,
    now: string,
): [number, number][] {
    const raw: [number, number][] = [];
    for (const p of pauses) {
        const iv = pauseInterval(p, tz, now);
        if (!iv) continue;
        const a = Math.max(iv[0], rangeStart);
        const b = Math.min(iv[1], rangeEnd);
        if (a <= b) raw.push([a, b]);
    }
    raw.sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of raw) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
        else merged.push([a, b]);
    }
    return merged;
}

// Count of distinct paused day-numbers in [rangeStart, rangeEnd].
function pausedDayCount(pauses: ProgramPause[], rangeStart: number, rangeEnd: number, tz: string, now: string): number {
    return pausedIntervals(pauses, rangeStart, rangeEnd, tz, now).reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

// Scheduled sessions whose date fell within a paused span in [rangeStart, rangeEnd].
function pausedExpectedSessions(
    schedule: ScheduleEntry[],
    pauses: ProgramPause[],
    rangeStart: number,
    rangeEnd: number,
    tz: string,
    now: string,
): number {
    const ivs = pausedIntervals(pauses, rangeStart, rangeEnd, tz, now);
    let total = 0;
    for (const [a, b] of ivs) {
        for (const e of schedule) total += countWeekdayInRange(a, b, e.day_of_week);
    }
    return total;
}

// Set of paused day-numbers in [rangeStart, rangeEnd] (range is small, e.g. a
// single week window, so materializing the set is cheap).
function pausedDaySet(
    pauses: ProgramPause[],
    rangeStart: number,
    rangeEnd: number,
    tz: string,
    now: string,
): Set<number> {
    const set = new Set<number>();
    for (const [a, b] of pausedIntervals(pauses, rangeStart, rangeEnd, tz, now)) {
        for (let d = a; d <= b; d++) set.add(d);
    }
    return set;
}

// ── Session → program-week attribution (ordinal) ────────────────────────────

export interface SessionAttribution {
    weekInteger: number; // current in-progress program week (monotonic, >= 1)
    completedCount: number;
    currentCycleDone: ScheduleEntry[];
    currentCycleRemaining: ScheduleEntry[];
    nextEntry: ScheduleEntry | null;
}

// Match a completed session to a remaining schedule slot: exact (type, variant)
// first, then type-only, else consume any remaining slot so an off-plan session
// still advances the cycle. Returns the index in `remaining` or -1 if empty.
function matchSlot(remaining: ScheduleEntry[], session: WorkoutSession): number {
    if (remaining.length === 0) return -1;
    let i = remaining.findIndex(
        (e) => e.workout_type === session.workout_type && (e.variant ?? null) === (session.variant ?? null),
    );
    if (i === -1) i = remaining.findIndex((e) => e.workout_type === session.workout_type);
    if (i === -1) i = 0;
    return i;
}

// Walk completed sessions (chronological) into microcycles defined by the
// schedule. Each completed cycle advances the week. Off-plan/extra sessions
// still consume a slot so progression keeps moving on messy data.
export function attributeSessions(schedule: ScheduleEntry[], sessions: WorkoutSession[]): SessionAttribution {
    const completed = sessions
        .filter((s) => s.completed_at)
        .slice()
        .sort((a, b) => (a.completed_at as string).localeCompare(b.completed_at as string));

    if (schedule.length === 0) {
        return {
            weekInteger: 1,
            completedCount: completed.length,
            currentCycleDone: [],
            currentCycleRemaining: [],
            nextEntry: null,
        };
    }

    let week = 1;
    let remaining = schedule.slice();
    let done: ScheduleEntry[] = [];
    for (const s of completed) {
        const i = matchSlot(remaining, s);
        if (i === -1) continue;
        done.push(remaining[i]);
        remaining.splice(i, 1);
        if (remaining.length === 0) {
            week++;
            remaining = schedule.slice();
            done = [];
        }
    }

    return {
        weekInteger: week,
        completedCount: completed.length,
        currentCycleDone: done,
        currentCycleRemaining: remaining,
        nextEntry: remaining[0] ?? null,
    };
}

// ── Progression offset for inserted ramp-back weeks ─────────────────────────

export interface ProgressionInfo {
    progressionIndex: number; // feeds getPhase/getRIR/volumeForWeek
    isRampBack: boolean; // this weekInteger is an inserted ramp-back week
}

export function progressionInfo(weekInteger: number, adjustments: ProgramAdjustment[]): ProgressionInfo {
    // Both kinds ease the week (lighter RIR + banner), but only a gap-driven
    // re-entry is an *inserted* week that offsets later progression. A manual
    // "go easier this week" leaves the program position alone.
    const eases = (a: ProgramAdjustment) => a.kind === 'reentry_deload' || a.kind === 'manual_deload';
    const isRampBack = adjustments.some((a) => eases(a) && a.effective_week === weekInteger);
    const before = adjustments.filter((a) => a.kind === 'reentry_deload' && a.effective_week < weekInteger).length;
    return { progressionIndex: Math.max(1, weekInteger - before), isRampBack };
}

// The reduced prescription for a ramp-back week: ~60% of the volume and an
// easier RIR than the normal week the user is about to resume.
export function rampBackPrescription(
    weekInteger: number,
    programWeeks: number,
    adjustments: ProgramAdjustment[],
): { volume: number; rir: number } {
    const { progressionIndex } = progressionInfo(weekInteger, adjustments);
    const normalVolume = volumeForWeek(progressionIndex, programWeeks);
    const normalRir = getRIR(progressionIndex, programWeeks);
    return {
        volume: Math.max(1, Math.round(normalVolume * RAMPBACK_VOLUME_FACTOR)),
        rir: normalRir + RAMPBACK_RIR_BONUS,
    };
}

// ── Program position (progression + calendar) ───────────────────────────────

export function computeProgramPosition(args: {
    anchor: string | null | undefined;
    programWeeks: number;
    schedule: ScheduleEntry[];
    sessions: WorkoutSession[]; // scoped to the routine
    adjustments: ProgramAdjustment[];
    pauses: ProgramPause[]; // scoped to the routine
    tz: string;
    now: string;
}): ProgramPosition {
    const { anchor, schedule, sessions, adjustments, pauses, tz, now } = args;
    const completed = sessions.filter((s) => s.completed_at);
    const { weekInteger, completedCount, nextEntry } = attributeSessions(schedule, completed);
    const { progressionIndex, isRampBack } = progressionInfo(weekInteger, adjustments);

    const today = dayIndex(now, tz);
    const start = anchor ? dayIndex(anchor, tz) : today;
    const daysElapsed = Math.max(0, today - start);
    // Program time freezes during a pause: subtract paused days from elapsed so
    // calendarWeek reflects active training time, not wall-clock time off.
    const pausedElapsed = pausedDayCount(pauses, start, today, tz, now);
    const calendarWeek = Math.floor(Math.max(0, daysElapsed - pausedElapsed) / 7) + 1;

    let lastIdx: number | null = null;
    for (const s of completed) {
        const di = dayIndex(s.completed_at as string, tz);
        if (lastIdx === null || di > lastIdx) lastIdx = di;
    }
    // Real gap, deliberately NOT pause-adjusted: a long pause still detrains you,
    // so resuming from one hands off to the existing ramp-back nudge.
    const daysSinceLastSession = lastIdx === null ? null : Math.max(0, today - lastIdx);

    // Count only days strictly before today as expected: a session due today is
    // not "overdue" until its day has fully passed (matches computeWeekAdherence's
    // strict `< today`), so a mid-week start never reads as "behind" on day one.
    // Sessions that fell within a paused span are excluded, so a deliberate break
    // leaves no permanent behind-debt once resumed.
    const expectedSessions = schedule.reduce((sum, e) => sum + countWeekdayInRange(start, today - 1, e.day_of_week), 0);
    const pausedExpected = pausedExpectedSessions(schedule, pauses, start, today - 1, tz, now);
    const behindBy = Math.max(0, expectedSessions - pausedExpected - completedCount);

    const active = activePause(pauses);
    const isPaused = active !== null;
    const pausedDays = active ? Math.max(0, today - dayIndex(active.paused_at, tz)) : null;

    let status: AdherenceStatus;
    if (isPaused) status = 'paused';
    else if (daysSinceLastSession !== null && daysSinceLastSession >= GAP_DAYS) status = 'lapsed';
    else if (behindBy > 0) status = 'behind';
    else status = 'on_track';

    return {
        weekInteger,
        progressionIndex,
        isRampBack,
        completedCount,
        calendarWeek,
        behindBy,
        daysSinceLastSession,
        status,
        isPaused,
        pausedDays,
        nextEntry,
    };
}

// ── Within-current-week adherence ───────────────────────────────────────────

export function computeWeekAdherence(args: {
    schedule: ScheduleEntry[];
    sessions: WorkoutSession[];
    anchor: string | null | undefined;
    pauses: ProgramPause[];
    tz: string;
    now: string;
}): WeekAdherence {
    const { schedule, sessions, anchor, pauses, tz, now } = args;
    if (schedule.length === 0 || !anchor) return { missed: [], upcoming: [], done: [] };
    // Nothing is missed while the program is paused.
    if (activePause(pauses) !== null) return { missed: [], upcoming: [], done: [] };

    const today = dayIndex(now, tz);
    const start = dayIndex(anchor, tz);
    const calendarWeek = Math.floor(Math.max(0, today - start) / 7) + 1;
    const winStart = start + (calendarWeek - 1) * 7;
    const winEnd = winStart + 6;
    const winStartWd = weekdayOf(winStart);
    // Days the program was paused within this week (e.g. a pause that ended
    // mid-week): a scheduled day that fell in one is not "missed".
    const pausedInWindow = pausedDaySet(pauses, winStart, winEnd, tz, now);

    const remaining = sessions.filter((s) => {
        if (!s.completed_at) return false;
        const di = dayIndex(s.completed_at, tz);
        return di >= winStart && di <= winEnd;
    });

    // Strict match for adherence: a scheduled entry only counts as "done" if a
    // session of that type (variant-exact, else type-only) was logged this week.
    // Unlike progression's matchSlot, there is no "consume any slot" fallback.
    const matchByType = (e: ScheduleEntry): number => {
        let i = remaining.findIndex(
            (s) => s.workout_type === e.workout_type && (s.variant ?? null) === (e.variant ?? null),
        );
        if (i === -1) i = remaining.findIndex((s) => s.workout_type === e.workout_type);
        return i;
    };

    const done: ScheduleEntry[] = [];
    const missed: ScheduleEntry[] = [];
    const upcoming: ScheduleEntry[] = [];
    for (const e of schedule) {
        const scheduledDate = winStart + ((e.day_of_week - winStartWd + 7) % 7);
        const i = matchByType(e);
        if (i !== -1) {
            remaining.splice(i, 1);
            done.push(e);
        } else if (pausedInWindow.has(scheduledDate)) {
            continue; // a day the program was paused is not "missed"
        } else if (scheduledDate < today) {
            // Only "missed" once the scheduled day has fully passed; a session
            // due today but not yet logged stays "upcoming".
            missed.push(e);
        } else {
            upcoming.push(e);
        }
    }
    return { missed, upcoming, done };
}

// ── Suggestion ──────────────────────────────────────────────────────────────

export function computeRegenSuggestion(
    position: ProgramPosition,
    weekAdherence: WeekAdherence,
    adjustments: ProgramAdjustment[],
): RegenSuggestion {
    const { status, weekInteger, daysSinceLastSession } = position;
    if (position.isPaused) return null; // no nudges while paused
    if (status === 'lapsed') {
        const decided = adjustments.some(
            (a) => a.effective_week === weekInteger && (a.kind === 'reentry_deload' || a.kind === 'reentry_dismissed'),
        );
        if (!decided) {
            return { kind: 'reentry_deload', weekInteger, daysAway: daysSinceLastSession ?? 0 };
        }
    }
    if (weekAdherence.missed.length > 0) {
        return { kind: 'catch_up', missed: weekAdherence.missed };
    }
    return null;
}
