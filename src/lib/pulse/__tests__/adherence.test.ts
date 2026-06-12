import { describe, it, expect } from 'vitest';
import {
    dayIndex,
    weekdayOf,
    attributeSessions,
    progressionInfo,
    rampBackPrescription,
    computeProgramPosition,
    computeWeekAdherence,
    computeRegenSuggestion,
    completedWeekBoundaries,
} from '../adherence';
import type {
    ScheduleEntry,
    WorkoutSession,
    WorkoutVariant,
    WorkoutType,
    ProgramAdjustment,
    AdjustmentKind,
    ProgramPause,
    ProgramPosition,
    WeekAdherence,
} from '../types';

function sessWB(id: string, type: string, completedAt: string): WorkoutSession {
    return {
        id, user_id: 'u', routine_id: 'r', workout_type: type, variant: null,
        started_at: completedAt, completed_at: completedAt, session_rpe: null, session_note: null,
    };
}

describe('completedWeekBoundaries', () => {
    const schedule: ScheduleEntry[] = [
        { day_of_week: 1, workout_type: 'upper' }, { day_of_week: 4, workout_type: 'lower' },
    ];
    it('emits one boundary per completed cycle, dated at the closing session', () => {
        const sessions = [
            sessWB('a', 'upper', '2026-05-01T10:00:00Z'),
            sessWB('b', 'lower', '2026-05-04T10:00:00Z'), // completes week 1
            sessWB('c', 'upper', '2026-05-08T10:00:00Z'),
            sessWB('d', 'lower', '2026-05-11T10:00:00Z'), // completes week 2
        ];
        const b = completedWeekBoundaries(schedule, sessions);
        expect(b.map((x) => x.week)).toEqual([1, 2]);
        expect(b[0].session.id).toBe('b');
        expect(b[1].session.id).toBe('d');
    });
    it('returns empty for an empty schedule', () => {
        expect(completedWeekBoundaries([], [sessWB('a', 'upper', '2026-05-01T10:00:00Z')])).toEqual([]);
    });
});

let idc = 0;
const entry = (
    day_of_week: number,
    workout_type: WorkoutType,
    variant: WorkoutVariant | null = null,
): ScheduleEntry => ({
    day_of_week,
    workout_type,
    variant,
});
const sess = (
    completed_at: string | null,
    workout_type: string,
    variant: WorkoutVariant | null = null,
): WorkoutSession => ({
    id: `s${idc++}`,
    user_id: 'u',
    routine_id: 'r',
    workout_type,
    variant,
    started_at: completed_at ?? '2026-01-01T00:00:00Z',
    completed_at,
    session_rpe: null,
    session_note: null,
});
const adj = (kind: AdjustmentKind, effective_week: number): ProgramAdjustment => ({
    id: `a${idc++}`,
    routine_id: 'r',
    kind,
    effective_week,
    created_at: '2026-01-01T00:00:00Z',
    payload: {},
});
const pause = (paused_at: string, resumed_at: string | null = null): ProgramPause => ({
    id: `p${idc++}`,
    routine_id: 'r',
    paused_at,
    resumed_at,
    reason: null,
    created_at: paused_at,
});

const SCHED: ScheduleEntry[] = [
    entry(1, 'upper', 'A'),
    entry(2, 'lower', 'A'),
    entry(4, 'upper', 'B'),
    entry(5, 'lower', 'B'),
];

