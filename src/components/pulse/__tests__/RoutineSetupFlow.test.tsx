import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RoutineSetupFlow from '../RoutineSetupFlow';
import { recommendStyle } from '@/lib/pulse/generation';
import { SUGGESTED_DAYS } from '@/lib/pulse/weeklyFrequency';
import type { EquipmentKey, EquipmentProfile } from '@/lib/pulse/types';

const initial = {
    equipment: ['dumbbells'] as EquipmentKey[],
    experience: 'beginner' as const,
    goal: 'build_muscle' as const,
    days: 3 as const,
    trainingDays: [1, 3, 5],
    sessionTime: '~30 min' as const,
};

beforeEach(() => vi.clearAllMocks());

describe('RoutineSetupFlow', () => {
    it('starts at the equipment step', () => {
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={vi.fn()} />);
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
    });

    it('the close (X) button calls onClose immediately on the first step', () => {
        const onClose = vi.fn();
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={onClose} />);
        // First step has no progress to lose, so X closes without a confirm.
        fireEvent.click(screen.getByRole('button', { name: /close setup/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closing after advancing confirms before discarding', () => {
        const onClose = vi.fn();
        render(<RoutineSetupFlow initial={initial} onComplete={vi.fn()} onClose={onClose} />);
        fireEvent.click(screen.getByText('Next')); // advance past the entry step → dirty
        const confirm = vi.spyOn(window, 'confirm');
        confirm.mockReturnValueOnce(false); // declined → stays open
        fireEvent.click(screen.getByRole('button', { name: /close setup/i }));
        expect(onClose).not.toHaveBeenCalled();
        confirm.mockReturnValueOnce(true); // accepted → closes
        fireEvent.click(screen.getByRole('button', { name: /close setup/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
        confirm.mockRestore();
    });

    it('Escape closes the flow from the first step (nothing to discard)', () => {
        const onClose = vi.fn();
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={onClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
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
        expect(arg.answers.days).toBe(3);
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
                initial={{ ...initial, days: 4, trainingDays: [] }}
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

    it('the days step offers the five exact frequencies and no bucket options', () => {
        render(<RoutineSetupFlow initial={initial} onComplete={vi.fn()} onClose={vi.fn()} />);
        // equipment → experience → goal → days/week
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/how many days per week/i)).toBeInTheDocument();
        for (const n of [2, 3, 4, 5, 6]) expect(screen.getByText(`${n} days`)).toBeInTheDocument();
        expect(screen.queryByText('2–3 days')).not.toBeInTheDocument();
        expect(screen.queryByText('5–6 days')).not.toBeInTheDocument();
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

    // ── Start-date display + picker UX (#5 in the report) ────────────────────
    const startFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    function reachStartStep() {
        const single = { ...initial, trainingDays: [1, 4] }; // 2 days → no style step
        render(<RoutineSetupFlow initial={single} onComplete={vi.fn()} onClose={vi.fn()} />);
        for (let i = 0; i < 8; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Skip')); // loading → restrictions
        fireEvent.click(screen.getByText('Skip')); // restrictions → program length
        fireEvent.click(screen.getByText('Next')); // program length → start
    }

    it('shows the actual resolved dates next to Today and Tomorrow', () => {
        reachStartStep();
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(screen.getByText(startFmt.format(today))).toBeInTheDocument();
        expect(screen.getByText(startFmt.format(tomorrow))).toBeInTheDocument();
    });

    it('shows a "Next Monday" date that is never today', () => {
        reachStartStep();
        const today = new Date();
        const monday = new Date();
        monday.setDate(monday.getDate() + (((1 - monday.getDay() + 7) % 7) || 7));
        expect(startFmt.format(monday)).not.toBe(startFmt.format(today));
        expect(screen.getByText(startFmt.format(monday))).toBeInTheDocument();
    });

    it('opens the native date picker immediately when "Pick a date" is clicked', () => {
        const showPicker = vi.fn();
        // jsdom has no showPicker; define it so the optional call reaches our spy.
        (HTMLInputElement.prototype as unknown as { showPicker: () => void }).showPicker = showPicker;
        try {
            reachStartStep();
            fireEvent.click(screen.getByText('Pick a date'));
            expect(showPicker).toHaveBeenCalledTimes(1);
        } finally {
            delete (HTMLInputElement.prototype as unknown as { showPicker?: () => void }).showPicker;
        }
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
        render(
            <RoutineSetupFlow
                initial={single}
                collectTrainingStyle={false}
                onComplete={onComplete}
                onClose={vi.fn()}
            />,
        );
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
        render(
            <RoutineSetupFlow initial={single} collectLoadingLean={false} onComplete={onComplete} onClose={vi.fn()} />,
        );
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

describe('RoutineSetupFlow quick mode', () => {
    const quickInitial = {
        equipment: ['dumbbells'] as EquipmentKey[],
        experience: 'beginner' as const,
        goal: 'build_muscle' as const,
        days: 4 as const,
        trainingDays: [] as number[],
        sessionTime: '~30 min' as const,
    };

    it('trims the flow to 6 steps and auto-applies suggested days + recommended style', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(<RoutineSetupFlow mode="quick" initial={quickInitial} onComplete={onComplete} onClose={vi.fn()} />);
        // 1: equipment
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        // 2: experience
        expect(screen.getByText(/training experience/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        // 3: goal
        expect(screen.getByText(/primary goal/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        // 4: days/week → jumps straight past "which days" and "program style"
        expect(screen.getByText(/how many days per week/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        expect(screen.queryByText(/which days will you train/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/which program style/i)).not.toBeInTheDocument();
        // 5: session length
        expect(screen.getByText(/how long are your sessions/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        // 6: start → jumps straight past gender, the four personalization steps, and program length
        expect(screen.getByText(/when do you want to start/i)).toBeInTheDocument();
        expect(screen.queryByText(/how long should your program be/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual(SUGGESTED_DAYS[4]);
        expect(arg.styleKey).toBe(recommendStyle(arg.trainingDays.length));
        expect(arg.programWeeks).toBe(12);
        expect(arg.gender).toBeNull();
    });

    it('frequency 6 seeds six training days and resolves ppl-x2-6 (Issue 0)', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(
            <RoutineSetupFlow
                mode="quick"
                initial={{ ...quickInitial, days: 6 }}
                onComplete={onComplete}
                onClose={vi.fn()}
            />,
        );
        // equipment → experience → goal → days/week → session length → start
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 2, 3, 4, 5, 6]);
        expect(arg.styleKey).toBe('ppl-x2-6');
    });

    it('frequency 3 seeds three training days (the old 2-3 bucket only ever seeded two)', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(
            <RoutineSetupFlow
                mode="quick"
                initial={{ ...quickInitial, days: 3 }}
                onComplete={onComplete}
                onClose={vi.fn()}
            />,
        );
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 3, 5]);
        expect(arg.trainingDays).toHaveLength(3);
        expect(arg.styleKey).toBe('fb-3');
    });

    it('the days step shows the suggested days pre-selected and lets you adjust them (Issue 2)', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(<RoutineSetupFlow mode="quick" initial={quickInitial} onComplete={onComplete} onClose={vi.fn()} />);
        // equipment → experience → goal → days/week (combined with the day grid)
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
        // Frequency 4 pre-seeds Mon/Tue/Thu/Fri in the grid.
        for (const d of ['Mon', 'Tue', 'Thu', 'Fri'])
            expect(screen.getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'true');
        for (const d of ['Wed', 'Sat', 'Sun'])
            expect(screen.getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'false');
        // Deselect Fri: only 3 of 4 days selected → Next is disabled (the
        // chosen frequency must match the selected days exactly).
        fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
        expect(screen.getByText('Next')).toBeDisabled();
        // Select Sat instead → Next enabled; the adjusted days flow through.
        fireEvent.click(screen.getByRole('button', { name: 'Sat' }));
        fireEvent.click(screen.getByText('Next')); // days → session length
        fireEvent.click(screen.getByText('Next')); // session length → start
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].trainingDays).toEqual([1, 2, 4, 6]);
    });

    it('changing the frequency resets the day selection to the new suggestion (Issue 2)', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(<RoutineSetupFlow mode="quick" initial={quickInitial} onComplete={onComplete} onClose={vi.fn()} />);
        for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText('Next'));
        // Adjust the 4-day selection first, then change frequency: the custom
        // selection must reset to the new suggested layout (no impossible mixes).
        fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
        fireEvent.click(screen.getByRole('button', { name: 'Sat' }));
        fireEvent.click(screen.getByText('3 days'));
        for (const d of ['Mon', 'Wed', 'Fri'])
            expect(screen.getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Sat' })).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        const arg = onComplete.mock.calls[0][0];
        expect(arg.trainingDays).toEqual([1, 3, 5]);
        expect(arg.styleKey).toBe('fb-3');
    });

    it('back navigation skips the trimmed steps in both directions', () => {
        render(<RoutineSetupFlow mode="quick" initial={quickInitial} onComplete={vi.fn()} onClose={vi.fn()} />);
        for (let i = 0; i < 4; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/how long are your sessions/i)).toBeInTheDocument();
        // Back from session length returns straight to days/week, skipping which-days/style.
        fireEvent.click(screen.getByText('←'));
        expect(screen.getByText(/how many days per week/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Next')); // session length → start
        expect(screen.getByText(/when do you want to start/i)).toBeInTheDocument();
        // Back from start returns to session length, skipping program length.
        fireEvent.click(screen.getByText('←'));
        expect(screen.getByText(/how long are your sessions/i)).toBeInTheDocument();
    });

    it('forces every collect* prop off regardless of what the consumer passes', async () => {
        const onComplete = vi.fn().mockResolvedValue(undefined);
        render(
            <RoutineSetupFlow
                mode="quick"
                initial={quickInitial}
                collectGender
                collectTrainingStyle
                collectVariety
                collectLoadingLean
                collectRestrictions
                onComplete={onComplete}
                onClose={vi.fn()}
            />,
        );
        // No gender step despite collectGender: starts straight at equipment.
        expect(screen.queryByText(/what's your gender/i)).not.toBeInTheDocument();
        expect(screen.getByText(/equipment do you have access to/i)).toBeInTheDocument();
        // 5 Next clicks reach the start step directly: the personalization steps
        // (train_style, variety, loading, restrictions) and program length never render.
        for (let i = 0; i < 5; i++) fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText(/when do you want to start/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Create routine'));
        await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
        expect(onComplete.mock.calls[0][0].gender).toBeNull();
    });
});

describe('RoutineSetupFlow equipment profiles (Branch B)', () => {
    const profiles: EquipmentProfile[] = [
        { id: 'home', name: 'Home', equipment: ['dumbbells', 'bench'], created_at: '2026-06-09T02:00:00Z', expires_at: null },
        { id: 'gym', name: 'Gym', equipment: ['barbell', 'machines'], created_at: '2026-06-09T01:00:00Z', expires_at: null },
    ];

    it('pre-fills the equipment step from the active profile', () => {
        render(
            <RoutineSetupFlow
                onComplete={vi.fn()}
                onClose={vi.fn()}
                equipmentProfiles={profiles}
                activeEquipmentProfileId="gym"
            />,
        );
        expect(screen.getByRole('checkbox', { name: /Barbell/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Gym machines/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Dumbbells/ })).not.toBeChecked();
        expect(screen.getByText(/Filled from your Gym profile/i)).toBeInTheDocument();
    });

    it('pre-fills from the most-recent profile when none is active', () => {
        render(
            <RoutineSetupFlow
                onComplete={vi.fn()}
                onClose={vi.fn()}
                equipmentProfiles={profiles}
                activeEquipmentProfileId={null}
            />,
        );
        expect(screen.getByRole('checkbox', { name: /Dumbbells/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Weight bench/ })).toBeChecked();
        expect(screen.getByText(/Filled from your Home profile/i)).toBeInTheDocument();
    });

    it("with no profiles, shows just the checkboxes (today's behavior)", () => {
        render(<RoutineSetupFlow onComplete={vi.fn()} onClose={vi.fn()} />);
        expect(screen.queryByText(/your equipment profiles/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Filled from your/i)).not.toBeInTheDocument();
        expect(screen.getByRole('checkbox', { name: /Dumbbells/ })).not.toBeChecked();
    });

    it('tapping a profile chip fills the checkboxes from that profile', () => {
        render(
            <RoutineSetupFlow
                onComplete={vi.fn()}
                onClose={vi.fn()}
                equipmentProfiles={profiles}
                activeEquipmentProfileId="home"
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /Gym/ }));
        expect(screen.getByRole('checkbox', { name: /Barbell/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Dumbbells/ })).not.toBeChecked();
        expect(screen.getByText(/Filled from your Gym profile/i)).toBeInTheDocument();
    });

    it('offers "Save as profile" only when the selection matches no saved set, and saving creates', async () => {
        const onCreate = vi
            .fn()
            .mockResolvedValue({ id: 'new', name: 'Custom', equipment: ['dumbbells'], created_at: 'x' });
        render(
            <RoutineSetupFlow
                onComplete={vi.fn()}
                onClose={vi.fn()}
                equipmentProfiles={profiles}
                activeEquipmentProfileId="home"
                onCreateEquipmentProfile={onCreate}
            />,
        );
        // Starts matching Home, so no save-as.
        expect(screen.queryByText(/Save these as a profile/i)).not.toBeInTheDocument();
        // Add Barbell so the selection (dumbbells + bench + barbell) matches no profile.
        fireEvent.click(screen.getByRole('checkbox', { name: /Barbell/ }));
        fireEvent.click(screen.getByText(/Save these as a profile/i));
        fireEvent.change(screen.getByPlaceholderText(/profile name/i), { target: { value: 'Custom' } });
        fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
        await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
        expect(onCreate.mock.calls[0][0]).toBe('Custom');
        expect([...onCreate.mock.calls[0][1]].sort()).toEqual(['barbell', 'bench', 'dumbbells']);
    });

    it('a suggested-name chip fills the name field', () => {
        render(
            <RoutineSetupFlow
                onComplete={vi.fn()}
                onClose={vi.fn()}
                equipmentProfiles={profiles}
                activeEquipmentProfileId="home"
                onCreateEquipmentProfile={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('checkbox', { name: /Barbell/ })); // diverge from Home
        fireEvent.click(screen.getByText(/Save these as a profile/i));
        fireEvent.click(screen.getByRole('button', { name: /^Travel$/ }));
        expect(screen.getByPlaceholderText(/profile name/i)).toHaveValue('Travel');
    });
});
