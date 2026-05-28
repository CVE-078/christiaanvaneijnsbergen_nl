# DRY/SOLID Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated constants and markup patterns across the Pulse components by extracting a shared constants module, adding `as const` discriminant arrays to all string union types, creating a `<TabButton>` primitive shared by `DayTabs` and `WorkoutTabs`, adding a `<SectionLabel>` component for the repeated section-header pattern, and replacing hardcoded hex colors with design-token CSS classes.

**Architecture:** All changes are purely additive or internal — no data model or API changes. The `as const` arrays sit alongside existing string union type aliases, so downstream code that uses string literals is unaffected. The new `TabButton` and `SectionLabel` components wrap existing markup; their tests verify ARIA attributes and CSS classes independently of the views that consume them.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind v4, Vitest + Testing Library, bun

---

## File Map

| File | Action | Task |
|---|---|---|
| `src/lib/pulse/constants.ts` | Create | 1 |
| `src/lib/pulse/__tests__/constants.test.ts` | Create | 1 |
| `src/components/pulse/DayTabs.tsx` | Modify | 1, 3 |
| `src/components/pulse/WorkoutTabs.tsx` | Modify | 1, 3 |
| `src/components/pulse/OnboardingModal.tsx` | Modify | 1, 4 |
| `src/lib/pulse/types.ts` | Modify | 2 |
| `src/lib/pulse/recommendation.ts` | Modify | 2 |
| `src/components/pulse/TabButton.tsx` | Create | 3 |
| `src/components/pulse/__tests__/TabButton.test.tsx` | Create | 3 |
| `src/components/pulse/SectionLabel.tsx` | Create | 4 |
| `src/components/pulse/__tests__/SectionLabel.test.tsx` | Create | 4 |
| `src/components/pulse/views/ProgramView.tsx` | Modify | 4 |
| `src/components/pulse/views/ProfileView.tsx` | Modify | 4, 5 |
| `src/app/globals.css` | Modify | 5 |
| `src/components/pulse/AppShell.tsx` | Modify | 5 |

---

## Task 1: Shared Constants Module

**Files:**
- Create: `src/lib/pulse/constants.ts`
- Create: `src/lib/pulse/__tests__/constants.test.ts`
- Modify: `src/components/pulse/DayTabs.tsx`
- Modify: `src/components/pulse/WorkoutTabs.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`

**Context:** `DAY_NAMES` is defined identically in `DayTabs.tsx:6` and `OnboardingModal.tsx:12`. `WorkoutType → string` label maps are defined identically as `TYPE_LABEL` in `DayTabs.tsx:8` and `LABELS` in `WorkoutTabs.tsx:7`. `WORKOUT_TYPE_ORDER` is only in `WorkoutTabs.tsx:12`. `SUGGESTED_DAYS` and `EXPERIENCE_LEVEL_COLOR` are inline in `OnboardingModal.tsx`. Extracting all five to one module eliminates these duplications.

- [ ] **Step 1: Write the failing test**

