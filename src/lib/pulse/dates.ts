// Dependency-free, timezone-aware date helpers shared across pulse lib modules.
// Kept separate from adherence.ts / utils.ts so both can import without a cycle
// (adherence.ts imports from utils.ts, so utils.ts cannot import from it).

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
