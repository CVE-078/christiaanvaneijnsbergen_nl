// Derived "recent milestones" feed for the Progress Overview. Pure, read-only,
// recomputed in full on every load (no persistence), so existing users and the
// seeded test accounts get a backfilled feed of past wins.
//
// ONE PR definition, same rule AND same key as the live badge:
//   - computePRMap (utils.ts) keys by routineExerciseId and keeps the best
//     calcE1RM(kg, reps) over every saved set's top-level kg/reps (drops and rir
//     ignored, strict >, no threshold). It exposes current bests only, no dated
//     history.
//   - isSetPR (utils.ts) reads that map by routineExerciseId; the badge
//     consumers (ExerciseCard, WorkoutModeScreen) call it with re.id.
// This module derives the DATED version of that exact rule by walking
// session-linked workouts oldest-first; a parity test cross-checks the milestone
// value against computePRMap on the same logs. A routine regenerate gives a
// lift a fresh routineExerciseId, which is a fresh baseline here, exactly as in
// the badge (neither path compares across reIds), so no false "New PR" fires.
// No noise threshold, matching the badge; discrete plate/rep increments make
// sub-1% PRs rare, and a threshold, if ever wanted, must land in both paths.
//
// Dating limitation: set_logs carry no date column client-side (LOGS_SELECT in
// queries.ts), so session_id -> workout_sessions.started_at is the only date
// source. PRs and streak records that cannot be dated are omitted from this
// feed (never epoch-dated); the live badge still flags undated PRs.
import { calcE1RM, parseLogKey, toDisplay, weekInBlock, getPhase } from './utils';
import { completedWeekBoundaries } from './adherence';
import type { Workout } from './workouts';
import type { Logs, WorkoutSession, ScheduleEntry, Unit } from './types';

export type MilestoneKind = 'pr' | 'streak' | 'week_completed' | 'session_count';

export interface Milestone {
    id: string;
    kind: MilestoneKind;
    title: string;
    detail: string;
    dateIso: string;
}

export function computeMilestones(input: {
    workouts: Workout[];
    logs: Logs;
    sessions: WorkoutSession[];
    schedule: ScheduleEntry[];
    programWeeks: number;
    unit: Unit;
}): Milestone[] {
    const { workouts, logs, sessions, schedule, programWeeks, unit } = input;
    const out: Milestone[] = [];
    const byDate = [...workouts].sort((a, b) => a.date.localeCompare(b.date)); // oldest-first

    // 1. PR: running best calcE1RM per routineExerciseId, computePRMap's exact
    // rule and key (strict > over the prior best), replayed in date order.
    const best: Record<string, number> = {};
    for (const w of byDate) {
        for (const ex of w.exercises) {
            // ex.sets is non-empty by construction: assembleWorkouts only creates
            // an exercise once a set lands in it, so Math.max never sees [].
            const e = Math.max(...ex.sets.map((s) => calcE1RM(s.kg, s.reps)));
            const prior = best[ex.routineExerciseId];
            if (prior === undefined) {
                best[ex.routineExerciseId] = e; // baseline, not a "new" PR
                continue;
            }
            if (e > prior) {
                const pct = Math.round(((e - prior) / prior) * 100);
                out.push({
                    id: `pr:${ex.routineExerciseId}:${w.id}`,
                    kind: 'pr',
                    title: `New PR · ${ex.name}`,
                    detail: `${Math.round(toDisplay(e, unit))} ${unit} e1RM${pct > 0 ? ` · +${pct}% over your last best` : ''}`,
                    dateIso: w.date,
                });
                best[ex.routineExerciseId] = e;
            }
        }
    }

    // 2. session_count: every 10th workout by date.
    byDate.forEach((w, i) => {
        const n = i + 1;
        if (n % 10 === 0) {
            out.push({ id: `count:${n}`, kind: 'session_count', title: `${n} sessions logged`, detail: 'since you started', dateIso: w.date });
        }
    });

    // 3. week_completed: reuse the canonical attributeSessions matching. Weeks
    // wrap the block (week 13 of a 12-week program is block-week 1), and past
    // the first cycle the title carries the cycle number so two milestones never
    // read identically ("Completed Week 1" vs "Completed Week 1 · Cycle 2").
    // "Cycle" is the user-facing word already used by the Progress window toggle.
    for (const { week, session } of completedWeekBoundaries(schedule, sessions)) {
        const wib = weekInBlock(week, programWeeks);
        const cycle = Math.floor((week - 1) / programWeeks) + 1;
        out.push({
            id: `week:${week}`,
            kind: 'week_completed',
            title: cycle > 1 ? `Completed Week ${wib} · Cycle ${cycle}` : `Completed Week ${wib}`,
            detail: getPhase(week, programWeeks).label,
            dateIso: session.started_at,
        });
    }

    // 4. streak: computeStreak's program-week bucketing (the set of logged weeks
    // from the log-key week segment, ALL saved logs, linked or not, so the run
    // math matches computeStreak exactly); emit once per new all-time record.
    const weekDate = new Map<number, string>(); // program week -> latest session start
    const sessionStart = new Map(sessions.map((s) => [s.id, s.started_at]));
    const loggedWeeks = new Set<number>();
    for (const [key, v] of Object.entries(logs)) {
        if (!v?.saved) continue;
        const parsed = parseLogKey(key);
        if (!parsed) continue;
        loggedWeeks.add(parsed.week);
        const start = v.session_id ? sessionStart.get(v.session_id) : undefined;
        if (start) {
            const cur = weekDate.get(parsed.week);
            if (!cur || start > cur) weekDate.set(parsed.week, start);
        }
    }
    const sortedWeeks = [...loggedWeeks].sort((a, b) => a - b);
    let run = 0;
    let prevWeek: number | null = null;
    let record = 1; // a "streak" needs >= 2 consecutive weeks to be notable
    for (const w of sortedWeeks) {
        run = prevWeek !== null && w === prevWeek + 1 ? run + 1 : 1;
        prevWeek = w;
        if (run >= 2 && run > record) {
            record = run; // the record advances even when the week is undated,
            // so a later dated week never re-emits a stale, smaller record
            const date = weekDate.get(w);
            if (!date) continue; // undated (no session-linked logs): omit, never epoch-date
            out.push({
                id: `streak:${run}`,
                kind: 'streak',
                title: `${run}-week streak`,
                detail: 'your longest run yet',
                dateIso: date,
            });
        }
    }

    // Newest-first.
    return out.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}