describe('dayIndex & weekdayOf', () => {
    it('same UTC calendar day → same index', () => {
        expect(dayIndex('2026-06-05T00:30:00Z', 'UTC')).toBe(dayIndex('2026-06-05T23:30:00Z', 'UTC'));
    });
    it('consecutive UTC days differ by 1', () => {
        expect(dayIndex('2026-06-06T12:00:00Z', 'UTC') - dayIndex('2026-06-05T12:00:00Z', 'UTC')).toBe(1);
    });
    it('7 days apart differ by 7', () => {
        expect(dayIndex('2026-06-12T12:00:00Z', 'UTC') - dayIndex('2026-06-05T12:00:00Z', 'UTC')).toBe(7);
    });
    it('timezone behind UTC can roll to the previous day', () => {
        // 01:00 UTC is 18:00 the prior day in Los Angeles (UTC-7 in June).
        expect(dayIndex('2026-06-05T01:00:00Z', 'America/Los_Angeles')).toBe(
            dayIndex('2026-06-05T01:00:00Z', 'UTC') - 1,
        );
    });
    it('late UTC evening is the next day in Tokyo', () => {
        expect(dayIndex('2026-06-05T23:30:00Z', 'Asia/Tokyo')).toBe(dayIndex('2026-06-06T10:00:00Z', 'Asia/Tokyo'));
    });
    it('DST-observing tz: consecutive noon days still differ by 1', () => {
        // US spring-forward weekend (2026-03-08).
        expect(
            dayIndex('2026-03-09T12:00:00Z', 'America/New_York') - dayIndex('2026-03-08T12:00:00Z', 'America/New_York'),
        ).toBe(1);
    });
    it('weekdayOf: epoch day is Thursday (4)', () => {
        expect(weekdayOf(dayIndex('1970-01-01T12:00:00Z', 'UTC'))).toBe(4);
    });
    it('weekdayOf: 2026-06-08 is a Monday (1)', () => {
        expect(weekdayOf(dayIndex('2026-06-08T12:00:00Z', 'UTC'))).toBe(1);
    });
    it('invalid timezone falls back to UTC', () => {
        expect(dayIndex('2026-06-05T12:00:00Z', 'Not/AZone')).toBe(dayIndex('2026-06-05T12:00:00Z', 'UTC'));
    });
});

describe('attributeSessions', () => {
    it('empty schedule is inert', () => {
        const a = attributeSessions([], [sess('2026-06-01T10:00:00Z', 'upper', 'A')]);
        expect(a.weekInteger).toBe(1);
        expect(a.completedCount).toBe(1);
        expect(a.nextEntry).toBeNull();
    });
    it('3 of 4 done → week 1, one remaining', () => {
        const a = attributeSessions(SCHED, [
            sess('2026-06-01T10:00:00Z', 'upper', 'A'),
            sess('2026-06-02T10:00:00Z', 'lower', 'A'),
            sess('2026-06-04T10:00:00Z', 'upper', 'B'),
        ]);
        expect(a.weekInteger).toBe(1);
        expect(a.currentCycleDone).toHaveLength(3);
        expect(a.currentCycleRemaining).toEqual([entry(5, 'lower', 'B')]);
        expect(a.nextEntry).toEqual(entry(5, 'lower', 'B'));
    });
    it('a full cycle advances to the start of week 2', () => {
        const a = attributeSessions(SCHED, [
            sess('2026-06-01T10:00:00Z', 'upper', 'A'),
            sess('2026-06-02T10:00:00Z', 'lower', 'A'),
            sess('2026-06-04T10:00:00Z', 'upper', 'B'),
            sess('2026-06-05T10:00:00Z', 'lower', 'B'),
        ]);
        expect(a.weekInteger).toBe(2);
        expect(a.currentCycleRemaining).toHaveLength(4);
        expect(a.nextEntry).toEqual(entry(1, 'upper', 'A'));
    });
    it('matches by (type,variant) regardless of completion order', () => {
        const a = attributeSessions(SCHED, [
            sess('2026-06-01T10:00:00Z', 'upper', 'B'),
            sess('2026-06-02T10:00:00Z', 'lower', 'A'),
            sess('2026-06-04T10:00:00Z', 'upper', 'A'),
        ]);
        expect(a.currentCycleRemaining).toEqual([entry(5, 'lower', 'B')]);
    });
    it('off-plan session still advances the cycle', () => {
        const a = attributeSessions(SCHED, [sess('2026-06-01T10:00:00Z', 'legs', null)]);
        expect(a.completedCount).toBe(1);
        expect(a.currentCycleRemaining).toHaveLength(3);
    });
    it('multiple off-plan sessions complete cycles and advance weeks', () => {
        const two = [entry(1, 'upper', 'A'), entry(4, 'lower', 'A')];
        const a = attributeSessions(two, [
            sess('2026-06-01T10:00:00Z', 'legs', null),
            sess('2026-06-02T10:00:00Z', 'legs', null),
            sess('2026-06-03T10:00:00Z', 'legs', null),
            sess('2026-06-04T10:00:00Z', 'legs', null),
        ]);
        // 4 sessions / 2-per-cycle = 2 completed cycles, so we are at the start of week 3.
        expect(a.completedCount).toBe(4);
        expect(a.weekInteger).toBe(3);
        expect(a.currentCycleRemaining).toHaveLength(2);
    });
    it('variant-null entries match variant-null sessions', () => {
        const s2 = [entry(1, 'full_body', null), entry(3, 'full_body', null)];
        const a = attributeSessions(s2, [sess('2026-06-01T10:00:00Z', 'full_body', null)]);
        expect(a.currentCycleRemaining).toHaveLength(1);
        expect(a.weekInteger).toBe(1);
    });
});

