import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoutineSetupFlow from '../RoutineSetupFlow';
import type { EquipmentKey } from '@/lib/pulse/types';

const initial = {
    equipment: ['dumbbells'] as EquipmentKey[],
    experience: 'beginner' as const,
    goal: 'build_muscle' as const,
    days: '2-3' as const,
    trainingDays: [1, 3, 5],
    sessionTime: '~30 min' as const,
};

beforeEach(() => vi.clearAllMocks());

describe('RoutineSetupFlow', () => {
    it('starts at the equipment step', () => {
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('Cancel calls onClose', () => {
        const onClose = vi.fn();
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={onClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('prefilled values let each step advance and completing returns the collected answers', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(<RoutineSetupFlow initial={initial} onComplete={onComplete} onClose={onClose} />);
        // 3 training days → style step appears. Steps: equipment, experience, goal,
        // days/week, which days, style, session time, train_style, variety, loading → Skip
        // → restrictions → Skip → program length → start.
        // 9 Next → variety→loading; Skip loading; Skip restrictions; Next length→start; Create routine.
        for (let i = 0; i < 9; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 3, 5]);
        expect(arg.sessionTime).toBe('~30 min');
        expect(arg.answers.experience).toBe('beginner');
        expect(arg.answers.goal).toBe('build_muscle');
        expect(arg.answers.days).toBe('2-3');
        expect([...arg.answers.equipment]).toEqual(['dumbbells']);
        // The style step pre-selects the recommendation for the count (3 → fb-3).
        expect(arg.styleKey).toBe('fb-3');
        // The start-date step defaults to today, returning a noon-UTC anchor.
        expect(arg.startAnchor).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/);
        // The program-length step defaults to 12 weeks.
        expect(arg.programWeeks).toBe(12);
        // The train-style step defaults to 'balanced'.
        expect(arg.trainingStyle).toBe('balanced');
        // The variety step defaults to 'varied'.
        expect(arg.varietyPreference).toBe('varied');
        // The loading step defaults to null (skipped).
        expect(arg.loadingLean).toBeNull();
        // The restrictions step defaults to [] (skipped).
        expect(arg.movementRestrictions).toEqual([]);
    });

    it('shows the program-style step and lets you pick a non-default style', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(<RoutineSetupFlow initial={initial} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/which program style/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Push / Pull / Legs'));
        fireEvent.click(screen.getByText('Next')); // style → session time
        fireEvent.click(screen.getByText('Next')); // session time → train_style
        fireEvent.click(screen.getByText('Next')); // train_style → variety
        fireEvent.click(screen.getByText('Next')); // variety → loading
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].styleKey).toBe('ppl-3');
    });

    it('caps the day picker at the chosen days-per-week count', () => {
        render(
            <RoutineSetupFlow
                initial={{ ...initial, days: '4', trainingDays: [] }}
                onComplete={vi.fn()}
                onClose={vi.fn()}
            />,
        );
        // equipment → experience → goal → days/week (seeds the 4 recommended days) → which days
        for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/which days will you train/i)).toBeInTheDocument();
        expect(screen.getByText(/up to 4 days/i)).toBeInTheDocument();
        // Mon, Tue, Thu, Fri are seeded (4 = the cap), so a 5th day (Wed) is disabled.
        expect(screen.getByRole('button', { name: 'Wed' })).toBeDisabled();
    });

    it('hides the style step when only one style exists for the count', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → one style (fb-2)
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        // No style step: 5 Next clicks land straight on the session-time step.
        expect(screen.queryByText(/which program style/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Next')); // session time → train_style
        fireEvent.click(screen.getByText('Next')); // train_style → variety
        fireEvent.click(screen.getByText('Next')); // variety → loading
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].styleKey).toBe('fb-2');
    });

    it('the start-date step defaults to today and returns a noon-UTC anchor', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → no style step
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // equipment, experience, goal, days/week, which days, session, train_style, variety → loading
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        expect(screen.getByText(/when do you want to start/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].startAnchor).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/);
    });

    it('the start-date step can pick a custom date', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Pick a date'));
        fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2099-01-05' } });
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].startAnchor).toBe('2099-01-05T12:00:00.000Z');
    });

    it('shows the program-length step before the start step and defaults to 12 weeks', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // no style step
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // equipment, experience, goal, days/week, which days, session, train_style, variety → loading
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program-length
        expect(screen.getByText(/how long should your program be/i)).toBeInTheDocument();
        // All four hand-built lengths are offered, no custom field.
        expect(screen.getByText('8 weeks')).toBeInTheDocument();
        expect(screen.getByText('10 weeks')).toBeInTheDocument();
        expect(screen.getByText('12 weeks')).toBeInTheDocument();
        expect(screen.getByText('16 weeks')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next')); // length → start (12 untouched)
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].programWeeks).toBe(12);
    });

    it('lets you pick a non-default program length', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program-length
        fireEvent.click(screen.getByText('16 weeks'));
        fireEvent.click(screen.getByText('Next')); // length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].programWeeks).toBe(16);
    });

    it('the gender step is optional: Next is enabled with no pick and returns a null gender', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // no style step
        render(<RoutineSetupFlow collectGender initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        expect(screen.getByText(/what's your gender/i)).toBeInTheDocument();
        // No gender picked, Next still advances straight to equipment.
        fireEvent.click(screen.getByText('Next')); // gender → equipment
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
        // equipment, experience, goal, days, which days, session, train_style, variety → loading
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].gender).toBeNull();
    });

    it('the gender step offers a "Prefer not to say" choice that returns a null gender', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow collectGender initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Prefer not to say'));
        fireEvent.click(screen.getByText('Next')); // gender → equipment
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].gender).toBeNull();
    });

    it('the train_style step renders with four options and Balanced is the default', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → no program style step
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // Navigate: equipment, experience, goal, days/week, which days, session time → train_style
        for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/how do you want to train/i)).toBeInTheDocument();
        expect(screen.getByText('Balanced')).toBeInTheDocument();
        expect(screen.getByText('Strength')).toBeInTheDocument();
        expect(screen.getByText('Bodybuilding')).toBeInTheDocument();
        expect(screen.getByText('Powerbuilding')).toBeInTheDocument();
        // Balanced is the default: selecting Strength then completing returns 'strength'.
        fireEvent.click(screen.getByText('Strength'));
        fireEvent.click(screen.getByText('Next')); // train_style → variety
        fireEvent.click(screen.getByText('Next')); // variety → loading
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → length
        fireEvent.click(screen.getByText('Next')); // length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].trainingStyle).toBe('strength');
    });

    it('train_style defaults to balanced when not changed', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // Navigate through all steps including train_style, variety, loading, restrictions.
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].trainingStyle).toBe('balanced');
    });

    it('collectTrainingStyle=false skips the train_style step and train_style still in result', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} collectTrainingStyle={false} onComplete={onComplete} onClose={vi.fn()} />);
        // With no train_style step (variety + loading + restrictions still show): equipment,
        // experience, goal, days, which days, session, variety, loading → Skip → restrictions → Skip → length → start.
        for (let i = 0; i < 7; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        // train_style step must not appear anywhere
        expect(screen.queryByText(/how do you want to train/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        // trainingStyle defaults to 'balanced' in the result even when step is skipped
        expect(onComplete.mock.calls[0][0].trainingStyle).toBe('balanced');
    });

    it('the variety step renders both options and selecting Consistent returns it', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → no program style step
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // equipment, experience, goal, days/week, which days, session time, train_style → variety
        for (let i = 0; i < 7; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/how varied should it be/i)).toBeInTheDocument();
        expect(screen.getByText('Varied')).toBeInTheDocument();
        expect(screen.getByText('Consistent')).toBeInTheDocument();
        // Varied is the default: selecting Consistent then completing returns it.
        fireEvent.click(screen.getByText('Consistent'));
        fireEvent.click(screen.getByText('Next')); // variety → loading
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → length
        fireEvent.click(screen.getByText('Next')); // length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].varietyPreference).toBe('consistent');
    });

    it('collectVariety=false skips the variety step and varietyPreference defaults to varied', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} collectVariety={false} onComplete={onComplete} onClose={vi.fn()} />);
        // With no variety step (loading + restrictions still show): equipment, experience,
        // goal, days, which days, session, train_style, loading → Skip → restrictions → Skip → length → start.
        for (let i = 0; i < 7; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        // variety step must not appear anywhere
        expect(screen.queryByText(/how varied should it be/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        // varietyPreference defaults to 'varied' in the result even when step is skipped
        expect(onComplete.mock.calls[0][0].varietyPreference).toBe('varied');
    });

    it('the loading step renders four modality options and selecting Barbell returns it', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → no program style step
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        // equipment, experience, goal, days/week, which days, session, train_style, variety → loading
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/which equipment do you prefer/i)).toBeInTheDocument();
        expect(screen.getByText('Barbell')).toBeInTheDocument();
        expect(screen.getByText('Dumbbells')).toBeInTheDocument();
        expect(screen.getByText('Machines')).toBeInTheDocument();
        expect(screen.getByText('Cables')).toBeInTheDocument();
        // No selection: button says "Skip".
        expect(screen.getByText('Skip')).toBeInTheDocument();
        // Select Barbell: button changes to "Next".
        fireEvent.click(screen.getByText('Barbell'));
        expect(screen.getByText('Next')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].loadingLean).toBe('barbell');
    });

    it('loading step: tapping the selected option again deselects it', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Barbell')); // select
        expect(screen.getByText('Next')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Barbell')); // deselect (toggle off)
        expect(screen.getByText('Skip')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].loadingLean).toBeNull();
    });

    it('collectLoadingLean=false skips the loading step and loadingLean defaults to null', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        const single = { ...initial, trainingDays: [1, 4] };
        render(<RoutineSetupFlow initial={single} collectLoadingLean={false} onComplete={onComplete} onClose={vi.fn()} />);
        // With no loading step (restrictions still shows): equipment, experience, goal,
        // days, which days, session, train_style, variety, restrictions → Skip → length → start.
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
        // loading step must not appear anywhere
        expect(screen.queryByText(/which equipment do you prefer/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].loadingLean).toBeNull();
    });
});