Create `src/lib/pulse/__tests__/constants.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    DAY_NAMES,
    WORKOUT_TYPE_LABELS,
    WORKOUT_TYPE_ORDER,
    SUGGESTED_DAYS,
    EXPERIENCE_LEVEL_COLOR,
} from '../constants';

describe('DAY_NAMES', () => {
    it('has 7 entries', () => expect(DAY_NAMES).toHaveLength(7));
    it('starts with Sun at index 0', () => expect(DAY_NAMES[0]).toBe('Sun'));
    it('has Mon at index 1', () => expect(DAY_NAMES[1]).toBe('Mon'));
    it('has Sat at index 6', () => expect(DAY_NAMES[6]).toBe('Sat'));
});

describe('WORKOUT_TYPE_LABELS', () => {
    it('has 10 entries', () => expect(Object.keys(WORKOUT_TYPE_LABELS)).toHaveLength(10));
    it('push → Push', () => expect(WORKOUT_TYPE_LABELS.push).toBe('Push'));
    it('full_body → Full Body', () => expect(WORKOUT_TYPE_LABELS.full_body).toBe('Full Body'));
    it('upper → Upper', () => expect(WORKOUT_TYPE_LABELS.upper).toBe('Upper'));
});

describe('WORKOUT_TYPE_ORDER', () => {
    it('has 10 entries', () => expect(WORKOUT_TYPE_ORDER).toHaveLength(10));
    it('starts with push', () => expect(WORKOUT_TYPE_ORDER[0]).toBe('push'));
    it('ends with full_body', () => expect(WORKOUT_TYPE_ORDER[WORKOUT_TYPE_ORDER.length - 1]).toBe('full_body'));
});

describe('SUGGESTED_DAYS', () => {
    it('2-3 maps to [1,3]', () => expect(SUGGESTED_DAYS['2-3']).toEqual([1, 3]));
    it('4 maps to [1,2,4,5]', () => expect(SUGGESTED_DAYS['4']).toEqual([1, 2, 4, 5]));
    it('5-6 maps to [1,2,3,4,5]', () => expect(SUGGESTED_DAYS['5-6']).toEqual([1, 2, 3, 4, 5]));
});

describe('EXPERIENCE_LEVEL_COLOR', () => {
    it('beginner has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.beginner).toBe('string'));
    it('intermediate has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.intermediate).toBe('string'));
    it('advanced has a class string', () => expect(typeof EXPERIENCE_LEVEL_COLOR.advanced).toBe('string'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

```
bun run test src/lib/pulse/__tests__/constants.test.ts
```

Expected: FAIL — `Cannot find module '../constants'`

- [ ] **Step 3: Create `src/lib/pulse/constants.ts`**

```ts
import type { WorkoutType } from './types';
import type { DaysPerWeek, ExperienceLevel } from './recommendation';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
    upper: 'Upper', lower: 'Lower', full_body: 'Full Body',
};

export const WORKOUT_TYPE_ORDER: readonly WorkoutType[] = [
    'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'upper', 'lower', 'full_body',
];

export const SUGGESTED_DAYS: Record<DaysPerWeek, number[]> = {
    '2-3': [1, 3],
    '4':   [1, 2, 4, 5],
    '5-6': [1, 2, 3, 4, 5],
};