describe('progressionInfo', () => {
    it('no adjustments → index equals weekInteger', () => {
        expect(progressionInfo(5, [])).toEqual({ progressionIndex: 5, isRampBack: false });
    });
    it('a ramp-back week reports isRampBack', () => {
        expect(progressionInfo(5, [adj('reentry_deload', 5)])).toEqual({ progressionIndex: 5, isRampBack: true });
    });
    it('weeks after a ramp-back are offset back by one', () => {
        expect(progressionInfo(6, [adj('reentry_deload', 5)])).toEqual({ progressionIndex: 5, isRampBack: false });
    });
    it('two inserted deloads offset by two', () => {
        expect(progressionInfo(9, [adj('reentry_deload', 5), adj('reentry_deload', 8)])).toEqual({
            progressionIndex: 7,
            isRampBack: false,
        });
    });
    it('dismissed adjustments do not offset progression', () => {
        expect(progressionInfo(6, [adj('reentry_dismissed', 5)])).toEqual({ progressionIndex: 6, isRampBack: false });
    });
    it('a manual deload lightens the week (isRampBack) without offsetting progression', () => {
        // A manual "go easier this week" eases the week but is not an inserted
        // re-entry, so progression continues at the same index.
        expect(progressionInfo(5, [adj('manual_deload', 5)])).toEqual({ progressionIndex: 5, isRampBack: true });
    });
    it('a manual deload does not offset later weeks', () => {
        expect(progressionInfo(6, [adj('manual_deload', 5)])).toEqual({ progressionIndex: 6, isRampBack: false });
    });
    it('a reentry deload still offsets even when a manual deload also exists earlier', () => {
        // manual deloads never insert a week, so only the reentry offsets week 9 -> 8.
        expect(progressionInfo(9, [adj('manual_deload', 3), adj('reentry_deload', 5)])).toEqual({
            progressionIndex: 8,
            isRampBack: false,
        });
    });
});

describe('rampBackPrescription', () => {
    it('reduces volume to ~60% and eases RIR by 1', () => {
        // week 5 of a 12-week block: volume 16 → round(9.6)=10, RIR 2 → 3.
        expect(rampBackPrescription(5, 12, [adj('reentry_deload', 5)])).toEqual({ volume: 10, rir: 3 });
    });
});

