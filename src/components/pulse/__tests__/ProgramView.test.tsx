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
    };
};

const makeRoutine = (exercises: RoutineExercise[], schedule: ScheduleEntry[]): RoutineWithExercises => ({
    id: 'r1',
    user_id: 'u1',
    name: 'Test Routine',
    created_at: '',
    schedule,
    exercises,
});

const baseContext = {
    activeWeek: 1,
    setActiveWeek: vi.fn(),
    logs: {},
    activeSchedule: [],
    activeRoutine: null,
    updateRoutineProgramWeeks: vi.fn(),
    setProgramAnchor: vi.fn(),
};

beforeEach(() => {
    reCounter = 0;
    vi.mocked(usePulse).mockReturnValue(baseContext as unknown as ReturnType<typeof usePulse>);
});

function mockContext(routine: RoutineWithExercises) {
    vi.mocked(usePulse).mockReturnValue({
        ...baseContext,
        activeRoutine: routine,
        activeSchedule: [...routine.schedule].sort((a, b) => a.day_of_week - b.day_of_week),
    } as unknown as ReturnType<typeof usePulse>);
}

describe('ProgramView', () => {
    it('groups exercises by raw type when the routine has no schedule', () => {
        const routine = makeRoutine([makeRE('Bench Press', 'push'), makeRE('Row', 'pull')], []);
        mockContext(routine);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
    });

    it('lets the user set the program start date', () => {
        const setProgramAnchor = vi.fn();
        const routine = makeRoutine([makeRE('Bench Press', 'push')], []);
        vi.mocked(usePulse).mockReturnValue({
            ...baseContext,
            activeRoutine: routine,
            activeSchedule: [],
            setProgramAnchor,
        } as unknown as ReturnType<typeof usePulse>);
        render(<ProgramView />);
        expect(screen.getByText(/program start/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Today' }));
        expect(setProgramAnchor).toHaveBeenCalledWith('r1', expect.stringMatching(/T12:00:00\.000Z$/));
    });

    it('rolls granular exercises up into a single Full Body session', () => {
        const routine = makeRoutine([makeRE('Bench Press', 'push'), makeRE('Row', 'pull'), makeRE('Squat', 'legs')], [
            { day_of_week: 1, workout_type: 'full_body', variant: null },
            { day_of_week: 3, workout_type: 'full_body', variant: null },
            { day_of_week: 5, workout_type: 'full_body', variant: null },
        ] as ScheduleEntry[]);
        mockContext(routine);
        render(<ProgramView />);
        expect(screen.getByText('Full Body')).toBeInTheDocument();
        expect(screen.queryByText('Push')).not.toBeInTheDocument();
        expect(screen.queryByText('Pull')).not.toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Row')).toBeInTheDocument();
        expect(screen.getByText('Squat')).toBeInTheDocument();
    });

    it('splits two same-type days into separate variant sections (does not merge)', () => {
        // The aesthetic upper/lower bug: Upper A + Upper B must not collapse into
        // one 12-exercise "Upper" list.
        const routine = makeRoutine(
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
        );
        mockContext(routine);
        render(<ProgramView />);

        expect(screen.getByText('Upper · A')).toBeInTheDocument();
        expect(screen.getByText('Upper · B')).toBeInTheDocument();
        expect(screen.getByText('Lower · A')).toBeInTheDocument();
        expect(screen.getByText('Lower · B')).toBeInTheDocument();

        // Each Upper section holds only its own two lifts.
        expect(screen.getByText('Dumbbell Bench Press')).toBeInTheDocument();
        expect(screen.getByText('Dumbbell Single-Arm Row')).toBeInTheDocument();
        expect(screen.getByText('Dumbbell Overhead Press')).toBeInTheDocument();
        expect(screen.getByText('Preacher Curl')).toBeInTheDocument();
    });

    it('shows one section per distinct workout type for a PPL split', () => {
        const routine = makeRoutine([makeRE('Bench Press', 'push'), makeRE('Row', 'pull')], [
            { day_of_week: 1, workout_type: 'push', variant: null },
            { day_of_week: 3, workout_type: 'pull', variant: null },
        ] as ScheduleEntry[]);
        mockContext(routine);
        render(<ProgramView />);
        expect(screen.getByText('Push')).toBeInTheDocument();
        expect(screen.getByText('Pull')).toBeInTheDocument();
        expect(screen.queryByText('Legs')).not.toBeInTheDocument();
    });

    it('splits the rationale into fact chips plus prose', () => {
        const routine = {
            ...makeRoutine([makeRE('Bench Press', 'push')], []),
            rationale:
                'Push Pull Legs for intermediate lifters · 4 days/week · Build muscle · 45-60 min sessions. A balanced split.',
        };
        mockContext(routine);
        render(<ProgramView />);
        expect(screen.getByText('4 days/week')).toBeInTheDocument();
        expect(screen.getByText('Build muscle')).toBeInTheDocument();
        expect(screen.getByText('A balanced split.')).toBeInTheDocument();
    });

    it('shows resolved equipment chips per exercise', () => {
        const re = makeRE('Bench Press', 'push');
        re.exercise = { ...re.exercise!, equipment: ['barbell', 'bench'] };
        mockContext(makeRoutine([re], []));
        render(<ProgramView />);
        expect(screen.getByText('Barbell')).toBeInTheDocument();
        expect(screen.getByText('Bench')).toBeInTheDocument();
    });

    it('opens the how-to-perform modal for a built-in exercise', () => {
        // The modal fetches instructions on mount; keep it pending so it just
        // renders its header (we only assert the modal opens).
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
        const routine = makeRoutine([makeRE('Bench Press', 'push')], []);
        mockContext(routine);
        render(<ProgramView />);
        fireEvent.click(screen.getByRole('button', { name: /how to perform bench press/i }));
        expect(screen.getByRole('button', { name: /close instructions/i })).toBeInTheDocument();
    });
});
