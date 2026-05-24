# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all actionable findings from the 2026-05-25 Pulse codebase audit — covering security hardening, performance improvements, type correctness, UX polish, DB schema, and test coverage.

**Architecture:** All fixes are isolated patches — no new dependencies, no architectural changes. Security and validation fixes land first (server actions), then performance (DB calls), then UX (client components), then DB migrations, then tests. Each task is independently committable.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (Postgres + RLS), Bun, Vitest + Testing Library, inline SVG, inline styles.

---

## File Map

| File | Tasks |
|------|-------|
| `package.json` | T1 (remove @vercel/kv) |
| `vitest.config.ts` | T1 (globals typing) |
| `src/lib/weight-tracker/data.ts` | T2 (WORKOUTS type) |
| `src/app/pulse/actions.ts` | T2 (implicit any), T3 (validation) |
| `src/app/pulse/page.tsx` | T2 (implicit any), T4 (Promise.all), T6 (noindex) |
| `src/components/weight-tracker/SetLogger.tsx` | T2 (useEffect comment) |
| `next.config.mjs` | T6 (CSP header) |
| `src/app/pulse/loading.tsx` | T5 (new file — skeleton) |
| `src/components/weight-tracker/RestTimer.tsx` | T8 (localStorage duration) |
| `src/components/weight-tracker/views/ProfileView.tsx` | T9 (save feedback), T11 (timezone) |
| `src/components/weight-tracker/ExerciseCard.tsx` | T10 (completed indicator) |
| `src/components/weight-tracker/views/LogView.tsx` | T10 (empty state) |
| `src/components/weight-tracker/__tests__/ExerciseCard.test.tsx` | T12 (new) |
| `src/components/weight-tracker/__tests__/ProfileView.test.tsx` | T12 (new) |

**DB migrations (Supabase dashboard — no code files):**
- `ALTER TABLE profiles ADD CONSTRAINT display_name_length CHECK (char_length(display_name) <= 50)` — T7
- `CREATE INDEX IF NOT EXISTS idx_set_logs_user_week ON set_logs(user_id, week)` — T7

---

## Task 1: Test Infrastructure & Dependency Cleanup

**Audit refs:** P6 (unused @vercel/kv), tests infra (vitest TS errors)

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`

**Context:** `vitest.config.ts` already has `globals: true`, but test files import from `'vitest'` explicitly and TypeScript can't resolve the module. The fix is to add a `types` reference to the vitest config. `@vercel/kv` is a leftover from the pre-Supabase migration and should be removed.

- [ ] **Step 1: Remove @vercel/kv from package.json**

```json
// package.json — remove this line from "dependencies":
"@vercel/kv": "^3.0.0",
```

- [ ] **Step 2: Run install to sync lockfile**

```bash
bun install
```
Expected: lock file updates, no errors.

- [ ] **Step 3: Add vitest types reference to vitest.config.ts**

The test files import `{ describe, it, expect, vi }` directly from `'vitest'`. With `globals: true` this works at runtime but TypeScript needs the type reference. Add a `/// <reference types="vitest/globals" />` triple-slash directive to the setup file so all test files inherit it automatically:

