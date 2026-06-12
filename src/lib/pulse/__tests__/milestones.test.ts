import { describe, it, expect } from 'vitest';
import { computeMilestones } from '@/lib/pulse/milestones';
import { computePRMap, toDisplay } from '@/lib/pulse/utils';
import { assembleWorkouts, type Workout } from '@/lib/pulse/workouts';
import type { Logs, WorkoutSession, ScheduleEntry } from '@/lib/pulse/types';

// Valid v4 UUIDs: parseLogKey enforces UUID_RE (version nibble 4, variant 8/9/a/b),
// so log keys with non-v4 ids are silently rejected (known fixture gotcha).
const RE = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const RE2 = 'b2c3d4e5-f6a1-4890-abcd-ef1234567890';

function session(id: string, at: string): WorkoutSession {
    return { id, user_id: 'u', routine_id: 'r', workout_type: 'upper', variant: null, started_at: at, completed_at: at, session_rpe: null, session_note: null };
}
const entry = (kg: number, reps: number, sid: string | null) => ({ kg, reps, rir: 2, saved: true, session_id: sid });
const nameFor = () => 'Barbell Bench Press';

// Hand-built workout for tests that need no logs (sort, session_count).
function workout(id: string, date: string, kg: number, reps: number): Workout {
    return {
        id, date, workoutType: 'upper', variant: null, durationMin: 60, setCount: 1,
        exercises: [{ routineExerciseId: RE, name: 'Barbell Bench Press', sets: [{ kg, reps, rir: 2 }], setCount: 1, maxKg: kg, avgKg: kg }],
    };
}

describe('computeMilestones', () => {
    it('derives PRs from the same logs as computePRMap: baseline skipped, value matches the canonical best', () => {
        // Real pipeline: logs -> assembleWorkouts -> computeMilestones, then
        // cross-check the milestone value against computePRMap on the SAME logs.
        const logs: Logs = { [`1-${RE}-0`]: entry(90, 5, 's1'), [`2-${RE}-0`]: entry(100, 5, 's2') };
        const sessions = [session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z')];
        const workouts = assembleWorkouts(sessions, logs, nameFor);
        const m = computeMilestones({ workouts, logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        const prs = m.filter((x) => x.kind === 'pr');
        expect(prs).toHaveLength(1); // w1 is the baseline, only w2 is a new PR
        expect(prs[0].title).toContain('Barbell Bench Press');
        // Parity lock: the milestone's e1RM is exactly the badge's canonical best.
        const canonical = Math.round(toDisplay(computePRMap(logs)[RE], 'kg'));
        expect(prs[0].detail).toContain(`${canonical} kg e1RM`);
    });

    it('does not emit a false PR when a lift reappears under a new routineExerciseId (routine regenerate)', () => {
        // RE2 lifts heavier than RE's best, but a fresh reId is a fresh baseline,
        // exactly like the badge (computePRMap / isSetPR never compare across reIds).
        const logs: Logs = {
            [`1-${RE}-0`]: entry(90, 5, 's1'),
            [`2-${RE}-0`]: entry(100, 5, 's2'),
            [`3-${RE2}-0`]: entry(110, 5, 's3'),
        };
        const sessions = [session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z'), session('s3', '2026-05-15T10:00:00Z')];
        const workouts = assembleWorkouts(sessions, logs, nameFor);
        const m = computeMilestones({ workouts, logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.filter((x) => x.kind === 'pr')).toHaveLength(1); // only RE's w2 PR
    });

    it('sorts newest-first by date', () => {
        const workouts = [workout('w1', '2026-05-01T10:00:00Z', 90, 5), workout('w2', '2026-05-08T10:00:00Z', 100, 5)];
        const m = computeMilestones({ workouts, logs: {}, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(new Date(m[0].dateIso).getTime()).toBeGreaterThanOrEqual(new Date(m[m.length - 1].dateIso).getTime());
    });

    it('disambiguates week_completed titles across the block wrap', () => {
        // 1-day schedule so each session completes a week; 13 sessions -> absolute week 13.
        const schedule: ScheduleEntry[] = [{ day_of_week: 1, workout_type: 'upper' }];
        const sessions = Array.from({ length: 13 }, (_, i) =>
            session(`s${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`));
        const m = computeMilestones({ workouts: [], logs: {}, sessions, schedule, programWeeks: 12, unit: 'kg' });
        const titles = m.filter((x) => x.kind === 'week_completed').map((x) => x.title);
        expect(titles).toContain('Completed Week 1');           // absolute week 1, cycle 1: no suffix
        expect(titles).toContain('Completed Week 1 · Cycle 2'); // absolute week 13: wrapped AND disambiguated
        expect(titles.every((t) => !/Week 13/.test(t))).toBe(true);
    });

    it('emits a session_count milestone at 10 sessions', () => {
        const workouts = Array.from({ length: 10 }, (_, i) => workout(`w${i}`, `2026-05-${String(i + 1).padStart(2, '0')}T10:00:00Z`, 50, 5));
        const m = computeMilestones({ workouts, logs: {}, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.some((x) => x.kind === 'session_count' && x.title === '10 sessions logged')).toBe(true);
    });

    it('emits one streak milestone per new record and nothing for a rebuild below it', () => {
        // Weeks 1,2,3 set records at runs 2 and 3. Weeks 5,6 rebuild a 2-week run
        // BELOW the record: a per-week emitter would wrongly add a second
        // "2-week streak" here, so the exact toEqual locks emit-once-per-record.
        const logs: Logs = {
            [`1-${RE}-0`]: entry(50, 5, 's1'),
            [`2-${RE}-0`]: entry(50, 5, 's2'),
            [`3-${RE}-0`]: entry(50, 5, 's3'),
            [`5-${RE}-0`]: entry(50, 5, 's5'),
            [`6-${RE}-0`]: entry(50, 5, 's6'),
        };
        const sessions = [
            session('s1', '2026-05-01T10:00:00Z'), session('s2', '2026-05-08T10:00:00Z'),
            session('s3', '2026-05-15T10:00:00Z'), session('s5', '2026-05-29T10:00:00Z'),
            session('s6', '2026-06-05T10:00:00Z'),
        ];
        const m = computeMilestones({ workouts: [], logs, sessions, schedule: [], programWeeks: 12, unit: 'kg' });
        const titles = m.filter((x) => x.kind === 'streak').map((x) => x.title);
        expect(titles).toEqual(['3-week streak', '2-week streak']); // newest-first, exactly these
    });

    it('omits a streak record it cannot date instead of epoch-dating it', () => {
        // No session_id on the logs (pre-Phase-0 rows): the record cannot be dated,
        // so it is omitted from the feed rather than sorted to 1970.
        const logs: Logs = { [`1-${RE}-0`]: entry(50, 5, null), [`2-${RE}-0`]: entry(50, 5, null) };
        const m = computeMilestones({ workouts: [], logs, sessions: [], schedule: [], programWeeks: 12, unit: 'kg' });
        expect(m.filter((x) => x.kind === 'streak')).toHaveLength(0);
    });
});