describe('computeProgramPosition', () => {
    it('flags lapsed after a >= GAP_DAYS gap', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A'), sess('2026-06-04T10:00:00Z', 'lower', 'A')],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-15T12:00:00Z',
        });
        expect(pos.daysSinceLastSession).toBe(11);
        expect(pos.status).toBe('lapsed');
    });
    it('is not lapsed at a 9-day gap', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-06-06T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-15T12:00:00Z',
        });
        expect(pos.daysSinceLastSession).toBe(9);
        expect(pos.status).not.toBe('lapsed');
    });
    it('daysSinceLastSession is null with no completed sessions', () => {
        const pos = computeProgramPosition({
            anchor: '2026-06-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-05T12:00:00Z',
        });
        expect(pos.daysSinceLastSession).toBeNull();
        expect(pos.status).not.toBe('lapsed');
    });
    it('calendarWeek tracks elapsed days', () => {
        const pos = computeProgramPosition({
            anchor: '2026-06-01T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-09T00:00:00Z', // 8 days later
        });
        expect(pos.calendarWeek).toBe(2);
    });
    it('does not count a session due today as behind', () => {
        const pos = computeProgramPosition({
            anchor: '2026-06-05T12:00:00Z', // Friday = day 1 of the program
            programWeeks: 12,
            schedule: [entry(5, 'upper', 'A')], // scheduled this Friday
            sessions: [],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-05T18:00:00Z', // same Friday, not trained yet
        });
        expect(pos.behindBy).toBe(0);
        expect(pos.status).toBe('on_track');
    });
    it('counts a scheduled session whose day has fully passed as behind', () => {
        const pos = computeProgramPosition({
            anchor: '2026-06-01T12:00:00Z', // Monday
            programWeeks: 12,
            schedule: [entry(1, 'upper', 'A')], // scheduled Monday
            sessions: [],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-03T12:00:00Z', // Wednesday, Monday passed undone
        });
        expect(pos.behindBy).toBe(1);
        expect(pos.status).toBe('behind');
    });
    it('carries progressionIndex/isRampBack through from adjustments', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [
                sess('2026-05-01T10:00:00Z', 'upper', 'A'),
                sess('2026-05-02T10:00:00Z', 'lower', 'A'),
                sess('2026-05-04T10:00:00Z', 'upper', 'B'),
                sess('2026-05-05T10:00:00Z', 'lower', 'B'),
            ],
            adjustments: [adj('reentry_deload', 2)],
            tz: 'UTC',
            pauses: [],
            now: '2026-05-06T12:00:00Z',
        });
        expect(pos.weekInteger).toBe(2);
        expect(pos.isRampBack).toBe(true);
        expect(pos.progressionIndex).toBe(2);
    });
    it('a mid-week (Sunday) start reads on_track on day one, not behind', () => {
        const schedule = [entry(1, 'lower'), entry(3, 'upper'), entry(4, 'lower'), entry(0, 'upper')];
        const pos = computeProgramPosition({
            anchor: '2026-06-07T00:00:00Z', // Sunday
            programWeeks: 12,
            schedule,
            sessions: [],
            adjustments: [],
            tz: 'UTC',
            pauses: [],
            now: '2026-06-07T12:00:00Z',
        });
        expect(pos.behindBy).toBe(0);
        expect(pos.status).toBe('on_track');
    });
});

describe('computeWeekAdherence', () => {
    it('classifies past-not-done as missed and future as upcoming', () => {
        const wa = computeWeekAdherence({
            schedule: SCHED,
            anchor: '2026-06-01T00:00:00Z',
            tz: 'UTC',
            pauses: [],
            now: '2026-06-05T12:00:00Z',
            sessions: [sess('2026-06-01T10:00:00Z', 'upper', 'A'), sess('2026-06-02T10:00:00Z', 'lower', 'A')],
        });
        expect(wa.done).toEqual([entry(1, 'upper', 'A'), entry(2, 'lower', 'A')]);
        expect(wa.missed).toEqual([entry(4, 'upper', 'B')]);
        expect(wa.upcoming).toEqual([entry(5, 'lower', 'B')]);
    });
    it('ignores sessions outside the current week window', () => {
        const wa = computeWeekAdherence({
            schedule: SCHED,
            anchor: '2026-06-01T00:00:00Z',
            tz: 'UTC',
            pauses: [],
            now: '2026-06-02T12:00:00Z',
            sessions: [sess('2026-05-20T10:00:00Z', 'upper', 'A')],
        });
        expect(wa.done).toEqual([]);
    });
    it('keeps a session due today as upcoming, not missed', () => {
        // anchor Mon 2026-06-01; today Thu 2026-06-04; the Thursday entry is due today.
        const wa = computeWeekAdherence({
            schedule: SCHED,
            anchor: '2026-06-01T00:00:00Z',
            tz: 'UTC',
            pauses: [],
            now: '2026-06-04T12:00:00Z',
            sessions: [],
        });
        expect(wa.upcoming).toContainEqual(entry(4, 'upper', 'B'));
        expect(wa.missed).not.toContainEqual(entry(4, 'upper', 'B'));
    });
    it('returns empty when there is no anchor', () => {
        const wa = computeWeekAdherence({
            schedule: SCHED,
            anchor: null,
            tz: 'UTC',
            pauses: [],
            now: '2026-06-05T12:00:00Z',
            sessions: [],
        });
        expect(wa).toEqual({ missed: [], upcoming: [], done: [] });
    });
    it('a mid-week start keys off completion, not the calendar: no pre-start day reads as missed', () => {
        // The validation-block case: train Mon/Wed/Thu/Sun, start (anchor) on Sunday.
        // 2026-06-01 is a Monday in these tests, so 2026-06-07 is a Sunday.
        // The week window anchors to the start day, so Mon/Wed/Thu are upcoming
        // (reached next calendar week), never overdue, and all 4 sessions remain.
        const schedule = [entry(1, 'lower'), entry(3, 'upper'), entry(4, 'lower'), entry(0, 'upper')];
        const wa = computeWeekAdherence({
            schedule,
            anchor: '2026-06-07T00:00:00Z',
            tz: 'UTC',
            pauses: [],
            now: '2026-06-07T12:00:00Z',
            sessions: [],
        });
        expect(wa.missed).toEqual([]);
        expect(wa.done).toEqual([]);
        expect(wa.upcoming).toHaveLength(4); // full weekly volume preserved
    });
});