```ts
// src/test/setup.ts — full file after change:
/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Verify TS check passes for test files**

```bash
bun run tsc --noEmit 2>&1 | grep "weight-tracker"
```

Expected: only `@testing-library/react` and `@testing-library/user-event` errors remain if testing-library types are missing — but NOT the `Cannot find module 'vitest'` error. If testing-library errors still appear, run:

```bash
bun add -d @types/testing-library__jest-dom
```

- [ ] **Step 5: Run the test suite to confirm it works**

```bash
bun run test:run
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/test/setup.ts bun.lock
git commit -m "chore(pulse): remove unused @vercel/kv dep, fix vitest TS types"
```

---

## Task 2: Type Correctness & Code Quality

**Audit refs:** C2 (WORKOUTS type), C3 (implicit any ×2), C4 (useEffect comment)

**Files:**
- Modify: `src/lib/weight-tracker/data.ts`
- Modify: `src/app/pulse/actions.ts`
- Modify: `src/app/pulse/page.tsx`
- Modify: `src/components/weight-tracker/SetLogger.tsx`

No new tests needed — the TS compiler is the test here. Run `bun run tsc --noEmit` to verify.

- [ ] **Step 1: Fix WORKOUTS type in data.ts**

```ts
// src/lib/weight-tracker/data.ts — change line 17:
// Before:
export const WORKOUTS: Record<string, Workout> = {
// After:
export const WORKOUTS: Record<WorkoutType, Workout> = {
```

The `WorkoutType` import is already present in the file via the type import at the top.

- [ ] **Step 2: Fix implicit `any` in actions.ts**

In `saveLogs`, the delete filter at line ~57 iterates over DB rows. Add an explicit type:

```ts
// src/app/pulse/actions.ts
// Find this section (around line 56):
const toDelete = (existing ?? []).filter(
  row => !currentKeys.has(`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`),
);

// Change to:
const toDelete = (existing ?? []).filter(
  (row: { week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
    !currentKeys.has(`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`),
);
```

- [ ] **Step 3: Fix implicit `any` in page.tsx**

```ts
// src/app/pulse/page.tsx — around line 56
// Before:
const bodyweightLogs: BodyweightEntry[] = (bwRows ?? []).map(r => ({
// After:
const bodyweightLogs: BodyweightEntry[] = (bwRows ?? []).map(
  (r: { id: string; logged_at: string; weight_kg: number }) => ({
    id: r.id,
    logged_at: r.logged_at,
    weight_kg: Number(r.weight_kg),
  }),
);
```

- [ ] **Step 4: Clarify the intentional useEffect dep omission in SetLogger.tsx**

The `useEffect` in `SetLogger` intentionally omits `entry` and `suggestion` from deps to only sync on unit change. Replace the blanket disable with a more specific comment:

```ts
// src/components/weight-tracker/SetLogger.tsx — find the useEffect block:
// Before:
  useEffect(() => {
    if (!saved || editing) {
      const base = entry?.kg ?? (suggestion !== null ? suggestion : null);
      if (base !== null) setKg(String(toDisplay(base, unit)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

// After:
  useEffect(() => {
    if (!saved || editing) {
      const base = entry?.kg ?? (suggestion !== null ? suggestion : null);
      if (base !== null) setKg(String(toDisplay(base, unit)));
    }
    // Intentionally only [unit]: re-sync display value when unit changes.
    // entry and suggestion are captured at mount time and don't change independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);
```

- [ ] **Step 5: Verify TS check**

```bash
bun run tsc --noEmit 2>&1 | grep -v "node_modules" | grep -v "vitest" | grep -v "supabase"
```

Expected: only pre-existing errors outside of Pulse files. No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/weight-tracker/data.ts src/app/pulse/actions.ts src/app/pulse/page.tsx src/components/weight-tracker/SetLogger.tsx
git commit -m "fix(pulse): correct WORKOUTS type, fix implicit any, clarify useEffect intent"
```

---

## Task 3: Server Action Input Validation

**Audit refs:** S2 (display_name length), S3 (logBodyWeight no validation), S4 (deleteBodyWeight UUID)

**Files:**
- Modify: `src/app/pulse/actions.ts`

These are server-side guards. No tests are added here because server actions require Supabase mocking to test end-to-end; the DB constraint on `weight_kg` serves as the integration-level safety net. The application-level checks here give better error messages and prevent unnecessary DB round-trips.

- [ ] **Step 1: Add display_name length guard in updateProfile**

```ts
// src/app/pulse/actions.ts — updateProfile function
// Before:
export async function updateProfile(displayName: string | null, unit: Unit) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

// After:
export async function updateProfile(displayName: string | null, unit: Unit) {
  if (displayName !== null && displayName.trim().length > 50)
    throw new Error('Display name must be 50 characters or fewer');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
```

- [ ] **Step 2: Add weightKg validation in logBodyWeight**

```ts
// src/app/pulse/actions.ts — logBodyWeight function
// Before:
export async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

// After:
export async function logBodyWeight(weightKg: number): Promise<BodyweightEntry> {
  if (typeof weightKg !== 'number' || isNaN(weightKg) || weightKg < 0.5 || weightKg > 500)
    throw new Error('Invalid weight');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
```

- [ ] **Step 3: Add UUID format validation in deleteBodyWeight**

```ts
// src/app/pulse/actions.ts — deleteBodyWeight function
// Before:
export async function deleteBodyWeight(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

// After:
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteBodyWeight(id: string) {
  if (!UUID_RE.test(id)) throw new Error('Invalid id');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
```

Place the `UUID_RE` constant at module scope (top of file, after the imports).

- [ ] **Step 4: Verify TS check**

```bash
bun run tsc --noEmit 2>&1 | grep "actions.ts"
```

Expected: no errors for `actions.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/pulse/actions.ts
git commit -m "fix(pulse): add server-side validation to updateProfile, logBodyWeight, deleteBodyWeight"
```

---

## Task 4: Performance — DB Query Optimisation

**Audit refs:** P1 (sequential DB calls), P2 (N+1 deletes)

**Files:**
- Modify: `src/app/pulse/page.tsx`
- Modify: `src/app/pulse/actions.ts`

- [ ] **Step 1: Parallelise the 3 DB calls in page.tsx**

The current page makes 3 sequential `await` calls (set_logs → profiles → bodyweight_logs). Wrap them in `Promise.all`:

```ts
// src/app/pulse/page.tsx — replace the entire data-fetching section after the user check:

  const [logsResult, profileResult, bwResult] = await Promise.all([
    supabase
      .from('set_logs')
      .select('week, workout_type, ex_idx, set_idx, kg, reps, rir, saved')
      .eq('user_id', user.id),
    supabase
      .from('profiles')
      .select('display_name, unit')
      .eq('id', user.id)
      .single(),
    supabase
      .from('bodyweight_logs')
      .select('id, logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(90),
  ]);

  let logs: Logs = {};
  try {
    if (logsResult.error) throw logsResult.error;
    const raw: Record<string, unknown> = {};
    for (const row of logsResult.data ?? []) {
      raw[`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`] = {
        kg: Number(row.kg),
        reps: row.reps,
        rir: row.rir,
        saved: row.saved,
      };
    }
    if (validateLogs(raw)) logs = raw;
  } catch {
    throw new Error('Failed to load training data. Please try again.');
  }

  const profileRow = profileResult.data;
  const profile: Profile = {
    display_name: profileRow?.display_name ?? null,
    unit: profileRow?.unit === 'lbs' ? 'lbs' : 'kg',
  };

  const bodyweightLogs: BodyweightEntry[] = (bwResult.data ?? []).map(
    (r: { id: string; logged_at: string; weight_kg: number }) => ({
      id: r.id,
      logged_at: r.logged_at,
      weight_kg: Number(r.weight_kg),
    }),
  );
```

- [ ] **Step 2: Replace the N+1 delete loop in saveLogs with a batch operation**

```ts
// src/app/pulse/actions.ts — in saveLogs, replace the for loop:

  // Before:
  for (const row of toDelete) {
    await supabase
      .from('set_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('week', row.week)
      .eq('workout_type', row.workout_type)
      .eq('ex_idx', row.ex_idx)
      .eq('set_idx', row.set_idx);
  }

  // After (batch using compound unique key values):
  if (toDelete.length > 0) {
    // Build a set of composite string keys to delete
    const keysToDelete = toDelete.map(
      (row: { week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
        `${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`,
    );

    // Fetch IDs for the rows to delete, then delete by ID in one call
    const { data: rowsToDelete } = await supabase
      .from('set_logs')
      .select('id, week, workout_type, ex_idx, set_idx')
      .eq('user_id', user.id);

    const idsToDelete = (rowsToDelete ?? [])
      .filter((r: { id: string; week: number; workout_type: string; ex_idx: number; set_idx: number }) =>
        keysToDelete.includes(`${r.week}-${r.workout_type}-${r.ex_idx}-${r.set_idx}`),
      )
      .map((r: { id: string }) => r.id);

    if (idsToDelete.length > 0) {
      await supabase.from('set_logs').delete().in('id', idsToDelete).eq('user_id', user.id);
    }
  }
```

**Note:** The `set_logs` table has a composite unique constraint but no single `id` PK mentioned in the schema. Check — the schema in the context handoff shows `id uuid primary key default gen_random_uuid()`. So `id` exists and the batch delete by `id` is valid.

- [ ] **Step 3: Verify TS check**

```bash
bun run tsc --noEmit 2>&1 | grep -E "(actions|page)\.ts"
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pulse/page.tsx src/app/pulse/actions.ts
git commit -m "perf(pulse): parallelise DB calls on page load, batch delete in saveLogs"
```

---

## Task 5: Loading Skeleton

**Audit refs:** P5 (no loading.tsx), U1 (blank page on slow load)

**Files:**
- Create: `src/app/pulse/loading.tsx`

Next.js App Router automatically uses `loading.tsx` as the Suspense fallback for the segment. No code changes to `page.tsx` needed.

- [ ] **Step 1: Create the loading skeleton**

The skeleton should mirror the TrackerClient layout: header bar + workout tabs + a few exercise card outlines. Use the same theme constants.

```tsx
// src/app/pulse/loading.tsx
import { MONO, BG, SURFACE, BORDER, ACCENT } from '@/lib/weight-tracker/theme';

const shimmer = {
  background: `linear-gradient(90deg, ${SURFACE} 25%, #1c1c1c 50%, ${SURFACE} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'pulse-shimmer 1.4s ease infinite',
} as const;

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
      {/* Header skeleton */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '0 1rem', height: 56, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', color: '#fff', textTransform: 'uppercase' }}>
          Pulse<span style={{ color: ACCENT }}>.</span>
        </span>
        <div style={{ width: 60, height: 12, borderRadius: 2, ...shimmer }} />
        <div style={{ marginLeft: 'auto', width: 160, height: 12, borderRadius: 2, ...shimmer }} />
      </div>

      {/* Tab skeleton */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
        {['Push', 'Pull', 'Legs'].map(label => (
          <div key={label} style={{ flex: 1, padding: '0.875rem 0', textAlign: 'center', fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#333' }}>
            {label}
          </div>
        ))}
      </div>

      {/* Week row skeleton */}
      <div style={{ display: 'flex', padding: '0 1rem', borderBottom: `1px solid ${BORDER}`, gap: '0.25rem' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ minWidth: '2.25rem', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 10, borderRadius: 2, ...shimmer }} />
          </div>
        ))}
      </div>

      {/* Exercise card skeletons */}
      <div style={{ padding: '0.75rem 1rem', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 36, height: 28, borderRadius: 2, ...shimmer }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: `${55 + i * 7}%`, height: 12, borderRadius: 2, marginBottom: 8, ...shimmer }} />
              <div style={{ width: '40%', height: 8, borderRadius: 2, ...shimmer }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders by navigating to /pulse while logged out then logging in (manual check)**

Start dev server: `bun run dev`
Navigate to `http://localhost:3000/pulse`. You should see the skeleton briefly before the page loads. If the server responds too fast locally to notice, add a temporary `await new Promise(r => setTimeout(r, 2000))` to `page.tsx` to verify, then remove it.

- [ ] **Step 3: Commit**

```bash
git add src/app/pulse/loading.tsx
git commit -m "feat(pulse): add loading skeleton for pulse route"
```

---

## Task 6: Security Headers & Page Metadata

**Audit refs:** S7 (no CSP), S8 (no noindex on main pulse page)

**Files:**
- Modify: `next.config.mjs`
- Modify: `src/app/pulse/page.tsx`

- [ ] **Step 1: Add Content-Security-Policy to next.config.mjs**

The app uses inline styles throughout and connects only to Supabase. The current `next.config.mjs` already has some headers — add CSP to the existing pulse-specific path, and keep the global headers as-is:

```js
// next.config.mjs — full file after change:
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : 'fjlkzzxwmyrksyockdko.supabase.co';

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/pulse/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
              "img-src 'self' data:",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

**Why `unsafe-inline` for scripts:** Next.js App Router injects inline scripts for hydration. Removing `unsafe-inline` requires nonce-based CSP which requires middleware changes — out of scope here. This CSP still blocks scripts from external origins, which is the primary XSS vector.

- [ ] **Step 2: Add noindex metadata to the main pulse page**

```ts
// src/app/pulse/page.tsx — add at the top, after imports:
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pulse',
  robots: { index: false, follow: false },
};
```

- [ ] **Step 3: Verify build compiles**

```bash
bun run build 2>&1 | tail -20
```

Expected: build succeeds, no errors.

- [ ] **Step 4: Commit**

```bash
git add next.config.mjs src/app/pulse/page.tsx
git commit -m "fix(pulse): add CSP header for pulse routes, add noindex metadata"
```

---

## Task 7: Database Schema Migrations

**Audit refs:** D2 (display_name length constraint), D4 (missing index on set_logs)

**No code files changed.** These are SQL migrations run via the Supabase SQL Editor (Dashboard → SQL Editor → New Query).

- [ ] **Step 1: Add display_name length constraint**

Run this SQL in the Supabase SQL Editor:

```sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_length
CHECK (display_name IS NULL OR char_length(display_name) <= 50);
```

Expected: `ALTER TABLE` success message. If any existing row has a name > 50 chars, the command will fail — check with `SELECT id, char_length(display_name) FROM profiles WHERE char_length(display_name) > 50` first.

- [ ] **Step 2: Add index on set_logs(user_id, week)**

```sql
CREATE INDEX IF NOT EXISTS idx_set_logs_user_week
ON set_logs(user_id, week);
```

Expected: `CREATE INDEX` success message. This runs online (non-blocking for a small table) and speeds up the "load all sets for this user" query pattern.

- [ ] **Step 3: Verify constraints in Supabase dashboard**

Navigate to Dashboard → Table Editor → `profiles` → Columns. Confirm `display_name` shows the length constraint. Navigate to `set_logs` → Indexes — confirm `idx_set_logs_user_week` appears.

- [ ] **Step 4: Commit a migration log**

```bash
# Create a record of the migration for future reference
mkdir -p docs/migrations
cat > docs/migrations/2026-05-25-audit-schema-fixes.sql << 'EOF'
-- Applied 2026-05-25 via Supabase SQL Editor

-- D2: Enforce max 50 chars on display_name
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_length
CHECK (display_name IS NULL OR char_length(display_name) <= 50);

-- D4: Index for user+week query pattern in set_logs
CREATE INDEX IF NOT EXISTS idx_set_logs_user_week
ON set_logs(user_id, week);
EOF
git add docs/migrations/2026-05-25-audit-schema-fixes.sql
git commit -m "docs(pulse): record DB migrations for display_name constraint and set_logs index"
```

---

## Task 8: RestTimer Duration Persistence

**Audit ref:** U5 (timer duration resets on reload)

**Files:**
- Modify: `src/components/weight-tracker/RestTimer.tsx`

**Context:** `RestTimer` uses `useState(DEFAULT_IDX)` for the selected duration (index into `[60, 90, 120, 180]`). On reload this always resets to index 1 (90s). Persist to `localStorage` under key `wt_timer_idx`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/weight-tracker/__tests__/RestTimer.test.tsx — new file
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestTimer from '../RestTimer';

beforeEach(() => {
  localStorage.clear();
});

describe('RestTimer', () => {
  it('persists selected duration to localStorage when changed', async () => {
    render(<RestTimer trigger={1} />);
    // Timer starts at 90s (default). Click the duration button to cycle to 120s.
    const durationBtn = screen.getByRole('button', { name: /rest duration/i });
    await userEvent.click(durationBtn); // cycles 90 → 120
    expect(localStorage.getItem('wt_timer_idx')).toBe('2'); // index 2 = 120s
  });

  it('reads persisted duration from localStorage on mount', () => {
    localStorage.setItem('wt_timer_idx', '3'); // 180s = index 3
    render(<RestTimer trigger={1} />);
    // Timer should start at 180s
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run test:run -- RestTimer
```

Expected: both tests fail.

- [ ] **Step 3: Implement localStorage persistence in RestTimer**

```tsx
// src/components/weight-tracker/RestTimer.tsx
// Change the durationIdx useState initialiser to read from localStorage:

const [durationIdx, setDurationIdx] = useState(() => {
  if (typeof window === 'undefined') return DEFAULT_IDX;
  const stored = Number(localStorage.getItem('wt_timer_idx'));
  return stored >= 0 && stored < DURATIONS.length ? stored : DEFAULT_IDX;
});
```

Then persist whenever `durationIdx` changes. Add a `useEffect` after the existing ones:

```tsx
useEffect(() => {
  localStorage.setItem('wt_timer_idx', String(durationIdx));
}, [durationIdx]);
```

Also update `totalRef` to use the persisted value on mount:

```tsx
// Change the totalRef initialiser from:
const totalRef = useRef(DURATIONS[DEFAULT_IDX]);
// To:
const totalRef = useRef(DURATIONS[durationIdx]);
```

Note: `durationIdx` used in `useRef` init is fine because `useRef` takes the initial value once.

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run test:run -- RestTimer
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/weight-tracker/RestTimer.tsx src/components/weight-tracker/__tests__/RestTimer.test.tsx
git commit -m "fix(pulse): persist rest timer duration selection across reloads"
```

---

## Task 9: Profile Save Feedback

**Audit ref:** U2 (no visual confirmation when display name is saved)

**Files:**
- Modify: `src/components/weight-tracker/views/ProfileView.tsx`

**Approach:** A minimal inline "Saved ✓" indicator that appears briefly after a successful save, then fades. No external dependency. Uses a timeout-based state flag. This is scoped to ProfileView only — a full toast system is Phase 5 scope.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/weight-tracker/__tests__/ProfileView.test.tsx — add this test
// (Full test file is created in Task 12 — add this test there. For now, create a minimal file.)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileView from '../views/ProfileView';

// Mock server actions
vi.mock('@/app/pulse/actions', () => ({
  updateProfile: vi.fn().mockResolvedValue(undefined),
  logBodyWeight: vi.fn(),
  deleteBodyWeight: vi.fn(),
}));

const defaultProps = {
  email: 'test@example.com',
  displayName: 'Test User',
  unit: 'kg' as const,
  bodyweightLogs: [],
  onUnitChange: vi.fn(),
  onDisplayNameChange: vi.fn(),
  onBodyweightLogsChange: vi.fn(),
};

describe('ProfileView', () => {
  it('shows a saved confirmation after display name is updated', async () => {
    render(<ProfileView {...defaultProps} />);
    // Click the name to start editing
    await userEvent.click(screen.getByText('Test User'));
    const input = screen.getByPlaceholderText('Display name');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run test:run -- ProfileView
```

Expected: test fails because no "saved" text appears.

- [ ] **Step 3: Add saved indicator state to ProfileView**

```tsx
// src/components/weight-tracker/views/ProfileView.tsx

// Add to the state declarations at the top of the component:
const [nameSaved, setNameSaved] = useState(false);

// Modify handleNameSave to set the indicator after save:
function handleNameSave() {
  const trimmed = nameInput.trim() || null;
  setEditingName(false);
  if (trimmed === displayName) return;
  onDisplayNameChange(trimmed);
  startTransition(async () => {
    await updateProfile(trimmed, unit);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  });
}
```

Then add the indicator next to the name display (the button/input area):

```tsx
// In the identity section, after the name button/input, add:
{nameSaved && !editingName && (
  <span style={{
    fontFamily: MONO,
    fontSize: '0.5625rem',
    color: '#4ade80',
    letterSpacing: '0.04em',
    marginTop: '0.125rem',
    display: 'block',
  }}>
    Saved ✓
  </span>
)}
```

Place this span inside the `<div style={{ flex: 1, minWidth: 0 }}>` wrapper, below the email line.

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run test:run -- ProfileView
```

Expected: test passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/weight-tracker/views/ProfileView.tsx src/components/weight-tracker/__tests__/ProfileView.test.tsx
git commit -m "fix(pulse): show save confirmation after display name update"
```

---

## Task 10: Log View UX Improvements

**Audit refs:** U3 (no empty state), U6 (no completed exercise indicator)

**Files:**
- Modify: `src/components/weight-tracker/views/LogView.tsx`
- Modify: `src/components/weight-tracker/ExerciseCard.tsx`

### Part A — Empty state when no sets logged for current week

- [ ] **Step 1: Write failing test**

```tsx
// src/components/weight-tracker/__tests__/LogView.test.tsx — new file
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LogView from '../views/LogView';

const defaultProps = {
  activeWeek: 1,
  onSelectWeek: () => {},
  activeTab: 'push' as const,
  setActiveTab: () => {},
  logs: {},
  unit: 'kg' as const,
  updateLog: () => {},
  deleteLog: () => {},
  timerTrigger: 0,
};

describe('LogView', () => {
  it('shows an empty state hint when no sets are logged for the current week', () => {
    render(<LogView {...defaultProps} />);
    expect(screen.getByText(/tap an exercise/i)).toBeInTheDocument();
  });

  it('hides the empty state hint when at least one set is logged', () => {
    const logs = { '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true } };
    render(<LogView {...defaultProps} logs={logs} />);
    expect(screen.queryByText(/tap an exercise/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
bun run test:run -- LogView
```

- [ ] **Step 3: Add empty state to LogView**

```tsx
// src/components/weight-tracker/views/LogView.tsx
// Add import at top:
import { weekHasData } from '@/lib/weight-tracker/utils';
// (already imported — it's used for the week dots)

// In the component, compute whether the current week+tab has any data:
const hasData = workout.exercises.some((_, i) =>
  Array.from({ length: parseMaxSets(workout.exercises[i].sets) }, (__, s) =>
    logs[logKey(activeWeek, activeTab, i, s)]?.saved,
  ).some(Boolean),
);
```

Wait — `parseMaxSets` isn't imported in LogView. Add it to the import line:

```ts
import { getPhase, getRIR, weekHasData, computePRMap, parseMaxSets, logKey } from '@/lib/weight-tracker/utils';
```

Then add the empty state below the exercise list:

```tsx
{/* Empty state — shown when no sets are logged for this week+tab */}
{!hasData && (
  <div style={{ padding: '1.5rem 0 0', textAlign: 'center' }}>
    <div style={{ fontFamily: MONO, fontSize: '0.6875rem', color: '#333', letterSpacing: '0.04em' }}>
      Tap an exercise to start logging.
    </div>
  </div>
)}
```

Place this inside the `<div id={panel-${activeTab}>` div, after the `{workout.exercises.map(...)}` block.

- [ ] **Step 4: Run test to confirm it passes**

```bash
bun run test:run -- LogView
```

### Part B — Completed exercise visual indicator

- [ ] **Step 5: Write failing test**

```tsx
// src/components/weight-tracker/__tests__/ExerciseCard.test.tsx — new file
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExerciseCard from '../ExerciseCard';
import { WORKOUTS } from '@/lib/weight-tracker/data';

const exercise = WORKOUTS.push.exercises[0]; // 3-4 sets

const defaultProps = {
  exercise,
  exIdx: 0,
  week: 1,
  type: 'push' as const,
  logs: {},
  prMap: {},
  unit: 'kg' as const,
  onSave: () => {},
  onDelete: () => {},
};

describe('ExerciseCard', () => {
  it('does not show completed indicator when no sets are logged', () => {
    render(<ExerciseCard {...defaultProps} />);
    // No "All sets done" text or completed class
    expect(screen.queryByLabelText(/all sets done/i)).not.toBeInTheDocument();
  });

  it('shows completed indicator when all sets are logged', () => {
    const logs = {
      '1-push-0-0': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-1': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-2': { kg: 60, reps: 10, rir: 3, saved: true },
      '1-push-0-3': { kg: 60, reps: 10, rir: 3, saved: true },
    };
    render(<ExerciseCard {...defaultProps} logs={logs} />);
    expect(screen.getByLabelText(/all sets done/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to confirm it fails**

```bash
bun run test:run -- ExerciseCard
```

- [ ] **Step 7: Add completed indicator to ExerciseCard**

In `ExerciseCard.tsx`, the `savedCount` is already computed. Add a `complete` flag and update the expand button:

```tsx
// src/components/weight-tracker/ExerciseCard.tsx
// After the existing savedCount and bestE1RM lines, add:
const complete = savedCount >= maxSets;

// On the expand button element, add aria-label and a visual tick:
<button
  onClick={() => setOpen(o => !o)}
  aria-expanded={open}
  aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
  style={{ ... }} // existing styles unchanged
>
```

Then inside the button, after the progress blocks `<span>`, add the completed tick:

```tsx
{complete && (
  <span
    aria-label="All sets done"
    style={{
      fontFamily: MONO,
      fontSize: '0.625rem',
      color: ACCENT,
      marginLeft: '0.375rem',
      flexShrink: 0,
    }}
  >
    ✓
  </span>
)}
```

- [ ] **Step 8: Run test to confirm it passes**

```bash
bun run test:run -- ExerciseCard
```

- [ ] **Step 9: Commit**

```bash
git add src/components/weight-tracker/views/LogView.tsx src/components/weight-tracker/ExerciseCard.tsx src/components/weight-tracker/__tests__/LogView.test.tsx src/components/weight-tracker/__tests__/ExerciseCard.test.tsx
git commit -m "fix(pulse): add empty state for log view, completed indicator on ExerciseCard"
```

---

## Task 11: Body Weight Timezone Fix

**Audit ref:** U9 (ProfileView uses client local date, Supabase uses server UTC)

**Files:**
- Modify: `src/components/weight-tracker/views/ProfileView.tsx`

**Context:** `new Date().toLocaleDateString('en-CA')` returns the client's local date (e.g. "2026-05-26" in UTC+8 at 11pm UTC). `current_date` in Postgres returns the Supabase server's date (UTC). The fix: derive the date using `toISOString().slice(0, 10)` which always returns the UTC date, matching the server.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/weight-tracker/__tests__/ProfileView.test.tsx — add to existing describe block:
it('displays today in UTC format (YYYY-MM-DD)', () => {
  const utcDate = new Date().toISOString().slice(0, 10);
  render(<ProfileView {...defaultProps} />);
  expect(screen.getByText(utcDate)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to confirm its status**

```bash
bun run test:run -- ProfileView
```

This test likely already passes if local timezone is UTC. It will fail for UTC+ timezones near midnight. Run it regardless to establish a baseline.

- [ ] **Step 3: Fix the date derivation in ProfileView**

```tsx
// src/components/weight-tracker/views/ProfileView.tsx
// Change:
const today = new Date().toLocaleDateString('en-CA');
// To:
const today = new Date().toISOString().slice(0, 10);
```

- [ ] **Step 4: Run tests**

```bash
bun run test:run -- ProfileView
```

Expected: all ProfileView tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/weight-tracker/views/ProfileView.tsx
git commit -m "fix(pulse): use UTC date for body weight log timestamp to match server"
```

---

## Task 12: Test Coverage — ExerciseCard & ProfileView

**Audit ref:** Test coverage gaps

**Files:**
- Modify: `src/components/weight-tracker/__tests__/ExerciseCard.test.tsx` (expand from Task 10)
- Modify: `src/components/weight-tracker/__tests__/ProfileView.test.tsx` (expand from Task 9)

Tasks 9 and 10 already created these files and added initial tests. This task fills in the remaining gaps.

- [ ] **Step 1: Expand ExerciseCard tests**

```tsx
// src/components/weight-tracker/__tests__/ExerciseCard.test.tsx
// Add these tests to the existing describe block:

it('renders the exercise name', () => {
  render(<ExerciseCard {...defaultProps} />);
  expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
});

it('shows set/rep info when collapsed', () => {
  render(<ExerciseCard {...defaultProps} />);
  expect(screen.getByText(/3.4 sets/i)).toBeInTheDocument();
  // Note: exercise.sets is "3–4", exercise.reps is "8–12"
});

it('expands to show SetLogger rows when clicked', async () => {
  render(<ExerciseCard {...defaultProps} />);
  await userEvent.click(screen.getByRole('button', { name: /expand dumbbell bench press/i }));
  // Should show the save buttons for each set
  const saveButtons = screen.getAllByRole('button', { name: /save/i });
  expect(saveButtons.length).toBeGreaterThan(0);
});

it('calls onSave with the correct log key when a set is saved', async () => {
  const onSave = vi.fn();
  render(<ExerciseCard {...defaultProps} onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: /expand/i }));
  // Fill in and save the first set
  const kgInput = screen.getAllByRole('spinbutton', { name: /weight in kg/i })[0];
  const repsInput = screen.getAllByRole('spinbutton', { name: /repetitions/i })[0];
  await userEvent.type(kgInput, '60');
  await userEvent.type(repsInput, '10');
  await userEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
  expect(onSave).toHaveBeenCalledWith(
    '1-push-0-0',
    expect.objectContaining({ kg: 60, reps: 10, saved: true }),
  );
});
```

- [ ] **Step 2: Expand ProfileView tests**

```tsx
// src/components/weight-tracker/__tests__/ProfileView.test.tsx
// Import logBodyWeight and deleteBodyWeight mocks:
import { updateProfile, logBodyWeight, deleteBodyWeight } from '@/app/pulse/actions';

// Add these tests to the existing describe block:

it('renders initials from displayName', () => {
  render(<ProfileView {...defaultProps} displayName="John Doe" />);
  expect(screen.getByText('JD')).toBeInTheDocument();
});

it('renders first email letter as initials when displayName is null', () => {
  render(<ProfileView {...defaultProps} displayName={null} />);
  expect(screen.getByText('T')).toBeInTheDocument(); // 'test@example.com' → 'T'
});

it('calls onUnitChange and updateProfile when unit is toggled', async () => {
  const onUnitChange = vi.fn();
  render(<ProfileView {...defaultProps} onUnitChange={onUnitChange} />);
  await userEvent.click(screen.getByRole('button', { name: /lbs/i }));
  expect(onUnitChange).toHaveBeenCalledWith('lbs');
  expect(updateProfile).toHaveBeenCalledWith('Test User', 'lbs');
});

it('shows body weight entries in user unit', () => {
  const logs = [{ id: 'abc', logged_at: '2026-05-01', weight_kg: 80 }];
  render(<ProfileView {...defaultProps} bodyweightLogs={logs} />);
  expect(screen.getByText(/80 kg/i)).toBeInTheDocument();
});

it('calls deleteBodyWeight when delete button is clicked', async () => {
  vi.mocked(deleteBodyWeight).mockResolvedValue(undefined);
  const onBodyweightLogsChange = vi.fn();
  const logs = [{ id: 'abc-123', logged_at: '2026-05-01', weight_kg: 80 }];
  render(<ProfileView {...defaultProps} bodyweightLogs={logs} onBodyweightLogsChange={onBodyweightLogsChange} />);
  await userEvent.click(screen.getByRole('button', { name: /delete entry/i }));
  expect(onBodyweightLogsChange).toHaveBeenCalledWith([]);
  expect(deleteBodyWeight).toHaveBeenCalledWith('abc-123');
});

it('shows error when non-numeric weight is submitted', async () => {
  render(<ProfileView {...defaultProps} />);
  await userEvent.click(screen.getByRole('button', { name: /^log$/i }));
  expect(screen.getByText(/enter a valid weight/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run all tests**

```bash
bun run test:run
```

Expected: all tests pass. Fix any failures before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/weight-tracker/__tests__/ExerciseCard.test.tsx src/components/weight-tracker/__tests__/ProfileView.test.tsx
git commit -m "test(pulse): expand ExerciseCard and ProfileView test coverage"
```

---

## Final: Wrap Up

- [ ] **Run full type check**

```bash
bun run tsc --noEmit 2>&1 | grep -v "node_modules" | grep -v "Cannot find module 'vitest'" | grep -v "Cannot find module '@testing-library"
```

Expected: no errors in Pulse application files.

- [ ] **Run full test suite**

```bash
bun run test:run
```

Expected: all tests pass.

- [ ] **Push branch and open PR**

```bash
git push origin feature/profiles-bodyweight
# or if branching from main for these fixes:
git push origin fix/audit-fixes
```

---

## Self-Review

**Spec coverage check:**

| Audit Finding | Task | Covered? |
|---------------|------|----------|
| S1 Rate limiting | — | Not a code change — Supabase built-in; verify in dashboard |
| S2 display_name length | T3 | ✅ |
| S3 logBodyWeight validation | T3 | ✅ |
| S4 UUID validation | T3 | ✅ |
| S7 CSP header | T6 | ✅ |
| S8 noindex | T6 | ✅ |
| P1 Sequential DB calls | T4 | ✅ |
| P2 N+1 deletes | T4 | ✅ |
| P5 No loading.tsx | T5 | ✅ |
| P6 @vercel/kv unused | T1 | ✅ |
| C2 WORKOUTS type | T2 | ✅ |
| C3 Implicit any | T2 | ✅ |
| C4 useEffect comment | T2 | ✅ |
| U2 Name save feedback | T9 | ✅ |
| U3 Empty state | T10 | ✅ |
| U5 Timer persistence | T8 | ✅ |
| U6 Completed indicator | T10 | ✅ |
| U9 Timezone date | T11 | ✅ |
| D2 Length constraint | T7 | ✅ |
| D4 Index | T7 | ✅ |
| Test coverage | T12 | ✅ |
| Vitest TS types | T1 | ✅ |

**Not addressed (intentional):**
- S1 Rate limiting: Supabase Auth has built-in protection; verify it's enabled at `supabase.com/dashboard → Auth → Rate Limits`. No code change needed.
- C1 Duplicate week selector: design decision; both selectors serve different UX contexts (scrollable tab strip in Log vs. grouped phase blocks in Program).
- C6 TrackerClient size: acceptable at current scale.
- C7 buildHistory sort: works correctly; document only.
- U4 Calendar dates in history: needs a program start date field — Phase 5 scope.
- U7 Import JSON: Phase 5 scope.
- D3 logged_at date type: correct for use case.
- D5 updated_at trigger: low priority for personal app.
