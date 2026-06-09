// Behavior-driven adaptation (#7): turn a user's swap history into a generation
// bias. v1.5 is demote-only (learn what they reject); promote / skip / volume are
// documented follow-ons. Pure: callers pass the rows + clock, no IO here.

export interface SwapHistoryRow {
    fromExerciseId: string; // the catalog exercise the user swapped away from
    createdAt: string; // ISO timestamp of the swap row
    // Smart substitution v2 (#8): pain/no_equipment/crowded are constraints, not
    // preferences, and are excluded from the demote below. null/absent = preference
    // (counts; backward-compatible with every pre-#8 row).
    reason?: string | null;
}

// Constraint reasons (#8) that must not teach a behavior demote.
const CONSTRAINT_REASONS = new Set(['pain', 'no_equipment', 'crowded']);

export interface BehaviorSignal {
    demote: string[]; // exercise_ids to soft-deprioritize (sorted, deterministic)
}

export const EMPTY_BEHAVIOR: BehaviorSignal = { demote: [] };

// An exercise is demoted when it was swapped AWAY FROM at least `minCount` times
// within the recency window (nowMs - createdAt <= recencyMs). Rows with an
// unparseable or stale timestamp are ignored. Output is sorted so the result is a
// pure function of the input set (no row-order dependence).
export function analyzeSwapBehavior(
    rows: SwapHistoryRow[],
    opts: { minCount: number; recencyMs: number; nowMs: number },
): BehaviorSignal {
    const counts = new Map<string, number>();
    for (const r of rows) {
        if (r.reason != null && CONSTRAINT_REASONS.has(r.reason)) continue; // #8: constraints don't teach
        const age = opts.nowMs - Date.parse(r.createdAt);
        if (Number.isNaN(age) || age > opts.recencyMs) continue;
        counts.set(r.fromExerciseId, (counts.get(r.fromExerciseId) ?? 0) + 1);
    }
    const demote = [...counts.entries()]
        .filter(([, n]) => n >= opts.minCount)
        .map(([id]) => id)
        .sort();
    return { demote };
}
