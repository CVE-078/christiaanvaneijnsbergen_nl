import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProgramView from '../views/ProgramView';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import { usePulse } from '@/context/PulseContext';
import type {
    RoutineWithExercises,
    RoutineExercise,
    WorkoutType,
    WorkoutVariant,
    ScheduleEntry,
    ProgramPosition,
} from '@/lib/pulse/types';

let reCounter = 0;
const makeRE = (
    name: string,
    type: WorkoutType,
    variant: WorkoutVariant | null = null,
    order = reCounter++,
): RoutineExercise => {
    const id = `re-${name.replace(/\s+/g, '-').toLowerCase()}-${variant ?? 'x'}`;
    return {
        id,
        routine_id: 'r1',
        exercise_id: id,
        workout_type: type,
        variant,
        order,
        sets: '3',
        reps: '8',
        starting_weight_kg: null,
        superset_group_id: null,
        exercise: { id, name, category: 'chest', default_sets: '3', default_reps: '8', user_id: null },
    } as unknown as RoutineExercise;
};

const makeRoutine = (exercises: RoutineExercise[], schedule: ScheduleEntry[]): RoutineWithExercises =>
    ({
        id: 'r1',
        user_id: 'u1',
        name: 'Test Routine',
        created_at: '',
        schedule,
        exercises,
    }) as RoutineWithExercises;

const baseContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    logs: {},
    activeSchedule: [],
    activeRoutine: null,
    programPosition: null,
    profile: { unit: 'kg', timezone: 'UTC' },
    exercises: [],
    routineExercisesByTabKey: {},
    resolveTabForEntry: vi.fn(),
    setActiveTab: vi.fn(),
    navigate: vi.fn(),
    updateRoutineProgramWeeks: vi.fn(),
    setProgramAnchor: vi.fn(),
    swapRoutineExercisePermanently: vi.fn(),
    loading: {},
    errors: {},
    retry: vi.fn(),
};

beforeEach(() => {
    reCounter = 0;
    vi.mocked(usePulse).mockReturnValue(baseContext as unknown as ReturnType<typeof usePulse>);
});

function mockContext(routine: RoutineWithExercises, extra: Record<string, unknown> = {}) {
    vi.mocked(usePulse).mockReturnValue({
        ...baseContext,
        activeRoutine: routine,
        activeSchedule: [...routine.schedule].sort((a, b) => a.day_of_week - b.day_of_week),
        ...extra,
    } as unknown as ReturnType<typeof usePulse>);
}

