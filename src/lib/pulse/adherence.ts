// Adaptive missed-workout regeneration — the pure engine.
//
// No DOM, no ambient clock: callers pass `now` (ISO) so every function is
// deterministic and unit-testable, and the same code can run server-side later
// (e.g. a cron that sends adherence push nudges). Two concerns live here:
//   - Program progression  — completion-paced (advances when you finish a
//     scheduled microcycle), with ramp-back weeks inserted, not replacing.
//   - Calendar adherence    — date-based (are you keeping up), from the real
//     `completed_at` timestamps on workout sessions.
//
// `workout_sessions` is the date spine; set logs carry no timestamp.

import { getRIR, volumeForWeek } from './utils';
import { GAP_DAYS, RAMPBACK_VOLUME_FACTOR, RAMPBACK_RIR_BONUS } from './constants';
import type {
    ScheduleEntry,
    WorkoutSession,
    ProgramAdjustment,
    ProgramPosition,
    WeekAdherence,
    RegenSuggestion,
    AdherenceStatus,
} from './types';

// ── Date helpers (timezone-aware, DST-safe) ─────────────────────────────────

// Integer day number of the local calendar date of `iso` in `tz` (days since
// the Unix epoch). Comparing day numbers sidesteps DST/elapsed-ms pitfalls: it
// only ever looks at the Y/M/D the wall clock shows in `tz`. Falls back to UTC
// for an unknown timezone string.
export function dayIndex(iso: string, tz: string): number {
    const d = new Date(iso);
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);
    } catch {
        parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'UTC',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(d);
    }
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Math.floor(Date.UTC(get('year'), get('month') - 1, get('day')) / 86400000);
}

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
    const deloads = adjustments.filter((a) => a.kind === 'reentry_deload');
    const isRampBack = deloads.some((a) => a.effective_week === weekInteger);
    const before = deloads.filter((a) => a.effective_week < weekInteger).length;
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
    tz: string;
    now: string;
}): ProgramPosition {
    const { anchor, schedule, sessions, adjustments, tz, now } = args;
    const completed = sessions.filter((s) => s.completed_at);
    const { weekInteger, completedCount, nextEntry } = attributeSessions(schedule, completed);
    const { progressionIndex, isRampBack } = progressionInfo(weekInteger, adjustments);

    const today = dayIndex(now, tz);
    const start = anchor ? dayIndex(anchor, tz) : today;
    const daysElapsed = Math.max(0, today - start);
    const calendarWeek = Math.floor(daysElapsed / 7) + 1;

    let lastIdx: number | null = null;
    for (const s of completed) {
        const di = dayIndex(s.completed_at as string, tz);
        if (lastIdx === null || di > lastIdx) lastIdx = di;
    }
    const daysSinceLastSession = lastIdx === null ? null : Math.max(0, today - lastIdx);

    const expectedSessions = schedule.reduce((sum, e) => sum + countWeekdayInRange(start, today, e.day_of_week), 0);
    const behindBy = Math.max(0, expectedSessions - completedCount);

    let status: AdherenceStatus;
    if (daysSinceLastSession !== null && daysSinceLastSession >= GAP_DAYS) status = 'lapsed';
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
        nextEntry,
    };
}

// ── Within-current-week adherence ───────────────────────────────────────────

export function computeWeekAdherence(args: {
    schedule: ScheduleEntry[];
    sessions: WorkoutSession[];
    anchor: string | null | undefined;
    tz: string;
    now: string;
}): WeekAdherence {
    const { schedule, sessions, anchor, tz, now } = args;
    if (schedule.length === 0 || !anchor) return { missed: [], upcoming: [], done: [] };

    const today = dayIndex(now, tz);
    const start = dayIndex(anchor, tz);
    const calendarWeek = Math.floor(Math.max(0, today - start) / 7) + 1;
    const winStart = start + (calendarWeek - 1) * 7;
    const winEnd = winStart + 6;
    const winStartWd = weekdayOf(winStart);

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
    if (status === 'lapsed') {
        const decided = adjustments.some(
            (a) =>
                a.effective_week === weekInteger &&
                (a.kind === 'reentry_deload' || a.kind === 'reentry_dismissed'),
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
