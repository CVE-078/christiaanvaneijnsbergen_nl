import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetLogger from '../SetLogger';
import type { LogEntry } from '@/lib/pulse/types';

// SetLogger reads the active routine's block length from the Pulse provider to
// pick the RIR target. It always renders inside the provider in the app, so the
// standalone unit test stubs usePulse with a default 12-week routine.
vi.mock('@/context/PulseContext', () => ({
    usePulse: () => ({ activeRoutine: { program_weeks: 12 } }),
}));

const defaultProps = {
    exIdx: 0,
    setIdx: 0,
    week: 1,
    type: 'push' as const,
    entry: undefined,
    unit: 'kg' as const,
    onSave: vi.fn(),
};

describe('SetLogger', () => {
    it('renders kg and reps inputs and a Save button when not saved', () => {
        render(<SetLogger {...defaultProps} />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('shows the saved value and no Save button when entry is saved', () => {
        const savedEntry: LogEntry = { kg: 60, reps: 10, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
        expect(screen.getByText(/60 kg/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('pre-fills inputs with saved values when Edit is clicked', async () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(80);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(8);
    });

    it('prefills the normal progression target by default', () => {
        const prev: LogEntry = { kg: 100, reps: 8, rir: 1, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByLabelText(/auto-progression target/i)).toBeInTheDocument();
        // rir 1 < target rir → progression deloads 2.5 kg to 97.5, not the 10% deload.
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(97.5);
    });

    it('prefills a deloaded target when deload is set', () => {
        const prev: LogEntry = { kg: 100, reps: 8, rir: 1, saved: true };
        render(<SetLogger {...defaultProps} week={2} deload previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByLabelText(/deload target/i)).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(90);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(8);
    });

    it('Cancel resets inputs to saved values and hides the Cancel button', async () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        const kgInput = screen.getByRole('spinbutton', { name: /weight in kg/i });
        await userEvent.clear(kgInput);
        await userEvent.type(kgInput, '999');
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        // Back to saved view â€” no Cancel button visible
        expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
        expect(screen.getByText(/80 kg/)).toBeInTheDocument();
    });

    it('calls onSave with a valid LogEntry when Save is clicked', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} onSave={onSave} />);

        await userEvent.type(screen.getByRole('spinbutton', { name: /weight in kg/i }), '60');
        await userEvent.type(screen.getByRole('spinbutton', { name: /repetitions/i }), '10');
        await userEvent.click(screen.getByRole('button', { name: /save/i }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });

    it('does not call onSave when inputs are empty', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} onSave={onSave} />);
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('bodyweight: saves reps with no weight as 0 kg', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} bodyweight onSave={onSave} />);
        await userEvent.type(screen.getByRole('spinbutton', { name: /repetitions/i }), '12');
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 0, reps: 12, saved: true }));
    });

    it('bodyweight: a logged set with no added load reads "Bodyweight"', () => {
        const savedEntry: LogEntry = { kg: 0, reps: 12, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} bodyweight entry={savedEntry} />);
        expect(screen.getByText(/bodyweight/i)).toBeInTheDocument();
    });

    it('calls onDelete when the delete button is clicked', async () => {
        const onDelete = vi.fn();
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} onDelete={onDelete} />);
        await userEvent.click(screen.getByRole('button', { name: /✕/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('displays the RIR target for the given week', () => {
        render(<SetLogger {...defaultProps} week={9} />); // week 9 â†’ RIR 0
        expect(screen.getByText(/^0\s+RIR$/)).toBeInTheDocument();
    });

    it('shows previous week reference when previousEntry is provided and set is unsaved', () => {
        const prev: LogEntry = { kg: 60, reps: 8, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} previousEntry={prev} />);
        expect(screen.getByText(/60 kg × 8/)).toBeInTheDocument();
    });

    it('pre-fills weight and reps and shows the target hint when the top of the range is hit', () => {
        // week 2, targetRIR = getRIR(1) = 3; rir 3 >= 3 and reps 12 >= hi 12 → 62.5 × 8
        const prev: LogEntry = { kg: 60, reps: 12, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(62.5);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(8);
        expect(screen.getByLabelText(/auto-progression target/i)).toHaveTextContent('62.5');
    });

    it('pre-fills a rep bump when mid-range', () => {
        // reps 8 < hi 12 → same weight, reps 9
        const prev: LogEntry = { kg: 60, reps: 8, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(60);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(9);
    });

    it('shows no target hint when there is no previous entry', () => {
        render(<SetLogger {...defaultProps} repsRange="8-12" />);
        expect(screen.queryByLabelText(/auto-progression target/i)).not.toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(null);
    });

    it('shows PR badge when isPR is true and entry is saved', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} isPR={true} />);
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('does not show PR badge when isPR is false', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} isPR={false} />);
        expect(screen.queryByText('PR')).not.toBeInTheDocument();
    });

    it('shows the plate calculator affordance on a saved set above the handle weight', () => {
        const savedEntry: LogEntry = { kg: 60, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.getByRole('button', { name: /plate calculator/i })).toBeInTheDocument();
    });

    it('hides the plate calculator affordance when no weight is entered', () => {
        render(<SetLogger {...defaultProps} />);
        expect(screen.queryByRole('button', { name: /plate calculator/i })).not.toBeInTheDocument();
    });

    it('shows a failure tag when a saved set is logged at RIR 0', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 0, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.getByText(/failure/i)).toBeInTheDocument();
    });

    it('does not show the failure tag at RIR > 0', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.queryByText(/failure/i)).not.toBeInTheDocument();
    });

    it('logs a drop set: adding a drop segment and saving includes drops', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} onSave={onSave} />);

        await userEvent.type(screen.getByRole('spinbutton', { name: /weight in kg/i }), '80');
        await userEvent.type(screen.getByRole('spinbutton', { name: /repetitions/i }), '8');
        await userEvent.click(screen.getByRole('button', { name: /add drop/i }));
        await userEvent.type(screen.getByRole('spinbutton', { name: /drop 1 weight in kg/i }), '60');
        await userEvent.type(screen.getByRole('spinbutton', { name: /drop 1 repetitions/i }), '8');
        await userEvent.click(screen.getByRole('button', { name: /save/i }));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                saved: true,
                drops: [expect.objectContaining({ kg: expect.any(Number), reps: expect.any(Number) })],
            }),
        );
    });

    it('opens the plate calculator and shows per-side chips for the target weight', async () => {
        const savedEntry: LogEntry = { kg: 100, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /plate calculator/i }));
        expect(screen.getByText(/per side/i)).toBeInTheDocument();
        // 100 kg barbell -> 40 per side -> [25, 15]
        expect(screen.getByText(/25 kg/)).toBeInTheDocument();
    });

    it('card target reads as an instruction ("Go") for a normal progression', () => {
        const prev: LogEntry = { kg: 60, reps: 12, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByLabelText(/auto-progression target/i)).toHaveTextContent(/^Go /);
    });

    it('card target reads as a deliberate backoff ("Back off to") on a deload', () => {
        const prev: LogEntry = { kg: 100, reps: 8, rir: 1, saved: true };
        render(<SetLogger {...defaultProps} week={2} deload previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByLabelText(/deload target/i)).toHaveTextContent(/^Back off to /);
    });

    it('card previous reads "Last ..." rather than a glyph', () => {
        const prev: LogEntry = { kg: 60, reps: 8, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} previousEntry={prev} />);
        expect(screen.getByText(/Last 60 kg × 8/)).toBeInTheDocument();
    });

    it('guided (editorial) shows a spoken coaching sentence for the target', () => {
        const prev: LogEntry = { kg: 90, reps: 7, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} variant="editorial" week={2} previousEntry={prev} repsRange="8-12" />);
        const hint = screen.getByLabelText(/auto-progression target/i);
        expect(hint).toHaveTextContent(/Last time you hit 90 kg × 7/);
        expect(hint).toHaveTextContent(/Go for/);
        expect(hint).toHaveTextContent(/(reps? left|push close to failure)/);
    });

    it('guided coaching pushes to failure when the target RIR is 0', () => {
        const prev: LogEntry = { kg: 90, reps: 7, rir: 0, saved: true };
        render(<SetLogger {...defaultProps} variant="editorial" week={9} previousEntry={prev} repsRange="8-12" />);
        expect(screen.getByLabelText(/auto-progression target/i)).toHaveTextContent(/push close to failure/);
    });

    it('guided deload reads as a controlled backoff that keeps reps in the tank', () => {
        const prev: LogEntry = { kg: 100, reps: 8, rir: 1, saved: true };
        render(
            <SetLogger {...defaultProps} variant="editorial" week={2} deload previousEntry={prev} repsRange="8-12" />,
        );
        const hint = screen.getByLabelText(/deload target/i);
        expect(hint).toHaveTextContent(/back off on purpose/);
        expect(hint).toHaveTextContent(/in the tank/);
    });
});