describe('ProgramView', () => {
    it('shows an empty state when there is no active routine', () => {
        render(<ProgramView />);
        expect(screen.getByText(/no active plan/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate routine/i })).toBeInTheDocument();
    });

    it('renders a session chip per distinct type (no schedule)', () => {
        mockContext(makeRoutine([makeRE('Bench Press', 'push'), makeRE('Row', 'pull')], []));
        render(<ProgramView />);
        expect(screen.getByRole('button', { name: 'Push' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pull' })).toBeInTheDocument();
    });

    it('rolls granular exercises up into a single Full Body session', () => {
        mockContext(
            makeRoutine([makeRE('Bench Press', 'push'), makeRE('Row', 'pull'), makeRE('Squat', 'legs')], [
                { day_of_week: 1, workout_type: 'full_body', variant: null },
                { day_of_week: 3, workout_type: 'full_body', variant: null },
                { day_of_week: 5, workout_type: 'full_body', variant: null },
            ] as ScheduleEntry[]),
        );
        render(<ProgramView />);
        expect(screen.getByRole('button', { name: 'Full Body' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Push' })).not.toBeInTheDocument();
        // all three lifts live in the one (selected) Full Body session
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Row')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
    });

    it('splits two same-type days into separate variant chips and shows one at a time', () => {
        mockContext(
            makeRoutine(
                [
                    makeRE('Dumbbell Bench Press', 'upper', 'A'),
                    makeRE('Dumbbell Single-Arm Row', 'upper', 'A'),
                    makeRE('Dumbbell Overhead Press', 'upper', 'B'),
                    makeRE('Preacher Curl', 'upper', 'B'),
                    makeRE('Romanian Deadlift', 'lower', 'A'),
                    makeRE('Hip Thrust', 'lower', 'B'),
                ],
                [
                    { day_of_week: 1, workout_type: 'upper', variant: 'A' },
                    { day_of_week: 2, workout_type: 'lower', variant: 'A' },
                    { day_of_week: 4, workout_type: 'upper', variant: 'B' },
                    { day_of_week: 5, workout_type: 'lower', variant: 'B' },
                ] as ScheduleEntry[],
            ),
        );
        render(<ProgramView />);
        // four distinct session chips
        for (const label of ['Upper A', 'Upper B', 'Lower A', 'Lower B']) {
            expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        }
        // selector default = Upper A: only its lifts show
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Dumbbell Overhead Press')).not.toBeInTheDocument();
        // switch to Upper B
        fireEvent.click(screen.getByRole('button', { name: 'Upper B' }));
        expect(screen.getByText('Dumbbell Overhead Press')).toBeInTheDocument();
        expect(screen.queryByText('Dumbbell Bench Press')).not.toBeInTheDocument();
    });

    it('shows the focus labels on the quad/posterior lower days, replacing the A/B letters (Bug 6)', () => {
        mockContext(
            makeRoutine(
                [
                    makeRE('Back Squat', 'lower', 'A'),
                    makeRE('Romanian Deadlift', 'lower', 'B'),
                    makeRE('Bench Press', 'upper', 'A'),
                ],
                [
                    { day_of_week: 2, workout_type: 'lower', variant: 'A', label: 'Lower (Quads)' },
                    {
                        day_of_week: 5,
                        workout_type: 'lower',
                        variant: 'B',
                        label: 'Lower (Hamstrings & Glutes)',
                    },
                    { day_of_week: 1, workout_type: 'upper', variant: 'A' },
                ] as ScheduleEntry[],
            ),
        );
        render(<ProgramView />);
        expect(screen.getByRole('button', { name: 'Lower (Quads)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Lower (Hamstrings & Glutes)' })).toBeInTheDocument();
        // the focus label replaces the compact "Lower A/B" rather than appending
        expect(screen.queryByRole('button', { name: 'Lower A' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Lower B' })).not.toBeInTheDocument();
        // an unlabelled session keeps its compact type+variant label
        expect(screen.getByRole('button', { name: 'Upper A' })).toBeInTheDocument();
    });

    it('shows the rationale fact chips inline and the prose behind "Why this plan"', () => {
        const routine = {
            ...makeRoutine([makeRE('Bench Press', 'push')], []),
            rationale:
                'Push Pull Legs for intermediate lifters · 4 days/week · Build muscle · 45-60 min sessions. A balanced split.',
        } as RoutineWithExercises;
        mockContext(routine);
        render(<ProgramView />);
        // facts are always-on chips
        expect(screen.getByText('4 days/week')).toBeInTheDocument();
        expect(screen.getByText('Build muscle')).toBeInTheDocument();
        // prose is collapsed until "Why this plan" is tapped
        expect(screen.queryByText('A balanced split.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /why this plan/i }));
        expect(screen.getByText('A balanced split.')).toBeInTheDocument();
    });

    it('renders the program status pill from programPosition', () => {
        const pos: ProgramPosition = {
            weekInteger: 6,
            progressionIndex: 6,
            isRampBack: false,
            completedCount: 5,
            calendarWeek: 6,
            behindBy: 0,
            daysSinceLastSession: 1,
            status: 'on_track',
            isPaused: false,
            pausedDays: null,
            nextEntry: null,
        };
        mockContext(makeRoutine([makeRE('Bench Press', 'push')], []), { programPosition: pos });
        render(<ProgramView />);
        expect(screen.getByText('On track')).toBeInTheDocument();
        expect(screen.getByText(/Week 6 of 12/)).toBeInTheDocument();
    });

    it('surfaces a generation warning notice when the routine carries warnings', () => {
        const routine = {
            ...makeRoutine([makeRE('Bench Press', 'push')], []),
            warnings: ['no_compound'],
        } as RoutineWithExercises;
        mockContext(routine);
        render(<ProgramView />);
        expect(screen.getByText('Accessory work only')).toBeInTheDocument();
    });

    it('exposes the program start date inside the collapsed Program settings', () => {
        const setProgramAnchor = vi.fn();
        mockContext(makeRoutine([makeRE('Bench Press', 'push')], []), { setProgramAnchor });
        render(<ProgramView />);
        // settings collapsed by default
        expect(screen.queryByText(/program start/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /length, start date/i }));
        expect(screen.getByText(/program start/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Today' }));
        expect(setProgramAnchor).toHaveBeenCalledWith('r1', expect.stringMatching(/T12:00:00\.000Z$/));
    });

    it('shows resolved equipment chips on an exercise row', () => {
        const re = makeRE('Bench Press', 'push');
        re.exercise = { ...re.exercise!, equipment: ['barbell', 'bench'] };
        mockContext(makeRoutine([re], []));
        render(<ProgramView />);
        expect(screen.getByText('Barbell')).toBeInTheDocument();
        expect(screen.getByText('Bench')).toBeInTheDocument();
    });

    it('opens the how-to-perform modal for a built-in exercise', () => {
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
        mockContext(makeRoutine([makeRE('Bench Press', 'push')], []));
        render(<ProgramView />);
        fireEvent.click(screen.getByRole('button', { name: /how to perform bench press/i }));
        expect(screen.getByRole('button', { name: /^close$/i })).toBeInTheDocument();
    });
});