describe('computeRegenSuggestion', () => {
    const lapsed = (weekInteger = 2): ProgramPosition => ({
        weekInteger,
        progressionIndex: weekInteger,
        isRampBack: false,
        completedCount: 4,
        calendarWeek: 4,
        behindBy: 3,
        daysSinceLastSession: 12,
        status: 'lapsed',
        isPaused: false,
        pausedDays: null,
        nextEntry: null,
    });
    const noMiss: WeekAdherence = { missed: [], upcoming: [], done: [] };

    it('suggests a ramp-back when lapsed and undecided', () => {
        expect(computeRegenSuggestion(lapsed(), noMiss, [])).toEqual({
            kind: 'reentry_deload',
            weekInteger: 2,
            daysAway: 12,
        });
    });
    it('suppresses the ramp-back once dismissed', () => {
        expect(computeRegenSuggestion(lapsed(), noMiss, [adj('reentry_dismissed', 2)])).toBeNull();
    });
    it('suppresses the ramp-back once accepted', () => {
        expect(computeRegenSuggestion(lapsed(), noMiss, [adj('reentry_deload', 2)])).toBeNull();
    });
    it('suggests catch_up when behind with a missed entry', () => {
        const pos: ProgramPosition = {
            weekInteger: 1,
            progressionIndex: 1,
            isRampBack: false,
            completedCount: 1,
            calendarWeek: 1,
            behindBy: 1,
            daysSinceLastSession: 2,
            status: 'behind',
            isPaused: false,
            pausedDays: null,
            nextEntry: null,
        };
        const wa: WeekAdherence = { missed: [entry(4, 'upper', 'B')], upcoming: [], done: [] };
        expect(computeRegenSuggestion(pos, wa, [])).toEqual({ kind: 'catch_up', missed: [entry(4, 'upper', 'B')] });
    });
    it('returns null when on track with nothing missed', () => {
        const pos: ProgramPosition = {
            weekInteger: 1,
            progressionIndex: 1,
            isRampBack: false,
            completedCount: 2,
            calendarWeek: 1,
            behindBy: 0,
            daysSinceLastSession: 0,
            status: 'on_track',
            isPaused: false,
            pausedDays: null,
            nextEntry: null,
        };
        expect(computeRegenSuggestion(pos, noMiss, [])).toBeNull();
    });
});

