# Pulse Tailwind Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `style={{}}` inline objects in `src/components/pulse/` with Tailwind utility classes, then delete `src/lib/pulse/theme.ts`.

**Architecture:** Add pulse design-token CSS custom properties to `globals.css` `@theme`, then migrate each component file one at a time. Dynamic values that depend on runtime calculations (progress bar widths, volume bar heights) stay as inline styles. After all components are migrated, delete `theme.ts` and remove its imports.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind CSS v4 (`@import 'tailwindcss'`, `@theme` block in `globals.css`, no `tailwind.config.ts`), `prettier-plugin-tailwindcss` for class sorting, Vitest + Testing Library.

---

## File Map

| File | Action |
|------|--------|
| `src/app/globals.css` | Modify — add pulse `@theme` tokens; in Task 11 remove legacy CSS rules |
| `src/components/pulse/WorkoutTabs.tsx` | Modify — replace inline styles |
| `src/components/pulse/WeekSelector.tsx` | Modify — replace inline styles |
| `src/components/pulse/ExerciseCard.tsx` | Modify — replace inline styles (progress bar width stays inline) |
| `src/components/pulse/SetLogger.tsx` | Modify — replace inline styles (opacity stays inline) |
| `src/components/pulse/RestTimer.tsx` | Modify — replace inline styles (progress bar `width` stays inline) |
| `src/components/pulse/views/LogView.tsx` | Modify — replace inline styles |
| `src/components/pulse/views/HistoryView.tsx` | Modify — replace inline styles |
| `src/components/pulse/views/ProgramView.tsx` | Modify — replace inline styles (volume bar `height` stays inline) |
| `src/components/pulse/views/ProfileView.tsx` | Modify — replace inline styles; SVG `fill`/`stroke` → `var(--color-pulse-accent)` |
| `src/components/pulse/AppShell.tsx` | Modify — replace inline styles; hamburger responsive classes → Tailwind `sm:` variants |
| `src/lib/pulse/theme.ts` | **Delete** — all values now live in `@theme` |

---

## Task 1: Add pulse tokens to `@theme`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add pulse tokens to the `@theme` block**

Open `src/app/globals.css`. Replace the entire file with:

```css
@import 'tailwindcss';

@theme {
    --color-primary: #222831;
    --color-secondary: #00adb5;
    --color-gray-dark: #010101;
    --color-gray: #eeeeee;

    --container-15: 15;

    --text-xxs: 10px;

    /* Pulse design tokens */
    --font-pulse: 'JetBrains Mono', 'Courier New', monospace;
    --color-pulse-accent: #ff6c2f;
    --color-pulse-bg: #0a0a0a;
    --color-pulse-surface: #141414;
    --color-pulse-border: #1f1f1f;
    --color-pulse-dim: #555555;
    --color-pulse-muted: #3a3a3a;
    --color-pulse-text: #d4d4d4;
}

:focus-visible {
    outline: 2px solid #00adb5;
    outline-offset: 2px;
}

/* Pulse tracker responsive nav — inline display styles must not be set on
   these elements or they will override the media query rules below */
.pulse-desktop-nav { display: contents; }
.pulse-hamburger   { display: none !important; }

@media (max-width: 639px) {
  .pulse-desktop-nav { display: none !important; }
  .pulse-hamburger   { display: flex !important; }
}
```

This registers the following Tailwind utilities:
- `font-pulse` → `font-family: 'JetBrains Mono', 'Courier New', monospace`
- `text-pulse-accent` / `bg-pulse-accent` / `border-pulse-accent` → `#ff6c2f`
- `bg-pulse-bg` → `#0a0a0a`
- `bg-pulse-surface` → `#141414`
- `border-pulse-border` → `#1f1f1f`
- `text-pulse-dim` → `#555`
- `text-pulse-muted` / `bg-pulse-muted` / `border-pulse-muted` → `#3a3a3a`
- `text-pulse-text` → `#d4d4d4`

Opacity variants work automatically: `bg-pulse-accent/10` = 10% opacity, `/20`, `/25`, `/60`, `/70` etc.

- [ ] **Step 2: Run typecheck to confirm no breakage**

```powershell
bun run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```powershell
git add src/app/globals.css
git commit -m "feat(pulse): add pulse design tokens to Tailwind @theme"
```

---

## Task 2: `WorkoutTabs.tsx`

**Files:**
- Modify: `src/components/pulse/WorkoutTabs.tsx`

- [ ] **Step 1: Run existing tests as baseline**

```powershell
bun run test:run -- WorkoutTabs
```

Expected: all pass.

- [ ] **Step 2: Replace the file contents**

```tsx
'use client';
import type { WorkoutType } from '@/lib/pulse/types';

interface Props {
    activeTab: WorkoutType;
    onSelect: (t: WorkoutType) => void;
}

const TABS: { type: WorkoutType; label: string }[] = [
    { type: 'push', label: 'Push' },
    { type: 'pull', label: 'Pull' },
    { type: 'legs', label: 'Legs' },
];

