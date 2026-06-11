import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TuneYourPlanPanel, { type TuneYourPlanState } from '../TuneYourPlanPanel';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));
import { usePulse } from '@/context/PulseContext';

const generateRoutine = vi.fn();
const deleteRoutine = vi.fn().mockResolvedValue(undefined);
const setProgramAnchor = vi.fn().mockResolvedValue(undefined);
const updateRoutineProgramWeeks = vi.fn().mockResolvedValue(undefined);
const onDone = vi.fn();

const baseState: TuneYourPlanState = {
    routine: {
        id: 'routine-1',
        user_id: 'u1',
        name: 'Push Pull Legs',
        created_at: '2026-06-01T00:00:00.000Z',
        rationale: 'Built for your goals.',
    },
    answers: {
        equipment: new Set(['barbell', 'dumbbells']),
        experience: 'intermediate',
        goal: 'build_muscle',
        days: 4,
    },
    trainingDays: [1, 2, 4, 5],
    sessionTime: '45–60 min',
    styleKey: 'ppl-4',
    programWeeks: 12,
};

beforeEach(() => {
    vi.clearAllMocks();
    generateRoutine.mockResolvedValue({
        id: 'routine-2',
        user_id: 'u1',
        name: 'Upper Lower',
        created_at: '2026-06-08T00:00:00.000Z',
        rationale: 'Refit plan.',
    });
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        profile: {
            training_style: null,
            variety_preference: null,
            loading_lean: null,
            movement_restrictions: null,
        },
        generateRoutine,
        deleteRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        equipmentProfiles: [],
    });
});

// Reusable mock with saved equipment profiles for the Branch B picker tests.
const gymProfile = { id: 'gym', name: 'Gym', equipment: ['barbell', 'dumbbells'], created_at: '2026-06-09T02:00:00Z' };
const travelProfile = { id: 'travel', name: 'Travel', equipment: ['dumbbells'], created_at: '2026-06-09T01:00:00Z' };
function mockWithProfiles() {
    (usePulse as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        profile: { training_style: null, variety_preference: null, loading_lean: null, movement_restrictions: null },
        generateRoutine,
        deleteRoutine,
        setProgramAnchor,
        updateRoutineProgramWeeks,
        equipmentProfiles: [gymProfile, travelProfile],
    });
}

