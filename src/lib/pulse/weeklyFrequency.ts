// Exact weekly training frequency (Issue 0, the day-picker redesign). Replaces
// the old three-bucket DaysPerWeek union ('2-3' | '4' | '5-6'), which could not
// express "exactly 6" and silently seeded a 2-day routine for the '2-3' pick.
// One home for the concept: the type, the runtime guard the generate action
// validates with, and the per-frequency day maps the setup flow seeds from.
export const WEEKLY_FREQUENCIES = [2, 3, 4, 5, 6] as const;
export type WeeklyFrequency = (typeof WEEKLY_FREQUENCIES)[number];

/** Runtime guard for forged server-action input. */
export function isWeeklyFrequency(value: unknown): value is WeeklyFrequency {
    return typeof value === 'number' && (WEEKLY_FREQUENCIES as readonly number[]).includes(value);
}

// Default weekday layout per frequency (0=Sun..6=Sat). Quick mode seeds
// trainingDays from this directly, so the routine's session count always
// matches the stated frequency; the full flow pre-fills it when nothing is
// selected. 2/4/5 keep the layouts the old buckets seeded; 3 is Mon/Wed/Fri;
// 6 is Mon-Sat.
export const SUGGESTED_DAYS: Record<WeeklyFrequency, number[]> = {
    2: [1, 3],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
};

// Upper bound on selectable training days in the full flow's "which days"
// grid. With exact frequencies the cap IS the answer; kept as a named map so
// the picker reads intent, not arithmetic.
export const MAX_TRAINING_DAYS: Record<WeeklyFrequency, number> = {
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
};