export default function WorkoutTabs({ activeTab, onSelect }: Props) {
    function handleKeyDown(e: React.KeyboardEvent, idx: number) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSelect(TABS[(idx + 1) % TABS.length].type);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSelect(TABS[(idx - 1 + TABS.length) % TABS.length].type);
        }
    }

    return (
        <div role="tablist" className="flex border-b border-pulse-border">
            {TABS.map(({ type, label }, idx) => {
                const active = activeTab === type;
                return (
                    <button
                        key={type}
                        role="tab"
                        id={`tab-${type}`}
                        aria-selected={active}
                        aria-controls={`panel-${type}`}
                        onClick={() => onSelect(type)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`flex-1 py-3.5 text-center font-pulse text-[0.6875rem] tracking-[0.12em] uppercase bg-transparent border-0 border-b-2 -mb-px cursor-pointer ${
                            active ? 'text-white border-pulse-accent' : 'text-pulse-dim border-transparent'
                        }`}>
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 3: Run tests to confirm they still pass**

```powershell
bun run test:run -- WorkoutTabs
```

Expected: all pass.

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/WorkoutTabs.tsx
git commit -m "refactor(pulse): migrate WorkoutTabs to Tailwind"
```

---

## Task 3: `WeekSelector.tsx`

**Files:**
- Modify: `src/components/pulse/WeekSelector.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client';
import { PHASES } from '@/lib/pulse/data';
import { weekHasData } from '@/lib/pulse/utils';
import type { Logs } from '@/lib/pulse/types';

interface Props {
    activeWeek: number;
    onSelect: (w: number) => void;
    logs: Logs;
}

export default function WeekSelector({ activeWeek, onSelect, logs }: Props) {
    return (
        <div className="flex flex-col gap-4">
            {PHASES.map((phase) => (
                <div key={phase.label}>
                    <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                        {phase.label} · {phase.subtitle}
                    </div>
                    <div className="flex gap-1.5">
                        {phase.weeks.map((w) => {
                            const active = activeWeek === w;
                            return (
                                <button
                                    key={w}
                                    onClick={() => onSelect(w)}
                                    className={`flex-1 pt-2 pb-1.5 px-2 rounded-sm cursor-pointer font-pulse text-[0.8125rem] font-bold border transition-all duration-[120ms] ${
                                        active
                                            ? 'bg-pulse-accent text-black border-pulse-accent'
                                            : 'bg-pulse-surface text-pulse-dim border-pulse-border'
                                    }`}>
                                    {w}
                                    <span
                                        className={`block w-1 h-1 rounded-full mx-auto mt-0.5 ${
                                            weekHasData(w, logs)
                                                ? active
                                                    ? 'bg-black'
                                                    : 'bg-pulse-accent'
                                                : 'bg-transparent'
                                        }`}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Run full test suite**

```powershell
bun run test:run
```

Expected: all pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pulse/WeekSelector.tsx
git commit -m "refactor(pulse): migrate WeekSelector to Tailwind"
```

---

## Task 4: `ExerciseCard.tsx`

**Files:**
- Modify: `src/components/pulse/ExerciseCard.tsx`

Progress bar width (`width: \`${(savedCount / maxSets) * 100}%\``) **must stay inline** — it's a runtime-computed value.

- [ ] **Step 1: Run existing tests as baseline**

```powershell
bun run test:run -- ExerciseCard
```

Expected: all pass.

- [ ] **Step 2: Replace the file contents**

```tsx
'use client';
import { useState } from 'react';
import { logKey, parseMaxSets, calcE1RM } from '@/lib/pulse/utils';
import SetLogger from './SetLogger';
import type { Exercise, Logs, LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    exercise: Exercise;
    exIdx: number;
    week: number;
    type: WorkoutType;
    logs: Logs;
    prMap: Record<string, number>;
    unit: Unit;
    onSave: (key: string, entry: LogEntry) => void;
    onDelete: (key: string) => void;
}

export default function ExerciseCard({ exercise, exIdx, week, type, logs, prMap, unit, onSave, onDelete }: Props) {
    const [open, setOpen] = useState(false);
    const maxSets = parseMaxSets(exercise.sets);
    const savedCount = Array.from({ length: maxSets }, (_, i) => logKey(week, type, exIdx, i)).filter(
        (k) => logs[k]?.saved,
    ).length;
    const complete = savedCount >= maxSets;
    const bestE1RM = prMap[`${type}-${exIdx}`] ?? 0;

    return (
        <div className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${exercise.name}${complete ? ' — all sets done' : ''}`}
                className="w-full py-3.5 px-4 bg-transparent border-none cursor-pointer flex items-center gap-4 text-left">
                <span className="font-pulse text-[1.75rem] font-bold text-[#222] leading-none w-9 shrink-0 tracking-[-0.04em] select-none">
                    {String(exIdx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-[0.9375rem] truncate">
                        {exercise.name}
                    </div>
                    <div className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim mt-1 uppercase">
                        {exercise.sets} sets · {exercise.reps} reps
                    </div>
                </div>
                <span className="font-pulse text-[0.875rem] tracking-[0.05em] shrink-0">
                    {Array.from({ length: maxSets }, (_, i) => (
                        <span key={i} className={i < savedCount ? 'text-pulse-accent' : 'text-pulse-muted'}>
                            {i < savedCount ? '█' : '░'}
                        </span>
                    ))}
                </span>
                {complete && (
                    <span
                        aria-label="All sets done"
                        className="font-pulse text-[0.625rem] text-pulse-accent ml-1.5 shrink-0">
                        ✓
                    </span>
                )}
            </button>

            {open && (
                <div className="border-t border-pulse-border px-4 pt-1 pb-3.5">
                    <p className="font-pulse text-[0.6875rem] text-pulse-dim pt-[0.625rem] pb-1.5 leading-[1.6]">
                        {exercise.load} · {exercise.note}
                    </p>
                    {Array.from({ length: maxSets }, (_, i) => {
                        const entry = logs[logKey(week, type, exIdx, i)];
                        const isPR = !!(entry?.saved && bestE1RM > 0 && calcE1RM(entry.kg, entry.reps) >= bestE1RM);
                        const prevEntry = week > 1 ? logs[logKey(week - 1, type, exIdx, i)] : undefined;
                        return (
                            <SetLogger
                                key={`${week}-${i}`}
                                setIdx={i}
                                week={week}
                                type={type}
                                entry={entry}
                                previousEntry={prevEntry?.saved ? prevEntry : undefined}
                                isPR={isPR}
                                unit={unit}
                                onSave={(e) => onSave(logKey(week, type, exIdx, i), e)}
                                onDelete={() => onDelete(logKey(week, type, exIdx, i))}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Run tests to confirm they still pass**

```powershell
bun run test:run -- ExerciseCard
```

Expected: all pass.

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/ExerciseCard.tsx
git commit -m "refactor(pulse): migrate ExerciseCard to Tailwind"
```

---

## Task 5: `SetLogger.tsx`

**Files:**
- Modify: `src/components/pulse/SetLogger.tsx`

`opacity: saved && !editing ? 0.55 : 1` stays inline — arbitrary per-instance runtime value.

- [ ] **Step 1: Run existing tests as baseline**

```powershell
bun run test:run -- SetLogger
```

Expected: all pass.

- [ ] **Step 2: Replace the file contents**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getRIR, computeSuggestion, toDisplay, toKg, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import type { LogEntry, WorkoutType, Unit } from '@/lib/pulse/types';

interface Props {
    setIdx: number;
    week: number;
    type: WorkoutType;
    entry: LogEntry | undefined;
    previousEntry?: LogEntry;
    isPR?: boolean;
    unit: Unit;
    onSave: (entry: LogEntry) => void;
    onDelete?: () => void;
}

const inputClass =
    'w-[3.75rem] py-1.5 px-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-sm text-white font-pulse text-[0.8125rem] text-center outline-none';

export default function SetLogger({ setIdx, week, entry, previousEntry, isPR, unit, onSave, onDelete }: Props) {
    const suggestion = computeSuggestion(previousEntry, week);

    function initKg() {
        if (entry?.kg !== undefined) return String(toDisplay(entry.kg, unit));
        if (suggestion !== null) return String(toDisplay(suggestion, unit));
        return '';
    }

    const [kg, setKg] = useState(initKg);
    const [reps, setReps] = useState(entry?.reps?.toString() ?? '');
    const [editing, setEditing] = useState(false);
    const targetRIR = getRIR(week);
    const saved = entry?.saved ?? false;

    useEffect(() => {
        if (!saved || editing) {
            const base = entry?.kg ?? (suggestion !== null ? suggestion : null);
            if (base !== null) setKg(String(toDisplay(base, unit)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit]);

    const displayMin = toDisplay(MIN_KG, unit);
    const displayMax = toDisplay(MAX_KG, unit);
    const displayStep = unit === 'lbs' ? 1 : 0.5;

    function handleSave() {
        const displayNum = parseFloat(kg);
        const repsNum = parseInt(reps, 10);
        if (isNaN(displayNum) || displayNum <= 0) return;
        const kgNum = toKg(displayNum, unit);
        if (kgNum <= 0 || kgNum > MAX_KG) return;
        if (!repsNum || repsNum < 1 || repsNum > 100) return;
        onSave({ kg: kgNum, reps: repsNum, rir: targetRIR, saved: true });
        setEditing(false);
    }

    function handleEdit() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(true);
    }

    function handleCancel() {
        setKg(entry?.kg !== undefined ? String(toDisplay(entry.kg, unit)) : '');
        setReps(entry?.reps?.toString() ?? '');
        setEditing(false);
    }

    const showInputs = !saved || editing;

    return (
        <div
            className="flex items-center gap-2 py-[0.4375rem] border-b border-[#111]"
            style={{ opacity: saved && !editing ? 0.55 : 1 }}>
            <span className="font-pulse text-[0.6875rem] text-pulse-muted w-6 shrink-0">
                {String(setIdx + 1).padStart(2, '0')}
            </span>

            {showInputs ? (
                <>
                    <input
                        type="number"
                        aria-label={`Weight in ${unit}`}
                        placeholder={unit}
                        value={kg}
                        min={displayMin}
                        max={displayMax}
                        step={displayStep}
                        onChange={(e) => setKg(e.target.value)}
                        className={inputClass}
                    />
                    <span className="font-pulse text-pulse-muted text-xs">×</span>
                    <input
                        type="number"
                        aria-label="Repetitions"
                        placeholder="reps"
                        value={reps}
                        min={1}
                        max={100}
                        onChange={(e) => setReps(e.target.value)}
                        className={inputClass}
                    />
                    <span className="font-pulse text-[0.6875rem] text-pulse-dim shrink-0">
                        {targetRIR} RIR
                    </span>
                    {previousEntry && (
                        <span className="font-pulse text-[0.5625rem] text-[#444] tracking-[0.04em] whitespace-nowrap shrink-0">
                            → {toDisplay(previousEntry.kg, unit)} {unit} × {previousEntry.reps}
                        </span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                        {editing && (
                            <button
                                onClick={handleCancel}
                                className="font-pulse text-[0.625rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border border-pulse-border rounded-sm py-1 px-2 cursor-pointer shrink-0">
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className="font-pulse text-[0.625rem] tracking-[0.06em] uppercase py-1 px-2.5 bg-transparent border border-[#3a3a3a] rounded-sm text-[#aaa] cursor-pointer shrink-0">
                            {editing ? 'Update' : 'Save'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <span className="font-pulse text-[0.8125rem] text-pulse-text">
                        {toDisplay(entry!.kg, unit)} {unit} × {entry!.reps}
                    </span>
                    {isPR && (
                        <span className="font-pulse text-[0.5rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                            PR
                        </span>
                    )}
                    <span className="font-pulse text-[0.6875rem] text-pulse-dim">{entry!.rir} RIR</span>
                    <div className="ml-auto flex items-center gap-2">
                        <span className="font-pulse text-xs text-pulse-accent">✓</span>
                        <button
                            onClick={handleEdit}
                            className="font-pulse text-[0.625rem] tracking-[0.06em] uppercase text-pulse-dim bg-transparent border-none cursor-pointer p-0">
                            Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="font-pulse text-[0.625rem] text-[#444] bg-transparent border-none cursor-pointer p-0">
                                ✕
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Run tests to confirm they still pass**

```powershell
bun run test:run -- SetLogger
```

Expected: all pass.

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/SetLogger.tsx
git commit -m "refactor(pulse): migrate SetLogger to Tailwind"
```

---

## Task 6: `RestTimer.tsx`

**Files:**
- Modify: `src/components/pulse/RestTimer.tsx`

Progress bar `width: \`${pct * 100}%\`` **must stay inline** — runtime-computed value.

- [ ] **Step 1: Replace the file contents**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

const DURATIONS = [60, 90, 120, 180];
const DEFAULT_IDX = 1;

interface Props {
    trigger: number;
}

function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function beep() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch {
        // AudioContext unavailable (SSR or restricted browser)
    }
}

export default function RestTimer({ trigger }: Props) {
    const [durationIdx, setDurationIdx] = useState(() => {
        if (typeof window === 'undefined') return DEFAULT_IDX;
        const raw = localStorage.getItem('pulse_timer_idx') ?? localStorage.getItem('wt_timer_idx');
        const stored = raw !== null ? Number(raw) : -1;
        return stored >= 0 && stored < DURATIONS.length ? stored : DEFAULT_IDX;
    });
    const [remaining, setRemaining] = useState<number | null>(null);
    const totalRef = useRef(DURATIONS[durationIdx]);

    useEffect(() => {
        if (trigger === 0) return;
        totalRef.current = DURATIONS[durationIdx];
        setRemaining(DURATIONS[durationIdx]);
    }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        localStorage.setItem('pulse_timer_idx', String(durationIdx));
    }, [durationIdx]);

    useEffect(() => {
        if (remaining === null || remaining <= 0) {
            if (remaining === 0) {
                beep();
                const t = setTimeout(() => setRemaining(null), 2000);
                return () => clearTimeout(t);
            }
            return;
        }
        const id = setTimeout(() => setRemaining((r) => (r ?? 1) - 1), 1000);
        return () => clearTimeout(id);
    }, [remaining]);

    function skip() {
        setRemaining(null);
    }

    function addTime() {
        totalRef.current += 30;
        setRemaining((r) => (r ?? 0) + 30);
    }

    function cycleDuration() {
        const nextIdx = (durationIdx + 1) % DURATIONS.length;
        setDurationIdx(nextIdx);
        if (remaining !== null) {
            const delta = DURATIONS[nextIdx] - DURATIONS[durationIdx];
            totalRef.current = DURATIONS[nextIdx];
            setRemaining((r) => Math.max(0, (r ?? 0) + delta));
        }
    }

    if (remaining === null) return null;

    const done = remaining === 0;
    const pct = Math.max(0, remaining / totalRef.current);

    return (
        <div className="border-b border-pulse-border bg-pulse-surface overflow-hidden">
            <div className="flex items-center gap-3 py-2 px-4">
                <span
                    className={`font-pulse text-[0.625rem] tracking-[0.12em] uppercase ${done ? 'text-pulse-accent' : 'text-pulse-dim'}`}>
                    {done ? 'Go!' : 'Rest'}
                </span>
                <span
                    className={`font-pulse text-base font-bold tracking-[0.04em] min-w-[2.75rem] ${done ? 'text-pulse-accent' : 'text-white'}`}>
                    {fmt(remaining)}
                </span>
                <div className="ml-auto flex gap-2 items-center">
                    {!done && (
                        <button
                            onClick={addTime}
                            aria-label="Add 30 seconds"
                            className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim bg-transparent border border-[#2a2a2a] rounded-sm py-[0.2rem] px-[0.4rem] cursor-pointer">
                            +30s
                        </button>
                    )}
                    <button
                        onClick={cycleDuration}
                        aria-label={`Rest duration: ${DURATIONS[durationIdx]}s. Click to change.`}
                        className="font-pulse text-[0.625rem] tracking-[0.06em] text-pulse-dim bg-transparent border border-[#2a2a2a] rounded-sm py-[0.2rem] px-[0.4rem] cursor-pointer">
                        {DURATIONS[durationIdx]}s
                    </button>
                    <button
                        onClick={skip}
                        aria-label="Skip rest timer"
                        className="font-pulse text-[0.625rem] tracking-[0.06em] text-[#444] bg-transparent border-none cursor-pointer py-[0.2rem] px-0">
                        Skip
                    </button>
                </div>
            </div>
            <div className="h-[2px] bg-[#1a1a1a]">
                {/* width is a runtime ratio — must stay inline */}
                <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${done ? 'bg-pulse-accent' : 'bg-pulse-accent/60'}`}
                    style={{ width: `${pct * 100}%` }}
                />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Run full test suite**

```powershell
bun run test:run
```

Expected: all pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pulse/RestTimer.tsx
git commit -m "refactor(pulse): migrate RestTimer to Tailwind"
```

---

## Task 7: `LogView.tsx`

**Files:**
- Modify: `src/components/pulse/views/LogView.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { WORKOUTS } from '@/lib/pulse/data';
import { getPhase, getRIR, weekHasData, parseMaxSets, logKey } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WorkoutTabs from '../WorkoutTabs';
import ExerciseCard from '../ExerciseCard';
import RestTimer from '../RestTimer';
import type { LogEntry } from '@/lib/pulse/types';

export default function LogView() {
    const {
        activeWeek,
        setActiveWeek,
        activeTab,
        setActiveTab,
        logs,
        profile,
        prMap,
        updateLog,
        deleteLog,
        timerTrigger,
        fireTrigger,
    } = usePulse();

    const workout = WORKOUTS[activeTab];
    const rir = getRIR(activeWeek);
    const phase = getPhase(activeWeek);
    const unit = profile.unit;

    const hasData = workout.exercises.some((ex, exIdx) =>
        Array.from(
            { length: parseMaxSets(ex.sets) },
            (_, s) => logs[logKey(activeWeek, activeTab, exIdx, s)]?.saved,
        ).some(Boolean),
    );

    function handleSave(key: string, entry: LogEntry) {
        updateLog(key, entry);
        fireTrigger();
    }

    return (
        <div>
            <WorkoutTabs activeTab={activeTab} onSelect={setActiveTab} />
            <RestTimer trigger={timerTrigger} />

            <div className="flex px-4 overflow-x-auto [scrollbar-width:none] border-b border-pulse-border">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
                    const active = w === activeWeek;
                    return (
                        <button
                            key={w}
                            onClick={() => setActiveWeek(w)}
                            className={`font-pulse text-xs min-w-9 pt-2 pb-1.5 text-center bg-transparent border-0 border-b-2 -mb-px cursor-pointer shrink-0 ${
                                active ? 'font-bold border-pulse-accent text-pulse-accent' : 'font-normal border-transparent text-pulse-dim'
                            }`}>
                            {w}
                            <span
                                className={`block w-1 h-1 rounded-full mx-auto mt-0.5 ${
                                    weekHasData(w, logs) ? 'bg-pulse-accent' : 'bg-transparent'
                                }`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-baseline gap-3 px-4 pt-3.5 pb-2">
                <span className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-dim">
                    {phase.label}
                </span>
                <span className="font-pulse text-xs font-bold text-pulse-accent tracking-[0.04em]">
                    {rir} RIR
                </span>
                <span className="text-[0.8125rem] text-pulse-dim ml-auto">{workout.description}</span>
            </div>

            <div
                id={`panel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeTab}`}
                className="px-4 pt-1 pb-8 max-w-[600px] mx-auto flex flex-col gap-1">
                {workout.exercises.map((exercise, i) => (
                    <ExerciseCard
                        key={`${activeTab}-${i}`}
                        exercise={exercise}
                        exIdx={i}
                        week={activeWeek}
                        type={activeTab}
                        logs={logs}
                        prMap={prMap}
                        unit={unit}
                        onSave={handleSave}
                        onDelete={deleteLog}
                    />
                ))}
                {!hasData && (
                    <div className="pt-6 text-center">
                        <div className="font-pulse text-[0.6875rem] text-[#333] tracking-[0.04em]">
                            Tap an exercise to start logging.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Run tests**

```powershell
bun run test:run -- LogView
```

Expected: all pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pulse/views/LogView.tsx
git commit -m "refactor(pulse): migrate LogView to Tailwind"
```

---

## Task 8: `HistoryView.tsx`

**Files:**
- Modify: `src/components/pulse/views/HistoryView.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client';
import { useMemo } from 'react';
import { buildHistory, calcE1RM, toDisplay } from '@/lib/pulse/utils';
import { WORKOUTS } from '@/lib/pulse/data';
import { usePulse } from '@/context/PulseContext';

export default function HistoryView() {
    const { logs, profile, prMap } = usePulse();
    const unit = profile.unit;
    const sessions = useMemo(() => buildHistory(logs), [logs]);

    if (sessions.length === 0) {
        return (
            <div className="py-16 px-4 text-center">
                <div className="font-pulse text-[0.6875rem] tracking-[0.1em] uppercase text-pulse-muted mb-3">
                    No sessions yet
                </div>
                <div className="font-pulse text-[0.625rem] text-[#333] tracking-[0.04em]">
                    Head to Log to get started.
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-[600px] mx-auto flex flex-col gap-2">
            {sessions.map((session) => {
                const workout = WORKOUTS[session.type];
                return (
                    <div
                        key={`${session.week}-${session.type}`}
                        className="bg-pulse-surface border border-pulse-border rounded overflow-hidden">
                        <div className="py-3 px-4 border-b border-pulse-border flex items-center gap-3">
                            <span className="font-pulse text-[0.625rem] tracking-[0.1em] uppercase font-bold text-pulse-accent">
                                {workout.label}
                            </span>
                            <span className="font-pulse text-[0.625rem] text-pulse-dim tracking-[0.04em]">
                                Week {session.week}
                            </span>
                            <span className="font-pulse text-[0.5625rem] text-pulse-muted ml-auto">
                                {session.sets.length} sets
                            </span>
                        </div>
                        <div className="py-2 px-4 pb-3">
                            {session.sets.map((set, i) => {
                                const exercise = workout.exercises[set.exIdx];
                                const exKey = `${session.type}-${set.exIdx}`;
                                const bestE1RM = prMap[exKey] ?? 0;
                                const isPR = bestE1RM > 0 && calcE1RM(set.kg, set.reps) >= bestE1RM;
                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center gap-3 py-1 ${
                                            i < session.sets.length - 1 ? 'border-b border-[#111]' : ''
                                        }`}>
                                        <span className="font-pulse text-[0.5625rem] text-pulse-muted w-5 shrink-0">
                                            {String(set.setIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span className="text-pulse-dim text-xs flex-1 truncate">
                                            {exercise?.name ?? `Exercise ${set.exIdx + 1}`}
                                        </span>
                                        <span className="font-pulse text-white font-semibold text-xs shrink-0">
                                            {toDisplay(set.kg, unit)} {unit} × {set.reps}
                                        </span>
                                        {isPR && (
                                            <span className="font-pulse text-[0.5rem] tracking-[0.08em] uppercase text-pulse-accent bg-pulse-accent/10 border border-pulse-accent/25 rounded-[2px] py-[0.1rem] px-[0.3rem] shrink-0">
                                                PR
                                            </span>
                                        )}
                                        <span className="font-pulse text-pulse-muted text-[0.625rem] shrink-0">
                                            {set.rir} RIR
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Run tests**

```powershell
bun run test:run -- HistoryView
```

Expected: all pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pulse/views/HistoryView.tsx
git commit -m "refactor(pulse): migrate HistoryView to Tailwind"
```

---

## Task 9: `ProgramView.tsx`

**Files:**
- Modify: `src/components/pulse/views/ProgramView.tsx`

Volume bar `height: \`${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px\`` **must stay inline** — runtime-computed value.

- [ ] **Step 1: Replace the file contents**

```tsx
import { WORKOUTS, VOLUME, SCHEDULE, WEEK_NOTES } from '@/lib/pulse/data';
import { getPhase } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import WeekSelector from '../WeekSelector';

const BAR_MAX_HEIGHT_PX = 44;

export default function ProgramView() {
    const { activeWeek, setActiveWeek, navigate, logs } = usePulse();
    const phase = getPhase(activeWeek);
    const maxSets = Math.max(...VOLUME.map((v) => v.sets));

    function handleSelectWeek(w: number) {
        setActiveWeek(w);
        navigate('log');
    }

    return (
        <div className="p-4 max-w-[600px] mx-auto">
            <WeekSelector activeWeek={activeWeek} onSelect={handleSelectWeek} logs={logs} />

            <div className="my-5 py-3.5 px-4 bg-pulse-surface rounded border-l-[3px] border-l-pulse-accent">
                <div className="font-pulse font-bold text-xs tracking-[0.06em] uppercase text-pulse-accent">
                    {phase.label} — {phase.subtitle}
                </div>
                {WEEK_NOTES[activeWeek] && (
                    <div className="text-pulse-dim text-[0.8125rem] mt-1.5 leading-[1.6]">
                        {WEEK_NOTES[activeWeek]}
                    </div>
                )}
            </div>

            <div className="mb-6">
                <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                    Weekly Volume
                </div>
                <div className="flex items-end gap-[3px] h-[54px]">
                    {VOLUME.map(({ week, sets }) => (
                        <div key={week} className="flex-1 flex flex-col items-center gap-0.5">
                            {/* height is a runtime ratio — must stay inline */}
                            <div
                                className={`w-full rounded-t-[2px] transition-colors duration-[150ms] ${
                                    activeWeek === week ? 'bg-pulse-accent' : 'bg-pulse-border'
                                }`}
                                style={{ height: `${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px` }}
                            />
                            <span className="font-pulse text-[#333] text-[0.5rem]">{week}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                    Weekly Schedule
                </div>
                <div className="flex gap-1.5">
                    {SCHEDULE.map(({ day, type }) => {
                        const isRest = type === 'rest';
                        const label = isRest ? '—' : type.charAt(0).toUpperCase();
                        return (
                            <div key={day} className="flex-1 text-center">
                                <div className="font-pulse text-[#333] text-[0.5rem] mb-1 uppercase">
                                    {day}
                                </div>
                                <div
                                    className={`py-1.5 rounded-sm font-pulse text-[0.625rem] font-bold border ${
                                        isRest
                                            ? 'bg-[#0f0f0f] text-[#222] border-pulse-border'
                                            : 'bg-pulse-accent/10 text-pulse-accent border-pulse-accent/20'
                                    }`}>
                                    {label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {(['push', 'pull', 'legs'] as const).map((type) => {
                const workout = WORKOUTS[type];
                return (
                    <div key={type} className="mb-6">
                        <div className="font-pulse text-[0.625rem] tracking-[0.1em] uppercase text-pulse-accent font-bold mb-3">
                            {workout.label} — {workout.description}
                        </div>
                        {workout.exercises.map((ex, i) => (
                            <div
                                key={i}
                                className="py-2 border-b border-pulse-border flex gap-4 items-baseline">
                                <span className="font-pulse text-[0.625rem] text-pulse-muted shrink-0 w-5">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <div className="text-pulse-text text-[0.875rem] font-medium">
                                        {ex.name}
                                    </div>
                                    <div className="font-pulse text-pulse-dim text-[0.5625rem] tracking-[0.04em] mt-0.5">
                                        {ex.sets} sets · {ex.reps} reps · {ex.load}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Run full test suite**

```powershell
bun run test:run
```

Expected: all pass.

- [ ] **Step 3: Commit**

```powershell
git add src/components/pulse/views/ProgramView.tsx
git commit -m "refactor(pulse): migrate ProgramView to Tailwind"
```

---

## Task 10: `ProfileView.tsx`

**Files:**
- Modify: `src/components/pulse/views/ProfileView.tsx`

SVG presentation attributes (`fill`, `stroke` on polyline, path, circle) use CSS custom property references (`fill="var(--color-pulse-accent)"`) instead of the old `ACCENT` constant. SVG geometric attributes (`cx`, `cy`, `r`, `points`, `d`, `viewBox`) stay as JSX attrs — they are not CSS.

- [ ] **Step 1: Run existing tests as baseline**

```powershell
bun run test:run -- ProfileView
```

Expected: all pass.

- [ ] **Step 2: Replace the file contents**

```tsx
'use client';
import { useTransition, useState } from 'react';
import { toDisplay, toKg, getInitials, MIN_KG, MAX_KG } from '@/lib/pulse/utils';
import { usePulse } from '@/context/PulseContext';
import type { BodyweightEntry } from '@/lib/pulse/types';

function BodyweightChart({ entries, unit }: { entries: BodyweightEntry[]; unit: 'kg' | 'lbs' }) {
    const sorted = [...entries].reverse().slice(-30);
    if (sorted.length < 2) return null;

    const W = 300,
        H = 80,
        PL = 34,
        PR = 8,
        PT = 10,
        PB = 4;
    const cw = W - PL - PR;
    const ch = H - PT - PB;

    const values = sorted.map((e) => toDisplay(e.weight_kg, unit));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;

    function px(i: number) {
        return PL + (i / (sorted.length - 1)) * cw;
    }
    function py(v: number) {
        if (range === 0) return PT + ch / 2;
        return PT + ch - ((v - minVal) / range) * ch;
    }

    const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    const lastX = px(sorted.length - 1);
    const lastY = py(values[values.length - 1]);
    const areaPath = `M ${pts[0]} L ${pts.slice(1).join(' L ')} L ${lastX.toFixed(1)},${(PT + ch).toFixed(1)} L ${PL},${(PT + ch).toFixed(1)} Z`;
    const fmt = (v: number) => (unit === 'lbs' ? v.toFixed(1) : String(v));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height: 80 }} aria-hidden>
            <defs>
                <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pulse-accent)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-pulse-accent)" stopOpacity={0} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#bw-fill)" />
            <polyline
                points={pts.join(' ')}
                fill="none"
                stroke="var(--color-pulse-accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={lastX} cy={lastY} r={3} fill="var(--color-pulse-accent)" />
            {range > 0 && (
                <>
                    <text x={PL - 3} y={PT + ch} textAnchor="end" fontSize={8} fontFamily="monospace" fill="var(--color-pulse-dim)" dy="0">
                        {fmt(minVal)}
                    </text>
                    <text x={PL - 3} y={PT} textAnchor="end" fontSize={8} fontFamily="monospace" fill="var(--color-pulse-dim)" dy="8">
                        {fmt(maxVal)}
                    </text>
                </>
            )}
        </svg>
    );
}

export default function ProfileView() {
    const { email, profile, bodyweightLogs, updateProfile, logBodyWeight, deleteBodyWeight } = usePulse();

    const { display_name: displayName, unit } = profile;

    const [isPending, startTransition] = useTransition();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName ?? '');
    const [nameSaved, setNameSaved] = useState(false);
    const [bwInput, setBwInput] = useState('');
    const [bwError, setBwError] = useState<string | null>(null);

    const initials = displayName ? getInitials(displayName, 2) : (email[0]?.toUpperCase() ?? '?');

    function handleUnitChange(newUnit: 'kg' | 'lbs') {
        if (newUnit === unit || isPending) return;
        startTransition(async () => {
            await updateProfile(displayName, newUnit);
        });
    }

    function handleNameSave() {
        const trimmed = nameInput.trim() || null;
        setEditingName(false);
        if (trimmed === displayName) return;
        startTransition(async () => {
            await updateProfile(trimmed, unit);
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
        });
    }

    function handleNameKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setNameInput(displayName ?? '');
            setEditingName(false);
        }
    }

    function handleLogBodyweight() {
        const val = parseFloat(bwInput);
        if (isNaN(val) || val <= 0) {
            setBwError('Enter a valid weight');
            return;
        }
        const kgVal = toKg(val, unit);
        if (kgVal < MIN_KG || kgVal > MAX_KG) {
            setBwError(`Must be between ${toDisplay(MIN_KG, unit)} and ${toDisplay(MAX_KG, unit)} ${unit}`);
            return;
        }
        setBwError(null);
        startTransition(async () => {
            try {
                await logBodyWeight(kgVal);
                setBwInput('');
            } catch {
                setBwError('Failed to save. Try again.');
            }
        });
    }

    function handleDeleteBodyweight(id: string) {
        startTransition(async () => {
            await deleteBodyWeight(id);
        });
    }

    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="py-5 px-4 pb-12 max-w-[480px] mx-auto flex flex-col gap-7">
            {/* Identity */}
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded shrink-0 bg-pulse-surface border border-pulse-border flex items-center justify-center font-pulse text-xl font-bold text-pulse-accent tracking-[-0.02em]">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    {editingName ? (
                        <input
                            autoFocus
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onBlur={handleNameSave}
                            onKeyDown={handleNameKeyDown}
                            placeholder="Display name"
                            className="font-pulse text-[0.9375rem] font-semibold text-white bg-transparent border-0 border-b border-pulse-accent outline-none w-full pb-[2px]"
                        />
                    ) : (
                        <button
                            onClick={() => {
                                setNameInput(displayName ?? '');
                                setEditingName(true);
                            }}
                            className={`font-pulse text-[0.9375rem] font-semibold bg-transparent border-none p-0 cursor-text text-left block w-full ${
                                displayName ? 'text-white' : 'text-pulse-dim'
                            }`}>
                            {displayName ?? 'Add display name'}
                        </button>
                    )}
                    <div className="font-pulse text-[0.6875rem] text-pulse-dim mt-1 truncate">
                        {email}
                    </div>
                    {nameSaved && !editingName && (
                        <span className="font-pulse text-[0.5625rem] text-[#4ade80] tracking-[0.04em] mt-0.5 block">
                            Saved ✓
                        </span>
                    )}
                </div>
            </div>

            {/* Unit toggle */}
            <div>
                <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-2">
                    Weight Unit
                </div>
                <div className="flex gap-2">
                    {(['kg', 'lbs'] as const).map((u) => (
                        <button
                            key={u}
                            onClick={() => handleUnitChange(u)}
                            className={`font-pulse text-[0.8125rem] font-semibold tracking-[0.06em] uppercase py-1.5 px-4 border rounded-sm cursor-pointer ${
                                unit === u
                                    ? 'bg-pulse-accent border-pulse-accent text-black'
                                    : 'bg-transparent border-pulse-border text-pulse-dim'
                            }`}>
                            {u}
                        </button>
                    ))}
                </div>
            </div>

            {/* Body weight */}
            <div>
                <div className="font-pulse text-[0.5625rem] tracking-[0.1em] uppercase text-pulse-muted mb-3">
                    Body Weight
                </div>
                <div className="flex gap-2 items-start mb-3.5">
                    <div className="flex-1">
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                aria-label={`Body weight in ${unit}`}
                                placeholder={unit}
                                value={bwInput}
                                min={toDisplay(MIN_KG, unit)}
                                max={toDisplay(MAX_KG, unit)}
                                step={0.1}
                                onChange={(e) => {
                                    setBwInput(e.target.value);
                                    setBwError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleLogBodyweight();
                                }}
                                className={`w-[5.5rem] py-1.5 px-2 bg-pulse-bg border rounded-sm text-white font-pulse text-[0.8125rem] outline-none ${
                                    bwError ? 'border-[#f43f5e]' : 'border-pulse-border'
                                }`}
                            />
                            <span className="font-pulse text-[0.6875rem] text-pulse-dim">{today}</span>
                        </div>
                        {bwError && (
                            <div className="font-pulse text-[0.625rem] text-[#f43f5e] mt-1">
                                {bwError}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogBodyweight}
                        disabled={isPending}
                        className={`font-pulse text-[0.625rem] tracking-[0.06em] uppercase py-[0.4375rem] px-3 bg-transparent border border-pulse-muted rounded-sm text-[#aaa] shrink-0 ${
                            isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                        }`}>
                        Log
                    </button>
                </div>

                {bodyweightLogs.length >= 2 && (
                    <div className="bg-pulse-surface border border-pulse-border rounded pt-2.5 px-2 pb-2 mb-3">
                        <BodyweightChart entries={bodyweightLogs} unit={unit} />
                    </div>
                )}

                {bodyweightLogs.length > 0 ? (
                    <div>
                        {bodyweightLogs.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center gap-3 py-[0.4375rem] border-b border-[#111]">
                                <span className="font-pulse text-[0.6875rem] text-pulse-dim flex-1">
                                    {entry.logged_at}
                                </span>
                                <span className="font-pulse text-[0.8125rem] text-pulse-text font-semibold">
                                    {toDisplay(entry.weight_kg, unit)} {unit}
                                </span>
                                <button
                                    onClick={() => handleDeleteBodyweight(entry.id)}
                                    disabled={isPending}
                                    aria-label={`Delete entry for ${entry.logged_at}`}
                                    className="font-pulse text-[0.625rem] text-[#444] bg-transparent border-none cursor-pointer p-0 shrink-0">
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="font-pulse text-[0.625rem] text-[#333] tracking-[0.04em]">
                        No entries yet.
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Run tests to confirm they still pass**

```powershell
bun run test:run -- ProfileView
```

Expected: all pass.

- [ ] **Step 4: Commit**

```powershell
git add src/components/pulse/views/ProfileView.tsx
git commit -m "refactor(pulse): migrate ProfileView to Tailwind"
```

---

## Task 11: `AppShell.tsx`

**Files:**
- Modify: `src/components/pulse/AppShell.tsx`
- Modify: `src/app/globals.css`

The hamburger line transforms are dynamic boolean toggles — they CAN be Tailwind arbitrary values. The `.pulse-desktop-nav` / `.pulse-hamburger` CSS rules in `globals.css` are replaced by Tailwind `hidden sm:contents` / `flex sm:hidden`.

- [ ] **Step 1: Replace `AppShell.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/pulse/actions';
import { usePulse } from '@/context/PulseContext';
import LogView from './views/LogView';
import ProgramView from './views/ProgramView';
import HistoryView from './views/HistoryView';
import ProfileView from './views/ProfileView';
import type { View } from '@/lib/pulse/types';

const NAV: { id: View; label: string }[] = [
    { id: 'log', label: 'Log' },
    { id: 'program', label: 'Program' },
    { id: 'history', label: 'History' },
    { id: 'profile', label: 'Profile' },
];

export function AppShell() {
    const { activeWeek, streak, view, navigate, handleExport, saveError } = usePulse();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        function onPointerDown(e: PointerEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [menuOpen]);

    function handleNavigate(v: View) {
        navigate(v);
        setMenuOpen(false);
    }

    return (
        <div className="min-h-screen bg-pulse-bg text-pulse-text">
            {/* Header */}
            <div ref={menuRef} className="sticky top-0 z-10 bg-pulse-bg">
                <div
                    className={`px-4 h-14 flex items-center gap-3 border-b ${
                        menuOpen ? 'border-transparent' : 'border-pulse-border'
                    }`}>
                    <span className="font-pulse font-bold text-[0.8125rem] tracking-[0.08em] text-white uppercase shrink-0">
                        Pulse<span className="text-pulse-accent">.</span>
                    </span>
                    <span className="font-pulse text-xs text-pulse-dim tracking-[0.05em] shrink-0">
                        WK{' '}
                        <strong className="text-pulse-accent font-bold">
                            {String(activeWeek).padStart(2, '0')}
                        </strong>{' '}
                        / 12
                    </span>
                    {streak > 0 && (
                        <span className="font-pulse text-[0.6875rem] text-[#555] tracking-[0.05em] shrink-0">
                            · {streak}WK
                        </span>
                    )}
                    <nav className="ml-auto flex gap-5 items-center" aria-label="Main navigation">
                        {/* Desktop nav — hidden on mobile */}
                        <span className="hidden sm:contents">
                            {NAV.map(({ id, label }) => {
                                const active = view === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleNavigate(id)}
                                        className={`font-pulse text-[0.8125rem] font-medium bg-transparent border-0 border-b pb-[1px] cursor-pointer tracking-[0.02em] ${
                                            active
                                                ? 'text-white border-pulse-accent'
                                                : 'text-pulse-dim border-transparent'
                                        }`}>
                                        {label}
                                    </button>
                                );
                            })}
                            <span className="text-[#2a2a2a] pb-[1px]">|</span>
                            <button
                                onClick={handleExport}
                                aria-label="Export workout logs as JSON"
                                className="font-pulse text-[0.8125rem] font-medium text-pulse-dim bg-transparent border-0 border-b border-transparent pb-[1px] cursor-pointer tracking-[0.02em]">
                                Export
                            </button>
                            <form action={logout} className="inline">
                                <button
                                    type="submit"
                                    aria-label="Sign out of Pulse"
                                    className="font-pulse text-xs font-medium text-[#444] bg-transparent border-none cursor-pointer tracking-[0.02em] pb-[1px]">
                                    Sign out
                                </button>
                            </form>
                        </span>
                        {/* Hamburger — visible only on mobile */}
                        <button
                            className="flex sm:hidden flex-col gap-1 bg-transparent border-none p-1 cursor-pointer shrink-0"
                            onClick={() => setMenuOpen((o) => !o)}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={menuOpen}>
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-[1px] transition-[transform,opacity] duration-200"
                                style={{ transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }}
                            />
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-[1px] transition-[transform,opacity] duration-200"
                                style={{ opacity: menuOpen ? 0 : 1 }}
                            />
                            <span
                                className="block w-[18px] h-[1.5px] bg-pulse-dim rounded-[1px] transition-[transform,opacity] duration-200"
                                style={{ transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }}
                            />
                        </button>
                    </nav>
                </div>

                {menuOpen && (
                    <div className="border-b border-pulse-border py-2 pb-3 flex flex-col">
                        {NAV.map(({ id, label }) => {
                            const active = view === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleNavigate(id)}
                                    className={`font-pulse text-[0.9375rem] bg-transparent border-0 border-l-2 text-left py-3 px-5 cursor-pointer tracking-[0.02em] ${
                                        active
                                            ? 'font-bold text-white border-pulse-accent'
                                            : 'font-normal text-pulse-dim border-transparent'
                                    }`}>
                                    {label}
                                </button>
                            );
                        })}
                        <div className="h-[1px] bg-[#1a1a1a] mx-4 my-1" />
                        <button
                            onClick={() => {
                                handleExport();
                                setMenuOpen(false);
                            }}
                            className="font-pulse text-[0.875rem] text-pulse-dim bg-transparent border-0 border-l-2 border-transparent text-left py-3 px-5 cursor-pointer tracking-[0.02em]">
                            Export
                        </button>
                        <form action={logout}>
                            <button
                                type="submit"
                                className="font-pulse text-[0.875rem] text-[#444] bg-transparent border-0 border-l-2 border-transparent text-left py-3 px-5 cursor-pointer tracking-[0.02em] w-full">
                                Sign out
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {saveError && (
                <div
                    role="alert"
                    className="py-2 px-4 bg-[#f43f5e]/10 border-b border-[#f43f5e]/20 text-[#f43f5e] font-pulse text-[0.6875rem] tracking-[0.04em] text-center">
                    {saveError}
                </div>
            )}

            {view === 'log' && <LogView />}
            {view === 'program' && <ProgramView />}
            {view === 'history' && <HistoryView />}
            {view === 'profile' && <ProfileView />}
        </div>
    );
}
```

- [ ] **Step 2: Remove `.pulse-desktop-nav` / `.pulse-hamburger` rules from `globals.css`**

Open `src/app/globals.css` and remove the last 9 lines (the comment and the two rule blocks). Final file:

```css
@import 'tailwindcss';

@theme {
    --color-primary: #222831;
    --color-secondary: #00adb5;
    --color-gray-dark: #010101;
    --color-gray: #eeeeee;

    --container-15: 15;

    --text-xxs: 10px;

    /* Pulse design tokens */
    --font-pulse: 'JetBrains Mono', 'Courier New', monospace;
    --color-pulse-accent: #ff6c2f;
    --color-pulse-bg: #0a0a0a;
    --color-pulse-surface: #141414;
    --color-pulse-border: #1f1f1f;
    --color-pulse-dim: #555555;
    --color-pulse-muted: #3a3a3a;
    --color-pulse-text: #d4d4d4;
}

:focus-visible {
    outline: 2px solid #00adb5;
    outline-offset: 2px;
}
```

- [ ] **Step 3: Run full test suite**

```powershell
bun run test:run
```

Expected: all pass.

- [ ] **Step 4: Run typecheck**

```powershell
bun run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add src/components/pulse/AppShell.tsx src/app/globals.css
git commit -m "refactor(pulse): migrate AppShell to Tailwind, replace hamburger CSS rules with sm: variants"
```

---

## Task 12: Delete `theme.ts` and clean up imports

**Files:**
- Delete: `src/lib/pulse/theme.ts`
- Modify: any file still importing from `@/lib/pulse/theme`

- [ ] **Step 1: Confirm no component imports theme.ts any more**

```powershell
Select-String -Path "src/**/*.tsx","src/**/*.ts" -Pattern "from '@/lib/pulse/theme'" -Recurse
```

Expected output: zero matches (all components were migrated in Tasks 2–11). If any matches appear, open that file and remove the import — all values it used are now Tailwind classes.

- [ ] **Step 2: Delete `theme.ts`**

```powershell
Remove-Item src/lib/pulse/theme.ts
```

- [ ] **Step 3: Run typecheck**

```powershell
bun run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Run lint**

```powershell
bun run lint
```

Expected: 0 errors.

- [ ] **Step 5: Run formatter**

```powershell
bun run format
```

- [ ] **Step 6: Run full test suite**

```powershell
bun run test:run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add -u
git commit -m "refactor(pulse): delete theme.ts — all values now in Tailwind @theme"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task | Covered? |
|---|---|---|
| Pulse `@theme` tokens added to `globals.css` | T1 | ✅ |
| `font-pulse` utility for JetBrains Mono | T1 | ✅ |
| `text/bg/border-pulse-accent` etc. generated | T1 | ✅ |
| `WorkoutTabs` migrated | T2 | ✅ |
| `WeekSelector` migrated | T3 | ✅ |
| `ExerciseCard` migrated | T4 | ✅ |
| `SetLogger` migrated | T5 | ✅ |
| `RestTimer` migrated (width stays inline) | T6 | ✅ |
| `LogView` migrated | T7 | ✅ |
| `HistoryView` migrated | T8 | ✅ |
| `ProgramView` migrated (height stays inline) | T9 | ✅ |
| `ProfileView` migrated (SVG CSS vars) | T10 | ✅ |
| `AppShell` migrated (hamburger stays inline for transforms) | T11 | ✅ |
| `.pulse-desktop-nav`/`.pulse-hamburger` rules removed | T11 | ✅ |
| `theme.ts` deleted | T12 | ✅ |

**Inline styles that remain (by design):**
- `RestTimer` progress bar: `width: \`${pct * 100}%\`` — runtime ratio
- `ProgramView` volume bars: `height: \`${(sets / maxSets) * BAR_MAX_HEIGHT_PX}px\`` — runtime ratio
- `SetLogger` row: `opacity: saved && !editing ? 0.55 : 1` — runtime boolean, non-standard value
- `AppShell` hamburger lines: `transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none'` — runtime boolean toggle

**No placeholders found.**