export const EXPERIENCE_LEVEL_COLOR: Record<ExperienceLevel, string> = {
    beginner:     'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced:     'text-red-400',
};
```

- [ ] **Step 4: Run the test to verify it passes**

```
bun run test src/lib/pulse/__tests__/constants.test.ts
```

Expected: PASS — 12 tests

- [ ] **Step 5: Update `DayTabs.tsx` to import from constants**

Replace:
```ts
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_LABEL: Record<WorkoutType, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
    upper: 'Upper', lower: 'Lower', full_body: 'Full Body',
};
```

With:
```ts
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
```

And in the JSX, replace:
- `TYPE_LABEL[entry.workout_type]` → `WORKOUT_TYPE_LABELS[entry.workout_type]`

Remove the `import type { WorkoutType }` line (no longer needed in DayTabs directly).

- [ ] **Step 6: Update `WorkoutTabs.tsx` to import from constants**

Replace:
```ts
const LABELS: Record<WorkoutType, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs',
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
    upper: 'Upper', lower: 'Lower', full_body: 'Full Body',
};
const ORDER: WorkoutType[] = ['push','pull','legs','chest','back','shoulders','arms','upper','lower','full_body'];
```

With:
```ts
import { WORKOUT_TYPE_LABELS, WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
```

And in the component:
- `const tabs = ORDER.filter(...)` → `const tabs = WORKOUT_TYPE_ORDER.filter(...)`
- `LABELS[type]` → `WORKOUT_TYPE_LABELS[type]`

Remove the `import type { WorkoutType }` line (still used for cast — keep it).

- [ ] **Step 7: Update `OnboardingModal.tsx` to import from constants**

Remove the local definitions:
```ts
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SUGGESTED_DAYS: Record<string, number[]> = {
    '2-3': [1, 3],
    '4':   [1, 2, 4, 5],
    '5-6': [1, 2, 3, 4, 5],
};
```

And the inline `LEVEL_CLASS` in the result screen:
```ts
const LEVEL_CLASS = { beginner: 'text-emerald-400', intermediate: 'text-amber-400', advanced: 'text-red-400' };
```

Add the import:
```ts
import { DAY_NAMES, SUGGESTED_DAYS, EXPERIENCE_LEVEL_COLOR } from '@/lib/pulse/constants';
```

Replace `LEVEL_CLASS[t.experience_level]` → `EXPERIENCE_LEVEL_COLOR[t.experience_level]`

The `SUGGESTED_DAYS` usage at line 184: `SUGGESTED_DAYS[days] ?? []` — with the typed version this always hits a key, so the `?? []` can stay as a safety guard.

- [ ] **Step 8: Run all tests and typecheck**

```
bun run test
bun run typecheck
```

Expected: all existing tests PASS, 0 typecheck errors

- [ ] **Step 9: Commit**

```
git add src/lib/pulse/constants.ts src/lib/pulse/__tests__/constants.test.ts src/components/pulse/DayTabs.tsx src/components/pulse/WorkoutTabs.tsx src/components/pulse/OnboardingModal.tsx
git commit -m "refactor: extract shared pulse constants module"
```

---

## Task 2: `as const` Discriminant Arrays

**Files:**
- Modify: `src/lib/pulse/types.ts`
- Modify: `src/lib/pulse/recommendation.ts`

**Context:** All Pulse string union types (`WorkoutType`, `View`, `EquipmentKey`, `ExerciseCategory`, `ExperienceLevel`, `Goal`, `DaysPerWeek`) are currently bare type aliases. Adding a `as const` array alongside each type keeps the type signature identical (no downstream changes), but provides a runtime-iterable array of valid values — useful for runtime validation, dropdowns, and exhaustiveness checks. This is the idiomatic TypeScript approach preferred over `enum` (which has tree-shaking and module isolation issues with `const enum`).

No new tests are needed: the types are unchanged and all existing tests cover the consuming code. Typecheck verifies correctness.

- [ ] **Step 1: Update `src/lib/pulse/types.ts`**

Replace the four bare union types with `as const` arrays + derived types:

```ts
// WorkoutType — replace lines 10-13
export const WORKOUT_TYPES = [
    'push', 'pull', 'legs',
    'chest', 'back', 'shoulders', 'arms',
    'upper', 'lower', 'full_body',
] as const;
export type WorkoutType = typeof WORKOUT_TYPES[number];

// View — replace line 74
export const VIEWS = ['log', 'program', 'history', 'profile', 'library'] as const;
export type View = typeof VIEWS[number];

// EquipmentKey — replace line 117
export const EQUIPMENT_KEYS = ['dumbbells', 'barbell', 'bench', 'cables', 'machines'] as const;
export type EquipmentKey = typeof EQUIPMENT_KEYS[number];

// ExerciseCategory — replace lines 78-82
export const EXERCISE_CATEGORIES = [
    'chest', 'shoulders', 'triceps',
    'back', 'biceps',
    'legs', 'glutes', 'calves',
    'abs', 'other',
] as const;
export type ExerciseCategory = typeof EXERCISE_CATEGORIES[number];
```

The rest of `types.ts` is unchanged — interfaces, functions, `Unit` type are all unaffected.

- [ ] **Step 2: Update `src/lib/pulse/recommendation.ts`**

Replace the three bare union types:

```ts
// ExperienceLevel — replace line 3
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

// DaysPerWeek — replace line 4
export const DAYS_PER_WEEK_OPTIONS = ['2-3', '4', '5-6'] as const;
export type DaysPerWeek = typeof DAYS_PER_WEEK_OPTIONS[number];

// Goal — replace line 5
export const GOALS = ['build_muscle', 'lose_fat', 'general_fitness'] as const;
export type Goal = typeof GOALS[number];
```

The rest of `recommendation.ts` is unchanged.

- [ ] **Step 3: Update `src/lib/pulse/constants.ts` — tighten the `WORKOUT_TYPE_ORDER` type**

Now that `WORKOUT_TYPES` exists in `types.ts`, update `constants.ts` to derive order from it for extra safety. Replace the `WORKOUT_TYPE_ORDER` declaration:

```ts
import { WORKOUT_TYPES } from './types';
import type { WorkoutType } from './types';
import type { DaysPerWeek, ExperienceLevel } from './recommendation';

// ... (DAY_NAMES, WORKOUT_TYPE_LABELS, SUGGESTED_DAYS, EXPERIENCE_LEVEL_COLOR unchanged)

export const WORKOUT_TYPE_ORDER: readonly WorkoutType[] = [
    'push', 'pull', 'legs', 'chest', 'back', 'shoulders', 'arms', 'upper', 'lower', 'full_body',
] as const;
```

Note: keep the explicit order in constants — WORKOUT_TYPES in types.ts defines valid members, WORKOUT_TYPE_ORDER defines display order. The type annotation ensures the list stays in sync with WorkoutType.

- [ ] **Step 4: Run typecheck and all tests**

```
bun run typecheck
bun run test
```

Expected: 0 errors, all tests PASS

- [ ] **Step 5: Commit**

```
git add src/lib/pulse/types.ts src/lib/pulse/recommendation.ts src/lib/pulse/constants.ts
git commit -m "refactor: add as-const discriminant arrays for all pulse string union types"
```

---

## Task 3: `<TabButton>` Shared Primitive

**Files:**
- Create: `src/components/pulse/TabButton.tsx`
- Create: `src/components/pulse/__tests__/TabButton.test.tsx`
- Modify: `src/components/pulse/WorkoutTabs.tsx`
- Modify: `src/components/pulse/DayTabs.tsx`

**Context:** `WorkoutTabs.tsx` and `DayTabs.tsx` both render `role="tab"` buttons with identical conditional active/inactive Tailwind classes and an identical `done/total` badge pattern. `TabButton` wraps these shared concerns (ARIA attributes, active-state classes, badge) while accepting a `className` prop for shape/layout differences (WorkoutTabs uses `rounded-full flex-row`, DayTabs uses `rounded-xl flex-col`) and `children` for inner content.

- [ ] **Step 1: Write the failing test**

Create `src/components/pulse/__tests__/TabButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabButton from '../TabButton';

describe('TabButton', () => {
    it('renders with role="tab"', () => {
        render(<TabButton id="t" active={false} controls="p" onClick={vi.fn()}>Push</TabButton>);
        expect(screen.getByRole('tab')).toBeInTheDocument();
    });

    it('sets id and aria-controls', () => {
        render(<TabButton id="tab-push" active={false} controls="panel-push" onClick={vi.fn()}>Push</TabButton>);
        const btn = screen.getByRole('tab');
        expect(btn).toHaveAttribute('id', 'tab-push');
        expect(btn).toHaveAttribute('aria-controls', 'panel-push');
    });

    it('aria-selected="true" when active', () => {
        render(<TabButton id="t" active={true} controls="p" onClick={vi.fn()}>Push</TabButton>);
        expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('aria-selected="false" when inactive', () => {
        render(<TabButton id="t" active={false} controls="p" onClick={vi.fn()}>Push</TabButton>);
        expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onClick when clicked', async () => {
        const handleClick = vi.fn();
        render(<TabButton id="t" active={false} controls="p" onClick={handleClick}>Push</TabButton>);
        await userEvent.click(screen.getByRole('tab'));
        expect(handleClick).toHaveBeenCalledOnce();
    });

    it('renders badge text when badge prop is provided', () => {
        render(<TabButton id="t" active={true} controls="p" onClick={vi.fn()} badge="2/3">Push</TabButton>);
        expect(screen.getByRole('tab')).toHaveTextContent('2/3');
    });

    it('does not render badge when badge prop is absent', () => {
        render(<TabButton id="t" active={false} controls="p" onClick={vi.fn()}>Push</TabButton>);
        expect(screen.getByRole('tab').textContent).toBe('Push');
    });

    it('forwards onKeyDown to the button element', async () => {
        const handleKeyDown = vi.fn();
        render(
            <TabButton id="t" active={true} controls="p" onClick={vi.fn()} onKeyDown={handleKeyDown}>
                Push
            </TabButton>,
        );
        screen.getByRole('tab').focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(handleKeyDown).toHaveBeenCalled();
    });

    it('merges extra className onto the button', () => {
        render(<TabButton id="t" active={false} controls="p" onClick={vi.fn()} className="rounded-full">Push</TabButton>);
        expect(screen.getByRole('tab').className).toContain('rounded-full');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```
bun run test src/components/pulse/__tests__/TabButton.test.tsx
```

Expected: FAIL — `Cannot find module '../TabButton'`

- [ ] **Step 3: Create `src/components/pulse/TabButton.tsx`**

```tsx
import type { ReactNode } from 'react';

interface TabButtonProps {
    id: string;
    active: boolean;
    controls: string;
    onClick: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    badge?: string;
    className?: string;
    children: ReactNode;
}

export default function TabButton({
    id,
    active,
    controls,
    onClick,
    onKeyDown,
    badge,
    className = '',
    children,
}: TabButtonProps) {
    return (
        <button
            role="tab"
            id={id}
            aria-selected={active}
            aria-controls={controls}
            onClick={onClick}
            onKeyDown={onKeyDown}
            className={`border cursor-pointer transition-all duration-150 ${
                active
                    ? 'bg-pulse-accent/10 border-pulse-accent/25 text-pulse-accent'
                    : 'bg-transparent border-pulse-border text-pulse-dim hover:text-pulse-text'
            } ${className}`}>
            {children}
            {badge != null && (
                <span className={`font-pulse text-[0.625rem] rounded-full px-1.5 py-0.5 ${
                    active ? 'bg-pulse-accent/15 text-pulse-accent' : 'bg-pulse-surface-2 text-pulse-dim'
                }`}>
                    {badge}
                </span>
            )}
        </button>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```
bun run test src/components/pulse/__tests__/TabButton.test.tsx
```

Expected: PASS — 9 tests

- [ ] **Step 5: Refactor `WorkoutTabs.tsx` to use `TabButton`**

Full replacement of `WorkoutTabs.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { WorkoutType } from '@/lib/pulse/types';
import { WORKOUT_TYPE_LABELS, WORKOUT_TYPE_ORDER } from '@/lib/pulse/constants';
import TabButton from './TabButton';

export default function WorkoutTabs() {
    const { activeTab, setActiveTab, routineExercisesByType, logs, activeWeek } = usePulse();
    const tabs = WORKOUT_TYPE_ORDER.filter((t) => routineExercisesByType[t] !== undefined);

    useEffect(() => {
        if (tabs.length > 0 && !tabs.includes(activeTab as WorkoutType)) {
            setActiveTab(tabs[0]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabs.join(',')]);

    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActiveTab(tabs[(idx + 1) % tabs.length]);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length]);
        }
    }

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3">
            {tabs.map((type, idx) => {
                const active = activeTab === type;
                const exercises = routineExercisesByType[type] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;
                return (
                    <TabButton
                        key={type}
                        id={`tab-${type}`}
                        active={active}
                        controls={`panel-${type}`}
                        onClick={() => setActiveTab(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="flex items-center gap-2 py-2 px-4 rounded-full">
                        <span className="font-pulse text-sm font-semibold">{WORKOUT_TYPE_LABELS[type]}</span>
                    </TabButton>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 6: Refactor `DayTabs.tsx` to use `TabButton`**

Full replacement of `DayTabs.tsx`:

```tsx
'use client';
import { usePulse } from '@/context/PulseContext';
import { logKey, parseMaxSets } from '@/lib/pulse/utils';
import { DAY_NAMES, WORKOUT_TYPE_LABELS } from '@/lib/pulse/constants';
import TabButton from './TabButton';

export default function DayTabs() {
    const { activeDay, setActiveDay, activeSchedule, activeWeek, logs, routineExercisesByType } = usePulse();
    const today = new Date().getDay();

    return (
        <div role="tablist" className="flex items-center gap-1.5 p-4 pb-3 overflow-x-auto [scrollbar-width:none]">
            {activeSchedule.map((entry) => {
                const active = activeDay === entry.day_of_week;
                const isToday = entry.day_of_week === today;
                const exercises = routineExercisesByType[entry.workout_type] ?? [];
                const done = exercises.filter((re) => {
                    const maxSets = parseMaxSets(re.sets);
                    return Array.from({ length: maxSets }, (_, s) => logKey(activeWeek, re.id, s)).every(
                        (k) => logs[k]?.saved,
                    );
                }).length;
                const total = exercises.length;

                return (
                    <TabButton
                        key={entry.day_of_week}
                        id={`tab-day-${entry.day_of_week}`}
                        active={active}
                        controls={`panel-${entry.workout_type}`}
                        onClick={() => setActiveDay(entry.day_of_week)}
                        badge={total > 0 ? `${done}/${total}` : undefined}
                        className="relative flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl shrink-0">
                        <span className="font-pulse text-sm font-semibold">{DAY_NAMES[entry.day_of_week]}</span>
                        <span className={`font-pulse text-[0.625rem] tracking-[0.04em] ${active ? 'text-pulse-accent' : 'text-pulse-muted'}`}>
                            {WORKOUT_TYPE_LABELS[entry.workout_type]}
                        </span>
                        {isToday && (
                            <span aria-label="today" className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-pulse-accent" />
                        )}
                    </TabButton>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 7: Run all tests and typecheck**

```
bun run test
bun run typecheck
```

Expected: all tests PASS (WorkoutTabs and DayTabs tests test behavior, not implementation — they pass unchanged), 0 typecheck errors

- [ ] **Step 8: Commit**

```
git add src/components/pulse/TabButton.tsx src/components/pulse/__tests__/TabButton.test.tsx src/components/pulse/WorkoutTabs.tsx src/components/pulse/DayTabs.tsx
git commit -m "refactor: extract TabButton shared primitive from WorkoutTabs and DayTabs"
```

---

## Task 4: `<SectionLabel>` Component

**Files:**
- Create: `src/components/pulse/SectionLabel.tsx`
- Create: `src/components/pulse/__tests__/SectionLabel.test.tsx`
- Modify: `src/components/pulse/views/ProgramView.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`
- Modify: `src/components/pulse/OnboardingModal.tsx`

**Context:** The class string `font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted` appears 5 times across `ProgramView.tsx` (lines 34, 52) and `ProfileView.tsx` (lines 203, 220, 233). Extracting it into a component eliminates the repetition and ensures consistent heading styles across sections.

- [ ] **Step 1: Write the failing test**

Create `src/components/pulse/__tests__/SectionLabel.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionLabel from '../SectionLabel';

describe('SectionLabel', () => {
    it('renders children as text content', () => {
        render(<SectionLabel>Weekly Volume</SectionLabel>);
        expect(screen.getByText('Weekly Volume')).toBeInTheDocument();
    });

    it('applies font-pulse class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('font-pulse');
    });

    it('applies uppercase class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('uppercase');
    });

    it('applies text-pulse-muted class', () => {
        render(<SectionLabel>Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('text-pulse-muted');
    });

    it('merges additional className', () => {
        render(<SectionLabel className="mb-2">Test</SectionLabel>);
        expect(screen.getByText('Test').className).toContain('mb-2');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```
bun run test src/components/pulse/__tests__/SectionLabel.test.tsx
```

Expected: FAIL — `Cannot find module '../SectionLabel'`

- [ ] **Step 3: Create `src/components/pulse/SectionLabel.tsx`**

```tsx
import type { ReactNode } from 'react';

interface SectionLabelProps {
    children: ReactNode;
    className?: string;
}

export default function SectionLabel({ children, className }: SectionLabelProps) {
    return (
        <div className={`font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted${className ? ` ${className}` : ''}`}>
            {children}
        </div>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```
bun run test src/components/pulse/__tests__/SectionLabel.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Update `ProgramView.tsx`**

Add import at the top of `ProgramView.tsx`:
```ts
import SectionLabel from '../SectionLabel';
```

Replace the two inline section-label divs:

```tsx
// Line 34-36 — "Weekly Volume" header
// Replace:
<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
    Weekly Volume
</div>
// With:
<SectionLabel className="mb-2">Weekly Volume</SectionLabel>

// Line 52-54 — "Weekly Schedule" header
// Replace:
<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
    Weekly Schedule
</div>
// With:
<SectionLabel className="mb-2">Weekly Schedule</SectionLabel>
```

- [ ] **Step 6: Update `ProfileView.tsx`**

Add import at the top of `ProfileView.tsx`:
```ts
import SectionLabel from '../SectionLabel';
```

Replace the three inline section-label divs:

```tsx
// Line 203-205 — "Weight Unit"
// Replace:
<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
    Weight Unit
</div>
// With:
<SectionLabel className="mb-2">Weight Unit</SectionLabel>

// Line 220-222 — "Routine"
// Replace:
<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
    Routine
</div>
// With:
<SectionLabel className="mb-2">Routine</SectionLabel>

// Line 233-235 — "Body Weight"
// Replace:
<div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-3">
    Body Weight
</div>
// With:
<SectionLabel className="mb-3">Body Weight</SectionLabel>
```

- [ ] **Step 7: Run all tests and typecheck**

```
bun run test
bun run typecheck
```

Expected: all tests PASS, 0 typecheck errors

- [ ] **Step 8: Commit**

```
git add src/components/pulse/SectionLabel.tsx src/components/pulse/__tests__/SectionLabel.test.tsx src/components/pulse/views/ProgramView.tsx src/components/pulse/views/ProfileView.tsx
git commit -m "refactor: extract SectionLabel component for repeated section-header pattern"
```

---

## Task 5: CSS Tokens for Error and Success Colors

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/pulse/AppShell.tsx`
- Modify: `src/components/pulse/views/ProfileView.tsx`

**Context:** The hex color `#f43f5e` (error / rose-500) appears hardcoded in `AppShell.tsx:57` (`bg-[#f43f5e18]`, `border-[#f43f5e33]`, `text-[#f43f5e]`) and `ProfileView.tsx:254,258` (`border-[#f43f5e]`, `text-[#f43f5e]`). The success green `#4ade80` appears in `ProfileView.tsx:194`. Adding CSS tokens for these removes the magic values and makes them easy to retheme. No new tests needed — CSS classes are verified by `bun run build`.

- [ ] **Step 1: Add tokens to `src/app/globals.css`**

In the `@theme` block, after `--color-pulse-muted: #2c3445;`, add:

```css
--color-pulse-error: #f43f5e;
--color-pulse-success: #4ade80;
```

Full updated `@theme` block:
```css
@theme {
    --color-primary: #222831;
    --color-secondary: #00adb5;
    --color-gray-dark: #010101;
    --color-gray: #eeeeee;

    --container-15: 15;

    --text-xxs: 10px;

    /* Pulse design tokens */
    --font-pulse: 'Outfit', sans-serif;
    --color-pulse-accent: #3ecf8e;
    --color-pulse-bg: #0b0d12;
    --color-pulse-surface: #131720;
    --color-pulse-surface-2: #1a1f2e;
    --color-pulse-border: rgba(255,255,255,0.06);
    --color-pulse-dim: #5e6a80;
    --color-pulse-muted: #2c3445;
    --color-pulse-text: #eef0f6;
    --color-pulse-error: #f43f5e;
    --color-pulse-success: #4ade80;
}
```

- [ ] **Step 2: Update `AppShell.tsx`**

Replace the save-error banner at line 54-59:

```tsx
// Replace:
{saveError && (
    <div
        role="alert"
        className="py-2 px-4 bg-[#f43f5e18] border-b border-[#f43f5e33] text-[#f43f5e] font-pulse text-[0.8125rem] tracking-[0.04em] text-center">
        {saveError}
    </div>
)}
// With:
{saveError && (
    <div
        role="alert"
        className="py-2 px-4 bg-pulse-error/10 border-b border-pulse-error/20 text-pulse-error font-pulse text-[0.8125rem] tracking-[0.04em] text-center">
        {saveError}
    </div>
)}
```

- [ ] **Step 3: Update `ProfileView.tsx`**

Replace the three hardcoded hex color usages:

```tsx
// Line 194 — "Saved ✓" success label
// Replace:
<span className="font-pulse text-[0.6875rem] text-[#4ade80] tracking-[0.04em] mt-0.5 block">
// With:
<span className="font-pulse text-[0.6875rem] text-pulse-success tracking-[0.04em] mt-0.5 block">

// Line 254 — bodyweight input error border
// Replace:
className={`w-[5.5rem] py-[0.375rem] px-2 bg-pulse-bg rounded-[3px] text-white font-pulse text-[0.9375rem] outline-none border ${bwError ? 'border-[#f43f5e]' : 'border-pulse-border'}`}
// With:
className={`w-[5.5rem] py-[0.375rem] px-2 bg-pulse-bg rounded-[3px] text-white font-pulse text-[0.9375rem] outline-none border ${bwError ? 'border-pulse-error' : 'border-pulse-border'}`}

// Line 258 — bodyweight error message text
// Replace:
{bwError && <div className="font-pulse text-[0.75rem] text-[#f43f5e] mt-1">{bwError}</div>}
// With:
{bwError && <div className="font-pulse text-[0.75rem] text-pulse-error mt-1">{bwError}</div>}
```

- [ ] **Step 4: Build to verify CSS tokens resolve correctly**

```
bun run build
```

Expected: build succeeds with no errors

- [ ] **Step 5: Run all tests and typecheck**

```
bun run test
bun run typecheck
```

Expected: all tests PASS, 0 typecheck errors

- [ ] **Step 6: Commit**

```
git add src/app/globals.css src/components/pulse/AppShell.tsx src/components/pulse/views/ProfileView.tsx
git commit -m "refactor: add pulse-error and pulse-success CSS tokens, replace hardcoded hex colors"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Shared constants module — DAY_NAMES, WORKOUT_TYPE_LABELS, WORKOUT_TYPE_ORDER, SUGGESTED_DAYS, EXPERIENCE_LEVEL_COLOR extracted and all three consumers updated
- ✅ `as const` arrays for WorkoutType, View, EquipmentKey, ExerciseCategory, ExperienceLevel, Goal, DaysPerWeek
- ✅ `<TabButton>` eliminates duplicated tab-button markup and active-state class logic from WorkoutTabs and DayTabs
- ✅ `<SectionLabel>` eliminates 5 identical class-string div usages across ProgramView and ProfileView
- ✅ Error and success CSS tokens replace all 5 hardcoded hex color occurrences

**Placeholder scan:** No TBDs, no "add appropriate error handling", no steps without code.

**Type consistency:**
- `WORKOUT_TYPE_LABELS` is typed `Record<WorkoutType, string>` and used as such in DayTabs and WorkoutTabs
- `TabButton`'s `badge` prop is `string | undefined` — callers pass `total > 0 ? \`${done}/${total}\` : undefined` which matches
- `SectionLabel`'s `className` is `string | undefined` — callers pass `"mb-2"` or `"mb-3"` which matches
- `WORKOUT_TYPE_ORDER` in constants.ts is typed `readonly WorkoutType[]` — the `.filter()` call in WorkoutTabs returns `WorkoutType[]` which is compatible