describe('TuneYourPlanPanel', () => {
    it('shows the freshly generated routine name and rationale', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.getByText('Push Pull Legs')).toBeInTheDocument();
        expect(screen.getByText('Built for your goals.')).toBeInTheDocument();
    });

    it('shows a plan summary of the inputs the routine was built from', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.getByText('Plan summary')).toBeInTheDocument();
        expect(screen.getByText('Build muscle')).toBeInTheDocument(); // goal
        expect(screen.getByText('45–60 min')).toBeInTheDocument(); // session length
        expect(screen.getByText('12 weeks')).toBeInTheDocument(); // program length
    });

    it('surfaces the four personalization sections seeded from the stored profile', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.getByText('Training style')).toBeInTheDocument();
        expect(screen.getByText('Exercise variety')).toBeInTheDocument();
        expect(screen.getByText('Equipment preference')).toBeInTheDocument();
        expect(screen.getByText('Movement restrictions')).toBeInTheDocument();
        // Null profile values fall back to the neutral defaults, shown active.
        expect(screen.getByRole('button', { name: /Balanced/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /^Varied/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /No preference/ })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows a "Change split" section when the day count has more than one style', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.getByText('Change split')).toBeInTheDocument();
    });

    it('hides "Change split" when the day count has only one style', () => {
        render(<TuneYourPlanPanel {...baseState} trainingDays={[1, 4]} styleKey="fb-2" onDone={onDone} />);
        expect(screen.queryByText('Change split')).not.toBeInTheDocument();
    });

    it('"Apply changes" starts disabled and enables once a picker changes', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        const apply = screen.getByRole('button', { name: 'Apply changes' });
        expect(apply).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: /Strength/ }));
        expect(apply).toBeEnabled();
    });

    it('"Looks good" calls onDone without regenerating', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        fireEvent.click(screen.getByRole('button', { name: /Looks good/ }));
        expect(onDone).toHaveBeenCalledTimes(1);
        expect(generateRoutine).not.toHaveBeenCalled();
        expect(deleteRoutine).not.toHaveBeenCalled();
    });

    it('"Apply changes" regenerates in place: creates the new routine, carries over anchor + length, then drops the old one', async () => {
        render(<TuneYourPlanPanel {...baseState} startAnchor="2026-06-09T12:00:00.000Z" onDone={onDone} />);

        fireEvent.click(screen.getByRole('button', { name: /Strength/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

        await waitFor(() => expect(deleteRoutine).toHaveBeenCalledTimes(1));

        expect(generateRoutine).toHaveBeenCalledWith(
            baseState.answers,
            baseState.trainingDays,
            baseState.sessionTime,
            baseState.styleKey,
            undefined,
            'strength',
            'varied',
            undefined,
            [],
            '2026-06-09T12:00:00.000Z',
        );
        expect(setProgramAnchor).toHaveBeenCalledWith('routine-2', '2026-06-09T12:00:00.000Z');
        expect(deleteRoutine).toHaveBeenCalledWith('routine-1');
        // The panel now shows the freshly rebuilt routine.
        expect(screen.getByText('Upper Lower')).toBeInTheDocument();
    });

    it('skips setProgramAnchor / updateRoutineProgramWeeks when there is nothing to carry over', async () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);

        fireEvent.click(screen.getByRole('button', { name: /Strength/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

        await waitFor(() => expect(deleteRoutine).toHaveBeenCalledTimes(1));
        expect(setProgramAnchor).not.toHaveBeenCalled();
        expect(updateRoutineProgramWeeks).not.toHaveBeenCalled();
    });

    it('carries over a non-default program length', async () => {
        render(<TuneYourPlanPanel {...baseState} programWeeks={16} onDone={onDone} />);

        fireEvent.click(screen.getByRole('button', { name: /Strength/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

        await waitFor(() => expect(updateRoutineProgramWeeks).toHaveBeenCalledWith('routine-2', 16));
    });

    it('toggling a movement restriction marks the picker dirty and is included in the regenerate call', async () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);

        const apply = screen.getByRole('button', { name: 'Apply changes' });
        fireEvent.click(screen.getByRole('button', { name: /Knees/ }));
        expect(apply).toBeEnabled();

        fireEvent.click(apply);
        await waitFor(() => expect(deleteRoutine).toHaveBeenCalledTimes(1));
        expect(generateRoutine).toHaveBeenCalledWith(
            baseState.answers,
            baseState.trainingDays,
            baseState.sessionTime,
            baseState.styleKey,
            undefined,
            'balanced',
            'varied',
            undefined,
            ['knee'],
            undefined,
        );
    });

    it('shows no Equipment section when there are no saved profiles', () => {
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.queryByText('Equipment')).not.toBeInTheDocument();
    });

    it('shows the equipment chip-pick when profiles exist, with the matching set active', () => {
        mockWithProfiles();
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        expect(screen.getByText('Equipment')).toBeInTheDocument();
        // baseState.answers.equipment = {barbell, dumbbells} -> the Gym set matches.
        expect(screen.getByRole('button', { name: /Gym/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Travel/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('picking a different equipment profile marks dirty and regenerates with that set', async () => {
        mockWithProfiles();
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} />);
        const apply = screen.getByRole('button', { name: 'Apply changes' });
        expect(apply).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: /Travel/ }));
        expect(apply).toBeEnabled();

        fireEvent.click(apply);
        await waitFor(() => expect(deleteRoutine).toHaveBeenCalledTimes(1));
        expect(generateRoutine).toHaveBeenCalledWith(
            expect.objectContaining({ equipment: new Set(['dumbbells']) }),
            baseState.trainingDays,
            baseState.sessionTime,
            baseState.styleKey,
            undefined,
            'balanced',
            'varied',
            undefined,
            [],
            undefined,
        );
    });

    it('"Manage in Profile" calls onManageEquipment', () => {
        mockWithProfiles();
        const onManageEquipment = vi.fn();
        render(<TuneYourPlanPanel {...baseState} onDone={onDone} onManageEquipment={onManageEquipment} />);
        fireEvent.click(screen.getByRole('button', { name: /Manage in Profile/i }));
        expect(onManageEquipment).toHaveBeenCalledTimes(1);
    });
});