describe('program pause', () => {
    it('active pause → status paused, behindBy 0, isPaused, pausedDays counted', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-04T09:00:00Z')], // open, still paused
            tz: 'UTC',
            now: '2026-05-20T12:00:00Z',
        });
        expect(pos.status).toBe('paused');
        expect(pos.isPaused).toBe(true);
        expect(pos.behindBy).toBe(0);
        expect(pos.pausedDays).toBe(16); // days since the pause began (05-04 → 05-20)
    });

    it('a completed pause leaves no behind-debt for its scheduled days', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-04T00:00:00Z', // a Monday
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-04T10:00:00Z', 'upper', 'A'), sess('2026-05-05T10:00:00Z', 'lower', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-06T00:00:00Z', '2026-05-31T00:00:00Z')],
            tz: 'UTC',
            now: '2026-06-01T12:00:00Z',
        });
        expect(pos.isPaused).toBe(false); // resumed
        expect(pos.behindBy).toBe(0); // paused days excluded from the expected count
    });

    it('resuming from a long pause still trips lapsed → ramp-back hand-off', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-02T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-03T00:00:00Z', '2026-06-10T00:00:00Z')],
            tz: 'UTC',
            now: '2026-06-11T12:00:00Z',
        });
        expect(pos.isPaused).toBe(false);
        expect(pos.daysSinceLastSession).toBeGreaterThanOrEqual(10); // real gap, NOT pause-adjusted
        expect(pos.status).toBe('lapsed');
    });

    it('calendarWeek freezes during a pause', () => {
        // 21 days elapsed, but a 14-day pause means only 7 active days → week 2, not 4.
        const pos = computeProgramPosition({
            anchor: '2026-05-01T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [],
            adjustments: [],
            pauses: [pause('2026-05-08T00:00:00Z', '2026-05-22T00:00:00Z')], // 14 days paused
            tz: 'UTC',
            now: '2026-05-22T00:00:00Z',
        });
        expect(pos.calendarWeek).toBe(2);
    });

    it('computeWeekAdherence is empty while paused', () => {
        const wa = computeWeekAdherence({
            schedule: SCHED,
            sessions: [],
            anchor: '2026-05-01T00:00:00Z',
            pauses: [pause('2026-05-02T00:00:00Z')],
            tz: 'UTC',
            now: '2026-05-10T12:00:00Z',
        });
        expect(wa).toEqual({ missed: [], upcoming: [], done: [] });
    });

    it('a regen suggestion is suppressed while paused', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A')],
            adjustments: [],
            pauses: [pause('2026-05-04T00:00:00Z')],
            tz: 'UTC',
            now: '2026-06-15T12:00:00Z', // would be lapsed if not paused
        });
        expect(computeRegenSuggestion(pos, { missed: [], upcoming: [], done: [] }, [])).toBeNull();
    });

    it('with a historical pause and an active pause, pausedDays counts only the active one', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [],
            adjustments: [],
            pauses: [
                pause('2026-05-02T00:00:00Z', '2026-05-06T00:00:00Z'), // completed
                pause('2026-05-18T00:00:00Z'), // active, open
            ],
            tz: 'UTC',
            now: '2026-05-22T00:00:00Z',
        });
        expect(pos.status).toBe('paused');
        expect(pos.isPaused).toBe(true);
        expect(pos.pausedDays).toBe(4); // 05-18 → 05-22, the active pause only
    });

    it('calendarWeek subtracts multiple disjoint historical paused spans', () => {
        // 28 days elapsed (05-01 → 05-29). Two completed pauses of 7 days each →
        // 14 active days → week 3, exercising the interval-union math.
        const pos = computeProgramPosition({
            anchor: '2026-05-01T00:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [],
            adjustments: [],
            pauses: [
                pause('2026-05-02T00:00:00Z', '2026-05-09T00:00:00Z'), // 05-02..05-08 = 7 days
                pause('2026-05-15T00:00:00Z', '2026-05-22T00:00:00Z'), // 05-15..05-21 = 7 days
            ],
            tz: 'UTC',
            now: '2026-05-29T00:00:00Z',
        });
        expect(pos.isPaused).toBe(false);
        expect(pos.calendarWeek).toBe(3);
    });

    it('no pauses → behavior is unchanged (regression guard)', () => {
        const pos = computeProgramPosition({
            anchor: '2026-05-01T08:00:00Z',
            programWeeks: 12,
            schedule: SCHED,
            sessions: [sess('2026-05-01T10:00:00Z', 'upper', 'A'), sess('2026-06-04T10:00:00Z', 'lower', 'A')],
            adjustments: [],
            pauses: [],
            tz: 'UTC',
            now: '2026-06-15T12:00:00Z',
        });
        expect(pos.status).toBe('lapsed');
        expect(pos.isPaused).toBe(false);
        expect(pos.pausedDays).toBeNull();
    });
});
